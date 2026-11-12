import { DomainError } from '../common/domain-error.js';

export { slugTaken } from '../auth/auth.errors.js';

/** Token válido de uma conta que não existe mais: a sessão não serve. */
export const accountGone = () => new DomainError('UNAUTHORIZED');
