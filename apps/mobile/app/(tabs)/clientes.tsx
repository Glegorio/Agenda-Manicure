import { Text } from 'react-native';
import { fontSize } from '@agende/ui-tokens';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function ClientsScreen() {
  const { colors } = useTheme();
  return (
    <Screen title="Clientes">
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>
        Lista, busca e importação de contatos chegam na 4.7.
      </Text>
    </Screen>
  );
}
