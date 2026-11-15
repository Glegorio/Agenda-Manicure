import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CalendarDays, Scissors, Settings, Users, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize, space } from '@agende/ui-tokens';
import { useTheme } from '../../src/theme/ThemeProvider';

function tabIcon(Icon: LucideIcon) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon color={color} size={24} strokeWidth={1.75} />;
  };
}

/** Navegação principal por tabs inferiores (doc 07, thumb zone). */
export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        // A altura padrão (49) corta o rótulo de 14 px (mínimo do doc 07); a altura própria
        // substitui a do navegador, então a safe area entra aqui.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64 + insets.bottom,
          paddingTop: space[1],
        },
        tabBarLabelStyle: { fontSize: fontSize.sm },
      }}
      screenListeners={{ tabPress: () => void Haptics.selectionAsync() }}
    >
      <Tabs.Screen name="index" options={{ title: 'Agenda', tabBarIcon: tabIcon(CalendarDays) }} />
      <Tabs.Screen name="clientes" options={{ title: 'Clientes', tabBarIcon: tabIcon(Users) }} />
      <Tabs.Screen name="servicos" options={{ title: 'Serviços', tabBarIcon: tabIcon(Scissors) }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: tabIcon(Settings) }} />
    </Tabs>
  );
}
