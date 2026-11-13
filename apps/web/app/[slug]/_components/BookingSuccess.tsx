'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { BookingResponse } from '@agende/contracts';
import { formatBRL } from '@agende/money';
import { formatSlotLabel, formatTimeZoneName } from '../../../lib/datetime';
import { formatDuration } from '../../../lib/format';
import { buildIcs } from '../../../lib/ics';
import { buildConfirmationMessage, buildWhatsAppShareLink } from '../../../lib/whatsapp';
import styles from './BookingFlow.module.css';

interface Props {
  slug: string;
  /** Só o que o POST devolveu: não existe GET público da reserva (privacidade). */
  booking: BookingResponse;
  clientName: string;
  /** Q-27: endereço completo só com opt-in; senão cidade/UF; `null` se nada publicado. */
  location: string | null;
  /** RN-02a: navegador em outro fuso → mostra o fuso da profissional junto do horário. */
  showTimezone?: boolean;
}

/** Tela de sucesso: resumo, confirmação pelo WhatsApp (Q-32) e .ics. */
export function BookingSuccess({
  slug,
  booking,
  clientName,
  location,
  showTimezone = false,
}: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const whatsappLink = buildWhatsAppShareLink(
    buildConfirmationMessage({ ...booking, clientName, location }),
  );

  function downloadIcs() {
    const ics = buildIcs({
      uid: booking.appointmentId,
      startAt: booking.startAt,
      endAt: booking.endAt,
      summary: `${booking.serviceName} — ${booking.businessName}`,
      location,
      description: `Valor: ${formatBRL(booking.priceCents)}`,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'agendamento.ics';
    // Anexada ao DOM e URL revogada depois: alguns navegadores móveis cancelam o download senão.
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    setDownloaded(true);
  }

  return (
    <section className={styles.section} aria-labelledby="booked-title">
      <h2 id="booked-title" ref={titleRef} tabIndex={-1} className={styles.title}>
        <span aria-hidden="true">✓ </span>
        Agendamento confirmado!
      </h2>
      <p className={styles.notice}>Guarde estas informações. Te esperamos!</p>

      <dl className={styles.summary}>
        <dt>Serviço</dt>
        <dd>{booking.serviceName}</dd>
        <dt>Quando</dt>
        <dd>
          {formatSlotLabel(booking.startAt, booking.timezone)}
          {showTimezone && ` (${formatTimeZoneName(booking.timezone)})`}
        </dd>
        <dt>Duração</dt>
        <dd>{formatDuration(booking.durationMin)}</dd>
        <dt>Valor</dt>
        <dd>{formatBRL(booking.priceCents)}</dd>
        <dt>Profissional</dt>
        <dd>{booking.businessName}</dd>
        {location && (
          <>
            <dt>Onde</dt>
            <dd>{location}</dd>
          </>
        )}
      </dl>

      <button type="button" className={styles.secondary} onClick={downloadIcs}>
        Adicionar ao calendário
      </button>
      <p role="status" className={downloaded ? styles.notice : styles.liveEmpty}>
        {downloaded ? 'Arquivo agendamento.ics baixado. Abra-o para salvar na sua agenda.' : ''}
      </p>
      <Link className={styles.link} href={`/${slug}`}>
        Agendar outro horário
      </Link>

      <div className={styles.bottomBar}>
        <a
          className={styles.primaryLink}
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Enviar confirmação pelo WhatsApp
          <span className={styles.liveEmpty}> (abre em nova aba)</span>
        </a>
      </div>
    </section>
  );
}
