import { ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// TODO 4.1: substituir por tokens de packages/ui-tokens. Pares com contraste ≥ 4.5:1.
const placeholderColors = {
  light: { background: '#FFFFFF', text: '#1F1F1F' },
  dark: { background: '#121212', text: '#F2F2F2' },
} as const;

export default function HomeScreen() {
  const colors = placeholderColors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Rolagem garante leitura com fonte do sistema ampliada (até 200%). */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Agende
        </Text>
        <Text style={[styles.subtitle, { color: colors.text }]}>
          Sua agenda, seus clientes e seu caixa em um só lugar.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { marginTop: 8, fontSize: 16, textAlign: 'center' },
});
