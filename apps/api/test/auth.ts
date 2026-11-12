import type { INestApplication } from '@nestjs/common';
import { authSessionResponseSchema } from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';

let seq = 0;

/**
 * Cadastra uma profissional pela API e devolve o id e o header `Authorization` prontos.
 * E-mail único por chamada, salvo se informado.
 */
export async function signUp(
  app: INestApplication<App>,
  { email, slug }: { email?: string; slug?: string } = {},
): Promise<{ id: string; auth: string }> {
  seq += 1;
  const res = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({
      email: email ?? `profissional-${String(seq)}@exemplo.com.br`,
      password: 'senha-segura-123',
      businessName: 'Studio Ana',
      slug,
    })
    .expect(201);
  const session = authSessionResponseSchema.parse(res.body);
  return { id: session.professional.id, auth: `Bearer ${session.accessToken}` };
}
