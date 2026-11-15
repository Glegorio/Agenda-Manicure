import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { getTheme } from '@agende/ui-tokens';
import { ThemeProvider, resolveScheme, useTheme } from '../src/theme/ThemeProvider';

function Probe() {
  const theme = useTheme();
  return <Text>{`${theme.palette}/${theme.scheme}/${theme.colors.primary}`}</Text>;
}

describe('tema (4.1)', () => {
  it.each([
    ['SYSTEM', 'dark', 'dark'],
    ['SYSTEM', 'light', 'light'],
    ['SYSTEM', null, 'light'],
    ['LIGHT', 'dark', 'light'],
    ['DARK', 'light', 'dark'],
  ] as const)('modo %s com sistema %s → %s', (mode, system, expected) => {
    expect(resolveScheme(mode, system)).toBe(expected);
  });

  it('aplica a paleta e o modo da profissional com cores dos tokens', async () => {
    await render(
      <ThemeProvider palette="PASTEL_LILAC" mode="DARK">
        <Probe />
      </ThemeProvider>,
    );

    const primary = getTheme('PASTEL_LILAC', 'dark').colors.primary;
    expect(screen.getByText(`PASTEL_LILAC/dark/${primary}`)).toBeOnTheScreen();
  });
});
