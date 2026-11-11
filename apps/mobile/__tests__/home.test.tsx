import { render, screen } from '@testing-library/react-native';
import HomeScreen from '../app/index';

// Testes ficam fora de app/: tudo dentro de app/ vira rota no Expo Router.
describe('HomeScreen (placeholder)', () => {
  it('renderiza o título como cabeçalho', async () => {
    await render(<HomeScreen />);

    expect(screen.getByRole('header', { name: 'Agende' })).toBeOnTheScreen();
  });
});
