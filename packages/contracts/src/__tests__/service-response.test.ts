import { describe, expect, it } from 'vitest';
import { serviceDeleteResponseSchema, serviceResponseSchema } from '../index.ts';

describe('respostas de serviço', () => {
  it('serviço devolvido pela API inclui id e sortOrder', () => {
    const service = {
      id: '3f1c9b4e-8a2d-4c6e-9f1a-2b3c4d5e6f70',
      name: 'Alongamento em Gel',
      category: 'Alongamento',
      description: null,
      priceCents: 15000,
      durationMin: 120,
      imageUrl: null,
      active: true,
      public: true,
      sortOrder: 0,
    };
    expect(serviceResponseSchema.parse(service)).toEqual(service);
    expect(serviceResponseSchema.safeParse({ ...service, sortOrder: undefined }).success).toBe(
      false,
    );
  });

  it('Q-24 / RN-12: DELETE informa se apagou ou desativou', () => {
    expect(serviceDeleteResponseSchema.parse({ outcome: 'DELETED' })).toEqual({
      outcome: 'DELETED',
    });
    expect(serviceDeleteResponseSchema.safeParse({ outcome: 'ARCHIVED' }).success).toBe(false);
  });
});
