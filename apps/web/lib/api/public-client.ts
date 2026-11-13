// Só tipos de @agende/contracts: importar valores traria o Zod para o bundle do cliente.
import type {
  AvailabilityDaysResponse,
  AvailabilityResponse,
  BookingResponse,
  CreateBooking,
  ErrorResponse,
  HoldResponse,
} from '@agende/contracts';

/** Erro da API com o código do envelope (doc 05). `UNKNOWN` quando não há envelope. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterS: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const GENERIC_MESSAGE = 'Não foi possível falar com a agenda. Tente de novo.';

async function toApiError(response: Response): Promise<ApiError> {
  const retryAfter = Number(response.headers.get('retry-after'));
  const retryAfterS = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null;
  try {
    const { error } = (await response.json()) as ErrorResponse;
    return new ApiError(response.status, error.code, error.message, retryAfterS);
  } catch {
    return new ApiError(response.status, 'UNKNOWN', GENERIC_MESSAGE, retryAfterS);
  }
}

/** Funções soltas (sem `this`): podem ser passadas adiante sem perder o objeto. */
export interface PublicClient {
  availabilityDays: (
    slug: string,
    serviceId: string,
    from: string,
    to: string,
  ) => Promise<AvailabilityDaysResponse>;
  availability: (slug: string, serviceId: string, date: string) => Promise<AvailabilityResponse>;
  createHold: (
    slug: string,
    serviceId: string,
    startAt: string,
  ) => Promise<{ hold: HoldResponse; serverDate: Date | null }>;
  releaseHold: (slug: string, holdToken: string) => Promise<void>;
  /** RN-43: confirma o hold. 410 se expirou (RN-44), 409 se a constraint barrar (RN-42). */
  createBooking: (slug: string, input: CreateBooking) => Promise<BookingResponse>;
}

/** Cliente da API pública chamado do navegador (CORS, Q-39). Horários nunca vêm de cache. */
export function createPublicClient(baseUrl: string, fetchImpl: typeof fetch = fetch): PublicClient {
  const enc = encodeURIComponent;
  const get = async <T>(path: string, params: Record<string, string>): Promise<T> => {
    const query = new URLSearchParams(params).toString();
    const response = await fetchImpl(`${baseUrl}${path}?${query}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as T;
  };

  return {
    availabilityDays: (slug, serviceId, from, to) =>
      get(`/public/${enc(slug)}/availability/days`, { serviceId, from, to }),
    availability: (slug, serviceId, date) =>
      get(`/public/${enc(slug)}/availability`, { serviceId, date }),

    async createHold(slug, serviceId, startAt) {
      const response = await fetchImpl(`${baseUrl}/public/${enc(slug)}/holds`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ serviceId, startAt }),
      });
      if (!response.ok) throw await toApiError(response);
      const date = response.headers.get('date');
      const hold = (await response.json()) as HoldResponse;
      return { hold, serverDate: date ? new Date(date) : null };
    },

    async releaseHold(slug, holdToken) {
      // keepalive: a requisição não é cancelada se a página navegar logo em seguida.
      await fetchImpl(`${baseUrl}/public/${enc(slug)}/holds/${enc(holdToken)}`, {
        method: 'DELETE',
        keepalive: true,
      });
    },

    async createBooking(slug, input) {
      const response = await fetchImpl(`${baseUrl}/public/${enc(slug)}/bookings`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await toApiError(response);
      return (await response.json()) as BookingResponse;
    },
  };
}
