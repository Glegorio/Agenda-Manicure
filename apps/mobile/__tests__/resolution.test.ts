import { healthResponseSchema } from '@agende/contracts';

describe('resolução de pacotes internos', () => {
  it('resolve @agende/contracts pela fonte TS (ADR-0005)', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });
});
