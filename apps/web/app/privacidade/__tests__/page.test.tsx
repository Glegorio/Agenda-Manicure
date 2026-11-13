import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage, { metadata } from '../page';

describe('/privacidade (Q-33, texto provisório)', () => {
  it('diz que a profissional é a controladora e que o texto é provisório', () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Política de privacidade' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/profissional .* é a controladora/)).toBeInTheDocument();
    expect(screen.getByText(/versão provisória/i)).toBeInTheDocument();
  });

  it('explica dados de saúde nas observações (Q-34)', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Informações de saúde' })).toBeInTheDocument();
    expect(screen.getByText(/só é enviada com a sua autorização/)).toBeInTheDocument();
  });

  it('tem título próprio', () => {
    expect(metadata.title).toBe('Política de privacidade · Agende');
  });
});
