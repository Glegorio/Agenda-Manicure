import { DomainError } from '../common/domain-error.js';

/** Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta. */
export const invalidCredentials = () =>
  new DomainError('UNAUTHORIZED', 'E-mail ou senha incorretos.');

export const invalidSession = () =>
  new DomainError('UNAUTHORIZED', 'Sua sessão expirou. Entre novamente.');

export const emailTaken = () => new DomainError('EMAIL_TAKEN');

export const slugTaken = () => new DomainError('SLUG_TAKEN');
