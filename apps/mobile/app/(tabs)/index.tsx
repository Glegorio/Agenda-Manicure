import { Text } from 'react-native';
import { fontSize } from '@agende/ui-tokens';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function AgendaScreen() {
  const { colors } = useTheme();
  return (
    <Screen title="Agenda">
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>
        A agenda do dia e da semana chega na 4.5.
      </Text>
    </Screen>
  );
}
