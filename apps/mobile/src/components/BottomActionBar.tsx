import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '@agende/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';

/** Thumb zone (doc 07): CTA primário fixo no rodapé, respeitando a safe area. */
export function BottomActionBar({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, space[4]),
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space[4],
    paddingTop: space[3],
    gap: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
