'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookingResponse } from '@agende/contracts';
import { formatBRL } from '@agende/money';
import { ApiError, createPublicClient, type PublicClient } from '../../../lib/api/public-client';
import {
  addDays,
  addMonths,
  browserTimeZone as detectBrowserTimeZone,
  formatDateLabel,
  formatMonthLabel,
  formatSlotLabel,
  formatSlotTime,
  formatTimeZoneName,
  lastDayOfMonth,
  monthGrid,
  shouldShowTimezone,
  todayIn,
} from '../../../lib/datetime';
import { publicApiBaseUrl } from '../../../lib/env';
import { formatDuration } from '../../../lib/format';
import { clearHold, loadHold, saveHold, type StoredHold } from '../../../lib/hold-storage';
import styles from './BookingFlow.module.css';
import { BookingSuccess } from './BookingSuccess';
import { BookingForm, EMPTY_FORM, SLOT_TAKEN_MESSAGE, type FormValues } from './BookingForm';

interface Service {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
}

interface Props {
  slug: string;
  /** RN-02a: fuso da profissional. */
  timezone: string;
  service: Service;
  /** `?date=` da URL. */
  initialDate?: string | undefined;
  /** `?slot=` da URL: com hold válido na sessão, mostra o horário reservado. */
  initialSlot?: string | undefined;
  api?: PublicClient | undefined;
  /** Injetável para teste; padrão: fuso do navegador. */
  browserTimeZone?: string | undefined;
  /** RN-92 / Q-35: exibida na etapa 3; `null` esconde a seção. */
  cancellationPolicy?: string | null | undefined;
  /** Q-27: local publicado (endereço completo ou cidade/UF), para a confirmação. */
  location?: string | null | undefined;
  /** RN-25 / Q-42: até quantos dias à frente há agenda (limita a navegação do calendário). */
  bookingHorizonDays?: number | undefined;
}

/** Resultado de uma consulta, indexado por ela: consulta nova = carregando, sem setState no effect. */
type Result<T> = { key: string; data: T } | { key: string; error: string };

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NETWORK_ERROR = 'Não foi possível falar com a agenda. Verifique a conexão e tente de novo.';

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR;
  if (error.code === 'RATE_LIMITED' && error.retryAfterS) {
    return `${error.message} Tente de novo em ${String(error.retryAfterS)} segundos.`;
  }
  return error.message;
}

function isValidHold(hold: StoredHold | null, startAt: string | undefined, serviceId: string) {
  return (
    hold !== null &&
    hold.startAt === startAt &&
    hold.serviceId === serviceId &&
    Date.parse(hold.expiresAt) > Date.now() + hold.serverOffsetMs
  );
}

