import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from '../page';

describe('HomePage (placeholder)', () => {
  it('renderiza o título principal em pt-BR', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Agende' })).toBeInTheDocument();
  });
});
