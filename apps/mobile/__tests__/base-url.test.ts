import { resolveBaseUrl } from '../src/api/instance';

describe('URL da API (4.1)', () => {
  it('em dev, aceita http e cai no localhost sem configuração', () => {
    expect(resolveBaseUrl(undefined, true)).toBe('http://localhost:3333/v1');
    expect(resolveBaseUrl('http://192.168.0.10:3333/v1', true)).toBe('http://192.168.0.10:3333/v1');
  });

  it('fora do dev, recusa http e URL ausente (tokens nunca em claro)', () => {
    expect(() => resolveBaseUrl('http://api.agende.app/v1', false)).toThrow('https://');
    expect(() => resolveBaseUrl(undefined, false)).toThrow('https://');
    expect(resolveBaseUrl('https://api.agende.app/v1', false)).toBe('https://api.agende.app/v1');
  });
});
