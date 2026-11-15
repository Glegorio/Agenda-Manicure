import { useState } from 'react';
import { Text } from 'react-native';
import { fontSize } from '@agende/ui-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function SettingsScreen() {
  const { session, logout } = useAuth();
  const { colors } = useTheme();
  const [leaving, setLeaving] = useState(false);

  return (
    <Screen title="Ajustes">
      <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg }}>
        {session?.professional.businessName}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>
        {session?.professional.email}
      </Text>
      {/* Ação destrutiva fora do rodapé, longe de um CTA primário (doc 07). */}
      <Button
        label="Sair da conta"
        variant="secondary"
        loading={leaving}
        onPress={() => {
          setLeaving(true);
          void logout().finally(() => {
            setLeaving(false);
          });
        }}
      />
    </Screen>
  );
}
