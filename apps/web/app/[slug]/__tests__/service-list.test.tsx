import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PublicServiceItem } from '@agende/contracts';
import { ServiceList } from '../_components/ServiceList';

const service = (overrides: Partial<PublicServiceItem>): PublicServiceItem => ({
  id: '01a1d4c4-ae02-742d-811c-1a062bb4fa3f',
  name: 'Alongamento em Gel',
  category: 'Alongamento',
  description: null,
  priceCents: 15000,
  durationMin: 120,
  imageUrl: null,
  ...overrides,
});

const gel = service({});
const mao = service({
  id: '01a1d4c4-ae02-742d-811c-1a062bb4fa40',
  name: 'Manicure',
  category: 'Mãos',
  description: 'Cutilagem e esmaltação.',
  priceCents: 123456,
  durationMin: 45,
  imageUrl: 'https://cdn.example.com/mao.jpg',
});

describe('ServiceList (etapa 1)', () => {
  it('renderiza os serviços que a API devolveu (já filtrados por RN-91), na ordem dela', () => {
    render(<ServiceList slug="studio-ana" services={[mao, gel]} />);
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Manicure', 'Alongamento em Gel']);
  });

  it('RN-77: preço em BRL e duração legível', () => {
    render(<ServiceList slug="studio-ana" services={[mao]} />);
    const card = screen.getByRole('link', { name: /Manicure/ });
    expect(within(card).getByText(/R\$\s1\.234,56/)).toBeInTheDocument();
    expect(within(card).getByText('45 min')).toBeInTheDocument();
    expect(within(card).getByText('Cutilagem e esmaltação.')).toBeInTheDocument();
  });

  it('cada card leva à etapa 2 com o serviço na URL', () => {
    render(<ServiceList slug="studio-ana" services={[gel]} />);
    expect(screen.getByRole('link', { name: /Alongamento em Gel/ })).toHaveAttribute(
      'href',
      `/studio-ana?service=${gel.id}`,
    );
  });

  it('duração e preço separados por vírgula para leitor de tela', () => {
    render(<ServiceList slug="studio-ana" services={[gel]} />);
    expect(screen.getByRole('link', { name: /2h\s*·?\s*,\s*R\$/ })).toBeInTheDocument();
  });

  it('o nome acessível do card inclui duração e preço', () => {
    render(<ServiceList slug="studio-ana" services={[gel]} />);
    expect(
      screen.getByRole('link', { name: /Alongamento em Gel.*2h.*R\$\s150,00/ }),
    ).toBeInTheDocument();
  });

  it('imagem só quando há imageUrl, decorativa (o nome já está no card)', () => {
    const { container } = render(<ServiceList slug="studio-ana" services={[mao, gel]} />);
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', mao.imageUrl);
    expect(images[0]).toHaveAttribute('alt', '');
  });

  it('lista vazia mostra mensagem', () => {
    render(<ServiceList slug="studio-ana" services={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText(/ainda não tem serviços disponíveis/)).toBeInTheDocument();
  });
});
