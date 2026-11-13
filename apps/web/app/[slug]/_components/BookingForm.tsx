'use client';

import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import Link from 'next/link';
import type { BookingResponse } from '@agende/contracts';
import { formatBRL } from '@agende/money';
import { ApiError, type PublicClient } from '../../../lib/api/public-client';
import { formatCountdown, holdRemainingMs } from '../../../lib/countdown';
import { formatSlotLabel } from '../../../lib/datetime';
import { formatDuration } from '../../../lib/format';
import type { StoredHold } from '../../../lib/hold-storage';
import { formatBRPhoneInput, toE164BR } from '../../../lib/phone';
import styles from './BookingFlow.module.css';

export interface FormValues {
  name: string;
  phone: string;
  notes: string;
  consent: boolean;
}

export const EMPTY_FORM: FormValues = { name: '', phone: '', notes: '', consent: false };

export const HOLD_EXPIRED_MESSAGE =
  'O tempo para confirmar acabou e o horário foi liberado. Escolha o horário de novo.';
export const SLOT_TAKEN_MESSAGE =
  'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.';

const NOTES_MAX = 500;
const LAST_MINUTE_MS = 60_000;

type Field = 'name' | 'phone' | 'consent';
type Errors = Partial<Record<Field, string>>;

interface Props {
  slug: string;
  timezone: string;
  held: StoredHold;
  /** RN-92 / Q-35: exibida antes do CTA; `null` esconde a seção. */
  cancellationPolicy: string | null;
  api: PublicClient;
  values: FormValues;
  onChange: (values: FormValues) => void;
  /** Hold perdido (expirou ou horário tomado): volta à etapa 2 com a mensagem (RN-44). */
  onLost: (message: string) => void;
  onBooked: (booking: BookingResponse) => void;
  onChooseAnother: () => void;
}

function validate(values: FormValues): Errors {
  const errors: Errors = {};
  if (values.name.trim().length < 2) errors.name = 'Informe seu nome, com pelo menos 2 letras.';
  if (!toE164BR(values.phone)) errors.phone = 'Informe um WhatsApp válido com DDD.';
  if (values.notes.trim() && !values.consent) {
    errors.consent = 'Para enviar observações, marque a autorização.';
  }
  return errors;
}

