import { Logger, type INestApplication } from '@nestjs/common';

/** `CORS_ORIGINS=http://a,https://b` → lista sem espaços nem vazios. */
export function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Q-39: a web booking chama a API direto do navegador (um proxy no Next juntaria todas as clientes
 * num IP só e quebraria o rate limit por IP, Q-25). Só as origens configuradas; sem cookies.
 */
export function configureCors(app: INestApplication, origins: string[]): void {
  if (origins.length === 0) {
    // Seguro (bloqueia tudo), mas a web booking quebra: deixa o motivo visível no log.
    Logger.warn('CORS_ORIGINS vazio: nenhuma origem de navegador pode chamar a API.', 'Cors');
  }
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    // Sem Authorization: só a web booking (rotas públicas) chama do navegador; o app é nativo.
    allowedHeaders: ['Content-Type'],
    // Retry-After (429) e Date (contador do hold com o relógio do servidor).
    exposedHeaders: ['Retry-After', 'Date'],
    maxAge: 600,
  });
}
