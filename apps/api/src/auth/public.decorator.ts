import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'agende:isPublic';

/** Libera a rota (ou o controller inteiro) do guard global de autenticação. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
