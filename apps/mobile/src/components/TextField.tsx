import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { fontSize, radius, space, touchTarget } from '@agende/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | undefined;
}

/** Campo com rótulo visível e erro anunciado ao leitor de tela. */
export function TextField({ label, error, ...input }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
        {...input}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[1] },
  label: { fontSize: fontSize.md, fontWeight: '600' },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    fontSize: fontSize.md,
  },
  error: { fontSize: fontSize.sm },
});
