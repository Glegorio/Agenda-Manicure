import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { loginRequestSchema, registerRequestSchema } from '@agende/contracts';
import { fontSize, space, touchTarget } from '@agende/ui-tokens';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { BottomActionBar } from '../components/BottomActionBar';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { useTheme } from '../theme/ThemeProvider';

type Mode = 'login' | 'register';
type Field = 'businessName' | 'email' | 'password';

const COPY = {
  login: {
    title: 'Entrar',
    cta: 'Entrar',
    switchLabel: 'Ainda não tem conta? Criar conta',
    switchHref: '/register',
  },
  register: {
    title: 'Criar conta',
    cta: 'Criar conta',
    switchLabel: 'Já tem conta? Entrar',
    switchHref: '/login',
  },
} as const;

/** Login e cadastro da profissional (Q-05: e-mail + senha; slug fica para o onboarding, Q-21). */
export function AuthForm({ mode }: { mode: Mode }) {
  const { login, register } = useAuth();
  const { colors } = useTheme();
  const copy = COPY[mode];
  const [values, setValues] = useState({ businessName: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const change = (field: Field) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
  };

  async function submit() {
    setFormError(null);
    const parsed =
      mode === 'login'
        ? loginRequestSchema.safeParse({ email: values.email, password: values.password })
        : registerRequestSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      if (mode === 'register') await register(registerRequestSchema.parse(values));
      else await login(parsed.data);
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFormError(error instanceof ApiError ? error.message : 'Não foi possível continuar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      title={copy.title}
      footer={
        <BottomActionBar>
          <Button label={copy.cta} onPress={() => void submit()} loading={submitting} />
        </BottomActionBar>
      }
    >
      {mode === 'register' ? (
        <TextField
          label="Nome do seu negócio"
          value={values.businessName}
          onChangeText={change('businessName')}
          autoComplete="organization"
          textContentType="organizationName"
          error={errors.businessName}
        />
      ) : null}
      <TextField
        label="E-mail"
        value={values.email}
        onChangeText={change('email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={errors.email}
      />
      <TextField
        label="Senha"
        value={values.password}
        onChangeText={change('password')}
        secureTextEntry
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        textContentType={mode === 'login' ? 'password' : 'newPassword'}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        error={errors.password}
      />
      {formError ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.formError, { color: colors.danger }]}
        >
          {formError}
        </Text>
      ) : null}
      <Link
        href={copy.switchHref}
        replace
        accessibilityRole="link"
        style={[styles.link, { color: colors.primary }]}
      >
        {copy.switchLabel}
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formError: { fontSize: fontSize.md },
  link: {
    fontSize: fontSize.md,
    fontWeight: '600',
    minHeight: touchTarget,
    textAlignVertical: 'center',
    paddingVertical: space[3],
  },
});
