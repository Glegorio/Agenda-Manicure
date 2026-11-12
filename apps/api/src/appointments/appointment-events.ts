import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { AppointmentEventType, AppointmentResponse } from '@agende/contracts';
import { filter, interval, map, merge, type Observable, Subject } from 'rxjs';

/** Mantém a conexão viva em proxies/balanceadores que derrubam conexão ociosa. */
const HEARTBEAT_MS = 25_000;

interface AppointmentEvent {
  readonly professionalId: string;
  readonly type: AppointmentEventType;
  readonly appointment: AppointmentResponse;
}

/**
 * Barramento em memória dos eventos da Agenda Hub (SSE, ADR-0001). Publique **depois** do commit.
 * Uma instância da API só enxerga as próprias escritas: com mais de uma réplica, trocar por
 * `LISTEN/NOTIFY` do Postgres (fase 8.4).
 */
@Injectable()
export class AppointmentEvents implements OnModuleDestroy {
  private readonly events = new Subject<AppointmentEvent>();

  publish(event: AppointmentEvent): void {
    this.events.next(event);
  }

  /** Só os eventos da própria profissional (regra 5), mais um `ping` periódico. */
  streamFor(professionalId: string): Observable<{ type: string; data: AppointmentResponse | '' }> {
    const own = this.events.pipe(
      filter((event) => event.professionalId === professionalId),
      map((event) => ({ type: event.type, data: event.appointment })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(map(() => ({ type: 'ping', data: '' as const })));
    return merge(own, heartbeat);
  }

  /** Encerra os streams abertos para o `app.close()` não ficar preso em conexões SSE. */
  onModuleDestroy(): void {
    this.events.complete();
  }
}
