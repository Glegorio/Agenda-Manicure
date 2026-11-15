import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CalendarDays, Scissors, Settings, Users, type LucideIcon } from 'lucide-react-native';
import { fontSize, touchTarget } from '@agende/ui-tokens';
import { useTheme } from '../../src/theme/ThemeProvider';

function tabIcon(Icon: LucideIcon) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon color={color} size={24} strokeWidth={1.75} />;
  };
}

/** Navegação principal por tabs inferiores (doc 07, thumb zone). */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarItemStyle: { minHeight: touchTarget },
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