/** Etapa 3: dados da cliente, contador do hold e confirmação (RN-43). */
export function BookingForm({
  slug,
  timezone,
  held,
  cancellationPolicy,
  api,
  values,
  onChange,
  onLost,
  onBooked,
  onChooseAnother,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    consent: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  // RN-44: hold no fim (relógio do servidor, com margem) → volta à etapa 2.
  const remaining = holdRemainingMs(held.expiresAt, held.serverOffsetMs, nowMs);
  const expired = remaining === 0;
  // Também reavalia quando um envio termina sem sucesso (rede/5xx) com o tempo já esgotado.
  useEffect(() => {
    if (expired && !submitting) onLost(HOLD_EXPIRED_MESSAGE);
  }, [expired, submitting, onLost]);

  const set = (patch: Partial<FormValues>) => {
    const next = { ...values, ...patch };
    // Q-34: consentimento é para as observações escritas; apagou, precisa autorizar de novo.
    if (!next.notes.trim()) next.consent = false;
    onChange(next);
    // Campo corrigido deixa de aparecer como inválido.
    const touched = new Set<string>(Object.keys(patch));
    if (Object.keys(errors).some((field) => touched.has(field))) {
      setErrors((current) =>
        Object.fromEntries(Object.entries(current).filter(([field]) => !touched.has(field))),
      );
    }
  };

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const found = validate(values);
    setErrors(found);
    setFormError(null);
    const first = (['name', 'phone', 'consent'] as const).find((field) => found[field]);
    if (first) {
      fieldRefs[first].current?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const notes = values.notes.trim();
    try {
      const booking = await api.createBooking(slug, {
        holdToken: held.holdToken,
        name: values.name.trim(),
        phone: toE164BR(values.phone) ?? '',
        ...(notes ? { notes } : {}),
      });
      onBooked(booking);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'HOLD_EXPIRED') onLost(HOLD_EXPIRED_MESSAGE);
      else if (e instanceof ApiError && e.code === 'SLOT_UNAVAILABLE') onLost(SLOT_TAKEN_MESSAGE);
      else {
        setFormError(
          e instanceof ApiError
            ? e.message
            : 'Não foi possível confirmar. Verifique a conexão e tente de novo.',
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const describedBy = (...ids: (string | false)[]) => ids.filter(Boolean).join(' ') || undefined;

  return (
    <form className={styles.section} onSubmit={(e) => void submit(e)} noValidate>
      <h2 id="held-title" ref={titleRef} tabIndex={-1} className={styles.title}>
        Horário reservado por 5 minutos
      </h2>
      <p role="timer" aria-live="off" className={styles.timer}>
        Confirme em até <strong>{formatCountdown(remaining)}</strong>
      </p>
      <p role="status" className={remaining < LAST_MINUTE_MS ? styles.notice : styles.liveEmpty}>
        {remaining < LAST_MINUTE_MS ? 'Falta menos de 1 minuto para confirmar.' : ''}
      </p>

      <dl className={styles.summary}>
        <dt>Serviço</dt>
        <dd>{held.serviceName}</dd>
        <dt>Quando</dt>
        <dd>{formatSlotLabel(held.startAt, timezone)}</dd>
        <dt>Duração</dt>
        <dd>{formatDuration(held.durationMin)}</dd>
        <dt>Valor</dt>
        <dd>{formatBRL(held.priceCents)}</dd>
      </dl>
      <button type="button" className={styles.secondary} onClick={onChooseAnother}>
        Escolher outro horário
      </button>

      <h2 className={styles.title}>Seus dados</h2>

      <div className={styles.field}>
        <label htmlFor="booking-name">Seu nome</label>
        <input
          id="booking-name"
          ref={fieldRefs.name}
          className={styles.input}
          value={values.name}
          onChange={(e) => {
            set({ name: e.target.value });
          }}
          autoComplete="name"
          autoCapitalize="words"
          required
          maxLength={80}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy(!!errors.name && 'booking-name-error')}
        />
        {errors.name && (
          <p id="booking-name-error" className={styles.fieldError}>
            {errors.name}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="booking-phone">WhatsApp (com DDD)</label>
        <input
          id="booking-phone"
          ref={fieldRefs.phone}
          className={styles.input}
          type="tel"
          inputMode="tel"
          // tel-national: a máscara é nacional; número colado com +55 também é aceito.
          autoComplete="tel-national"
          required
          placeholder="(11) 99999-8888"
          value={values.phone}
          onChange={(e) => {
            set({ phone: formatBRPhoneInput(e.target.value) });
          }}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={describedBy(
            'booking-phone-hint',
            !!errors.phone && 'booking-phone-error',
          )}
        />
        <p id="booking-phone-hint" className={styles.fieldHint}>
          Para a profissional falar com você sobre o horário.
        </p>
        {errors.phone && (
          <p id="booking-phone-error" className={styles.fieldError}>
            {errors.phone}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="booking-notes">Observações (opcional)</label>
        <textarea
          id="booking-notes"
          className={styles.input}
          rows={3}
          maxLength={NOTES_MAX}
          value={values.notes}
          onChange={(e) => {
            set({ notes: e.target.value });
          }}
          aria-describedby="booking-notes-hint booking-notes-count"
        />
        <p id="booking-notes-hint" className={styles.fieldHint}>
          Se contar algo sobre sua saúde (como alergias), essa informação só será usada pela
          profissional no seu atendimento.
        </p>
        <p id="booking-notes-count" className={styles.fieldHint}>
          {values.notes.length}/{NOTES_MAX}
        </p>
      </div>

      {/* Q-34: consentimento só quando há observações (podem conter dado de saúde, LGPD art. 11). */}
      {values.notes.trim() && (
        <div className={styles.checkboxField}>
          <input
            id="booking-consent"
            ref={fieldRefs.consent}
            type="checkbox"
            className={styles.checkbox}
            checked={values.consent}
            onChange={(e) => {
              set({ consent: e.target.checked });
            }}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={describedBy(!!errors.consent && 'booking-consent-error')}
          />
          <label htmlFor="booking-consent">
            Autorizo a profissional a usar estas observações, inclusive informações de saúde, só
            para o meu atendimento.
          </label>
          {errors.consent && (
            <p id="booking-consent-error" className={styles.fieldError}>
              {errors.consent}
            </p>
          )}
        </div>
      )}

      {cancellationPolicy && (
        <section aria-labelledby="policy-title" className={styles.policy}>
          <h3 id="policy-title" className={styles.subtitle}>
            Política de cancelamento
          </h3>
          <p className={styles.policyText}>{cancellationPolicy}</p>
        </section>
      )}

      <p className={styles.fieldHint}>
        Seus dados vão só para a profissional, que é a responsável por eles.
      </p>
      <p className={styles.fieldHint}>
        Veja a {/* Nova aba: a reserva continua correndo nesta. */}
        <Link className={styles.link} href="/privacidade" target="_blank" rel="noopener">
          política de privacidade (abre em nova aba)
        </Link>
        .
      </p>

      <p role="alert" className={formError ? styles.error : styles.liveEmpty}>
        {formError}
      </p>

      <div className={styles.bottomBar}>
        <button type="submit" className={styles.primary} disabled={submitting}>
          {submitting ? 'Confirmando…' : 'Confirmar agendamento'}
        </button>
      </div>
    </form>
  );
}
