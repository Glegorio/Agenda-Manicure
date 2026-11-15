import { useQuery } from '@tanstack/react-query';
import { professionalProfileSchema } from '@agende/contracts';
import { useAuth } from '../auth/AuthProvider';

export const queryKeys = {
  me: ['me'] as const,
};

/** Perfil da profissional (`GET /v1/me`): tema, fuso e parâmetros da agenda. */
export function useProfile() {
  const { api, status } = useAuth();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get('/me', professionalProfileSchema),
    enabled: status === 'signedIn',
  });
}
