import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontSize, space } from '@agende/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';

interface ScreenProps {
  title: string;
  children?: ReactNode;
  /** Rodapé fixo (ex.: `BottomActionBar`), fora da rolagem. */
  footer?: ReactNode;
}

/** Tela base: fundo do tema, título como cabeçalho e rolagem (fonte do sistema até 200%). */
export function Screen({ title, children, footer }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={footer ? ['top'] : ['top', 'bottom']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* O rodapé sobe com o teclado: o CTA nunca fica escondido (iOS; o Android já redimensiona). */}
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, padding: space[4], gap: space[4] },
  title: { fontSize: fontSize.xxl, fontWeight: '700' },
});
