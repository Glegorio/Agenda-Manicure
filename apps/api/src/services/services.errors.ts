import { DomainError } from '../common/domain-error.js';

/** Também para serviço de outra profissional: não revela que o id existe (regra 5). */
export const serviceNotFound = () => new DomainError('NOT_FOUND', 'Serviço não encontrado.');
