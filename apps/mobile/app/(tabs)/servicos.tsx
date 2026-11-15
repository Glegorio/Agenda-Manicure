import { Text } from 'react-native';
import { fontSize } from '@agende/ui-tokens';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function ServicesScreen() {
  const { colors } = useTheme();
  return (
    <Screen title="Serviços">
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>
        Seus serviços e preços chegam na 4.3.
      </Text>
    </Screen>
  );
}