/** Etapa 2: dia com vaga → horário → hold de 5 minutos (RN-40). Disponibilidade só da API. */
export function BookingFlow({
  slug,
  timezone,
  service,
  initialDate,
  initialSlot,
  api: injectedApi,
  browserTimeZone,
  cancellationPolicy = null,
  location = null,
  bookingHorizonDays = 30,
}: Props) {
  const api = useMemo(() => injectedApi ?? createPublicClient(publicApiBaseUrl()), [injectedApi]);

  // Só renderiza no navegador (BookingFlowLoader, ssr: false): relógio, fuso e sessionStorage
  // podem ser lidos já no estado inicial, sem mismatch de hidratação.
  const [today] = useState(() => todayIn(timezone));
  // Data da URL no passado (ou de outro dia que já virou) é ignorada.
  const [date, setDate] = useState<string | null>(() =>
    initialDate && initialDate >= today ? initialDate : null,
  );
  const [month, setMonth] = useState(() => (date ?? today).slice(0, 7));
  const [daysVersion, setDaysVersion] = useState(0);
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTz] = useState(() =>
    shouldShowTimezone(timezone, browserTimeZone ?? detectBrowserTimeZone()),
  );
  const [held, setHeld] = useState<StoredHold | null>(() => {
    const stored = loadHold(slug);
    return isValidHold(stored, initialSlot, service.id) ? stored : null;
  });

  // Dados digitados sobrevivem à volta para a etapa 2 (RN-44: hold expirado, novo horário);
  // ficam só em memória, nunca na sessionStorage.
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [booked, setBooked] = useState<BookingResponse | null>(null);

  const alertRef = useRef<HTMLParagraphElement>(null);
  const dateTitleRef = useRef<HTMLHeadingElement>(null);
  const focusAfterHold = useRef<'date' | 'alert' | null>(null);

  const daysFrom = `${month}-01` < today ? today : `${month}-01`;
  const daysKey = `${daysFrom}/${lastDayOfMonth(month)}#${String(daysVersion)}`;
  const [daysResult, setDaysResult] = useState<Result<Set<string>> | null>(null);
  // Mês inteiro no passado: nada a consultar.
  const noDaysToFetch = daysFrom > lastDayOfMonth(month);
  const days: Result<Set<string>> | null = noDaysToFetch
    ? { key: daysKey, data: new Set() }
    : daysResult?.key === daysKey
      ? daysResult
      : null;

  const slotsKey = date ? `${date}#${String(slotsVersion)}` : null;
  const [slotsResult, setSlotsResult] = useState<Result<string[]> | null>(null);
  const slots = slotsResult && slotsResult.key === slotsKey ? slotsResult : null;

  useEffect(() => {
    if (noDaysToFetch) return;
    const [from = '', to = ''] = daysKey.split('#')[0]?.split('/') ?? [];
    let active = true;
    api
      .availabilityDays(slug, service.id, from, to)
      .then((res) => {
        if (active) setDaysResult({ key: daysKey, data: new Set(res.days) });
      })
      .catch((e: unknown) => {
        if (active) setDaysResult({ key: daysKey, error: errorMessage(e) });
      });
    return () => {
      active = false;
    };
  }, [api, slug, service.id, daysKey, noDaysToFetch]);

  useEffect(() => {
    if (!slotsKey) return;
    const [day = ''] = slotsKey.split('#');
    let active = true;
    api
      .availability(slug, service.id, day)
      .then((res) => {
        if (active) setSlotsResult({ key: slotsKey, data: res.slots });
      })
      .catch((e: unknown) => {
        if (active) setSlotsResult({ key: slotsKey, error: errorMessage(e) });
      });
    return () => {
      active = false;
    };
  }, [api, slug, service.id, slotsKey]);

  // Foco acompanha a mudança de tela (o formulário foca o próprio título).
  useEffect(() => {
    if (held) return;
    const target = focusAfterHold.current;
    focusAfterHold.current = null;
    if (target === 'date') dateTitleRef.current?.focus();
    if (target === 'alert') alertRef.current?.focus();
  }, [held]);

  // Voltar/avançar do navegador: a tela segue a URL; sair da etapa 3 libera o hold.
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const urlDate = params.get('date');
      setDate(urlDate && urlDate >= today ? urlDate : null);
      setSelected(null);
      setActionError(null);
      const stored = loadHold(slug);
      if (isValidHold(stored, params.get('slot') ?? undefined, service.id)) {
        setHeld(stored);
      } else {
        setHeld(null);
        if (stored) {
          clearHold(slug);
          void api.releaseHold(slug, stored.holdToken).catch(() => undefined);
        }
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [api, slug, service.id, today]);

  /**
   * Estado do fluxo na URL (`?service=&date=&slot=`) pela History API: o Next sincroniza a rota sem
   * nova ida ao servidor a cada clique (o perfil já está na página).
   */
  const urlFor = (extra: Record<string, string> = {}) =>
    `/${slug}?${new URLSearchParams({ service: service.id, ...extra }).toString()}`;

  function chooseDate(day: string) {
    setDate(day);
    setSelected(null);
    setActionError(null);
    window.history.replaceState(null, '', urlFor({ date: day }));
  }

  async function confirmSlot() {
    if (!selected || !date) return;
    setSubmitting(true);
    setActionError(null);
    const previous = loadHold(slug);
    // Mesmo horário com o hold desta sessão ainda válido (ex.: recarregou a página na etapa 2):
    // reaproveita, em vez de liberar e pedir de novo. Se uma liberação anterior falhou, o hold já
    // saiu da sessão e o novo pedido pode dar 409 até ele expirar (RN-46).
    if (previous && isValidHold(previous, selected, service.id)) {
      setSubmitting(false);
      setHeld(previous);
      window.history.pushState(null, '', urlFor({ date, slot: previous.startAt }));
      return;
    }
    if (previous) {
      clearHold(slug);
      await api.releaseHold(slug, previous.holdToken).catch(() => undefined);
    }
    try {
      const { hold, serverDate } = await api.createHold(slug, service.id, selected);
      const stored: StoredHold = {
        ...hold,
        serviceId: service.id,
        serverOffsetMs: serverDate ? serverDate.getTime() - Date.now() : 0,
      };
      saveHold(slug, stored);
      setHeld(stored);
      window.history.pushState(null, '', urlFor({ date, slot: hold.startAt }));
    } catch (e) {
      const takenNow = e instanceof ApiError && e.code === 'SLOT_UNAVAILABLE';
      setActionError(takenNow ? SLOT_TAKEN_MESSAGE : errorMessage(e));
      if (takenNow) {
        setSelected(null);
        setSlotsVersion((v) => v + 1);
      }
      alertRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  async function chooseAnotherSlot() {
    if (held) {
      clearHold(slug);
      await api.releaseHold(slug, held.holdToken).catch(() => undefined);
    }
    focusAfterHold.current = 'date';
    setHeld(null);
    setSelected(null);
    setSlotsVersion((v) => v + 1);
    window.history.replaceState(null, '', urlFor(date ? { date } : {}));
  }

  /** Hold perdido na etapa 3 (expirou, 410 ou 409): volta à etapa 2 com aviso e grade nova. */
  const holdLost = useCallback(
    (message: string) => {
      const stored = loadHold(slug);
      clearHold(slug);
      // 409 mantém o hold no banco até expirar (rollback): libera para não travar o horário.
      if (stored) void api.releaseHold(slug, stored.holdToken).catch(() => undefined);
      focusAfterHold.current = 'alert';
      setHeld(null);
      setSelected(null);
      setActionError(message);
      setSlotsVersion((v) => v + 1);
      window.history.replaceState(null, '', urlFor(date ? { date } : {}));
    },
    // urlFor depende só de slug e service.id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, slug, service.id, date],
  );

  function handleBooked(booking: BookingResponse) {
    clearHold(slug);
    setBooked(booking);
  }

  if (booked) {
    return (
      <BookingSuccess
        slug={slug}
        booking={booked}
        clientName={formValues.name.trim()}
        location={location}
        showTimezone={showTz}
      />
    );
  }

  if (held) {
    return (
      <BookingForm
        slug={slug}
        timezone={timezone}
        held={held}
        cancellationPolicy={cancellationPolicy}
        api={api}
        values={formValues}
        onChange={setFormValues}
        onLost={holdLost}
        onBooked={handleBooked}
        onChooseAnother={() => void chooseAnotherSlot()}
      />
    );
  }

  const thisMonth = today.slice(0, 7);
  const daysLoading = days === null;
  const status =
    daysLoading && !date
      ? 'Carregando dias disponíveis…'
      : date && slots === null
        ? 'Carregando horários…'
        : slots && 'data' in slots && slots.data.length === 0
          ? 'Não há mais horários neste dia. Escolha outro dia.'
          : '';

  return (
    <section className={styles.section} aria-labelledby="date-title">
      <p className={styles.service}>
        {service.name} · {formatDuration(service.durationMin)} · {formatBRL(service.priceCents)}
      </p>
      <a
        className={styles.link}
        href={`/${slug}`}
        onClick={() => {
          // Sair do fluxo não pode deixar um hold preso até expirar.
          const stored = loadHold(slug);
          if (stored) {
            clearHold(slug);
            void api.releaseHold(slug, stored.holdToken).catch(() => undefined);
          }
        }}
      >
        Trocar serviço
      </a>

      <h2 id="date-title" ref={dateTitleRef} tabIndex={-1} className={styles.title}>
        Escolha o dia
      </h2>

      {showTz && (
        <p className={styles.notice} data-testid="timezone-notice">
          Horários no fuso da profissional: {formatTimeZoneName(timezone)} ({timezone}).
        </p>
      )}

      {/* Regiões vivas sempre montadas: só o texto muda, para o leitor de tela anunciar. */}
      <p
        role="alert"
        ref={alertRef}
        tabIndex={-1}
        className={actionError ? styles.error : styles.liveEmpty}
      >
        {actionError}
      </p>
      <p role="status" className={status ? styles.notice : styles.liveEmpty}>
        {status}
      </p>

      <div className={styles.calendar}>
        <div className={styles.monthNav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => {
              setMonth(addMonths(month, -1));
            }}
            disabled={month <= thisMonth}
            aria-label="Mês anterior"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <p id="month-label" className={styles.monthLabel} aria-live="polite">
            {formatMonthLabel(month)}
          </p>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => {
              setMonth(addMonths(month, 1));
            }}
            disabled={month >= addDays(today, bookingHorizonDays).slice(0, 7)}
            aria-label="Próximo mês"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div
          role="group"
          aria-labelledby="month-label"
          className={styles.days}
          aria-busy={daysLoading}
        >
          {monthGrid(month).map((day, i) => {
            if (!day) return <span key={`blank-${String(i)}`} />;
            const available = days !== null && 'data' in days && days.data.has(day);
            return (
              <button
                key={day}
                type="button"
                className={styles.day}
                aria-label={
                  available || daysLoading
                    ? formatDateLabel(day)
                    : `${formatDateLabel(day)}, sem horários`
                }
                aria-pressed={day === date}
                disabled={!available}
                onClick={() => {
                  chooseDate(day);
                }}
              >
                {Number(day.slice(8))}
              </button>
            );
          })}
        </div>
        {days && 'error' in days && (
          <RetryNotice
            message={days.error}
            onRetry={() => {
              setDaysVersion((v) => v + 1);
            }}
          />
        )}
      </div>

      {date && (
        <>
          <h2 className={styles.title}>Escolha o horário</h2>
          {slots && 'error' in slots && (
            <RetryNotice
              message={slots.error}
              onRetry={() => {
                setSlotsVersion((v) => v + 1);
              }}
            />
          )}
          {slots && 'data' in slots && slots.data.length > 0 && (
            <div
              role="group"
              aria-label={`Horários disponíveis em ${formatDateLabel(date)}`}
              className={styles.slots}
            >
              {slots.data.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={styles.slot}
                  aria-label={formatSlotLabel(slot, timezone)}
                  aria-pressed={slot === selected}
                  onClick={() => {
                    setSelected(slot);
                  }}
                >
                  {formatSlotTime(slot, timezone)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className={styles.bottomBar}>
        {!selected && (
          <p id="cta-hint" className={styles.hint}>
            Escolha um dia e um horário.
          </p>
        )}
        <button
          type="button"
          className={styles.primary}
          disabled={!selected || submitting}
          aria-describedby={selected ? undefined : 'cta-hint'}
          onClick={() => void confirmSlot()}
        >
          {submitting ? 'Reservando…' : 'Continuar'}
        </button>
      </div>
    </section>
  );
}

function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.retry}>
      <p className={styles.notice}>{message}</p>
      <button type="button" className={styles.secondary} onClick={onRetry}>
        Tentar de novo
      </button>
    </div>
  );
}
