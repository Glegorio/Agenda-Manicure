import { authSessionResponseSchema, type AuthSessionResponse } from '@agende/contracts';

/** Chave única no SecureStore (regra mobile: nada sensível em AsyncStorage). */
export const SESSION_KEY = 'agende.session';

/** `fetch` do React Native não tem timeout: um refresh pendurado travaria todos os pedidos. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Sinal que aborta após o timeout (AbortController + setTimeout: não depende do Hermes ter `AbortSignal.timeout`). */
export function timeoutSignal(ms = REQUEST_TIMEOUT_MS): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
  }, ms);
  return controller.signal;
}

/** Subconjunto do `expo-secure-store` usado aqui; injetável nos testes. */
export interface SecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
export type Session = AuthSessionResponse;
type Listener = (session: Session | null) => void;

interface SessionManagerOptions {
  baseUrl: string;
  fetch: FetchFn;
  storage: SecureStorage;
}

/**
 * Dona dos tokens da profissional: persiste no SecureStore e renova o access com o refresh.
 * A renovação é *single-flight*: pedidos simultâneos esperam a mesma chamada, porque o refresh
 * tem rotação e reusar um já trocado encerra a sessão (ADR-0009).
 */
export class SessionManager {
  #current: Session | null = null;
  #refreshing: Promise<string | null> | null = null;
  readonly #listeners = new Set<Listener>();
  readonly #options: SessionManagerOptions;

  constructor(options: SessionManagerOptions) {
    this.#options = options;
  }

  get current(): Session | null {
    return this.#current;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async load(): Promise<Session | null> {
    const raw = await this.#options.storage.getItemAsync(SESSION_KEY);
    const parsed = raw === null ? null : authSessionResponseSchema.safeParse(safeJson(raw));
    if (parsed?.success) {
      this.#current = parsed.data;
    } else {
      this.#current = null;
      if (raw !== null) await this.#options.storage.deleteItemAsync(SESSION_KEY);
    }
    this.#emit();
    return this.#current;
  }

  /**
   * Memória primeiro: o refresh já rotacionou no servidor, e perder o par novo por uma falha do
   * SecureStore faria o próximo refresh reusar o antigo e derrubar a família (ADR-0009).
   */
  async set(session: Session): Promise<void> {
    this.#current = session;
    this.#emit();
    await this.#options.storage.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }

  async clear(): Promise<void> {
    this.#current = null;
    this.#emit();
    await this.#options.storage.deleteItemAsync(SESSION_KEY);
  }

  /**
   * Novo access token, ou `null` se a API recusou o refresh (sessão encerrada).
   * Falha de rede propaga sem apagar a sessão: a próxima tentativa pode dar certo.
   */
  refresh(): Promise<string | null> {
    this.#refreshing ??= this.#doRefresh().finally(() => {
      this.#refreshing = null;
    });
    return this.#refreshing;
  }

  async #doRefresh(): Promise<string | null> {
    const refreshToken = this.#current?.refreshToken;
    if (!refreshToken) return null;

    const response = await this.#options.fetch(`${this.#options.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: timeoutSignal(),
    });
    // Logout (ou outra sessão) enquanto o pedido estava no ar: não ressuscita a sessão antiga.
    if (this.#replaced(refreshToken)) return this.#current?.accessToken ?? null;
    // Só 401 encerra a sessão; 429/5xx propagam e mantêm a sessão para tentar de novo.
    if (response.status === 401) {
      await this.clear();
      return null;
    }
    if (!response.ok) throw new Error(`Refresh falhou com status ${String(response.status)}`);

    const session = authSessionResponseSchema.parse(await response.json());
    if (this.#replaced(refreshToken)) return this.#current?.accessToken ?? null;
    await this.set(session);
    return session.accessToken;
  }

  /**
   * Limpa a sessão local primeiro (uma rede pendurada não pode deixar o aparelho logado) e depois
   * revoga o refresh na API, em melhor esforço.
   */
  async logout(): Promise<void> {
    const refreshToken = this.#current?.refreshToken;
    await this.clear();
    if (!refreshToken) return;
    try {
      await this.#options.fetch(`${this.#options.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: timeoutSignal(),
      });
    } catch {
      // Sem rede: o refresh expira sozinho em 30 dias (Q-22).
    }
  }

  /** A sessão mudou (logout, outro login) desde que o refresh saiu com `refreshToken`. */
  #replaced(refreshToken: string): boolean {
    return this.#current?.refreshToken !== refreshToken;
  }

  #emit(): void {
    for (const listener of this.#listeners) listener(this.#current);
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
