import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SwRegister } from '../SwRegister';

const register = vi.fn(() => Promise.resolve({}));

afterEach(() => {
  vi.unstubAllEnvs();
  register.mockClear();
});

Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });

describe('SwRegister', () => {
  it('registra /sw.js em produção', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<SwRegister />);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('não registra em desenvolvimento (cache atrapalharia o hot reload)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(<SwRegister />);
    expect(register).not.toHaveBeenCalled();
  });
});
