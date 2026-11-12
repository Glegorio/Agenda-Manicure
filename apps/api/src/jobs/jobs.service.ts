import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { CleanupService } from './cleanup.service.js';

export const JOBS_CONFIG = Symbol('JOBS_CONFIG');

export interface JobsConfig {
  /** Desligado nos testes de API (os testes chamam a limpeza direto). */
  readonly enabled: boolean;
  readonly connectionString: string;
}

export const CLEANUP_QUEUE = 'maintenance-cleanup';
/** RN-46: a cada minuto. */
const EVERY_MINUTE = '* * * * *';

/**
 * Fila pg-boss sobre o próprio Postgres (ADR-0001). O cron do pg-boss é único por nome entre
 * instâncias e a fila `singleton` impede duas limpezas ao mesmo tempo.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(JOBS_CONFIG) private readonly config: JobsConfig,
    private readonly cleanup: CleanupService,
  ) {}

  /**
   * Falha ao subir a fila não derruba a API: a correção não depende da limpeza (RN-46). O erro
   * vai para o log (a role do banco precisa poder criar o schema `pgboss`).
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.enabled) return;
    try {
      await this.start();
    } catch (error) {
      this.logger.error('Fila de jobs indisponível; limpeza periódica desligada.', error);
      await this.onModuleDestroy();
    }
  }

  private async start(): Promise<void> {
    const boss = new PgBoss(this.config.connectionString);
    boss.on('error', (error) => {
      this.logger.error(error);
    });
    await boss.start();
    this.boss = boss;

    await boss.createQueue(CLEANUP_QUEUE, { policy: 'singleton' });
    await boss.work(CLEANUP_QUEUE, async () => {
      const removed = await this.cleanup.run();
      this.logger.log(
        `Limpeza: ${String(removed.holds)} holds e ${String(removed.refreshTokens)} refresh tokens`,
      );
    });
    await boss.schedule(CLEANUP_QUEUE, EVERY_MINUTE);
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop({ graceful: true });
    this.boss = undefined;
  }

  /** Para testes e diagnóstico: falha se a fila não estiver ligada. */
  requireBoss(): PgBoss {
    if (!this.boss) throw new Error('pg-boss não iniciado.');
    return this.boss;
  }
}
