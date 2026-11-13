'use client';

import dynamic from 'next/dynamic';
import styles from './BookingFlow.module.css';

/**
 * Etapas 2 e 3 só no navegador: dependem do relógio, do fuso e da sessionStorage da cliente.
 * Também mantém o JS do fluxo fora da etapa 1.
 */
export const BookingFlowLoader = dynamic(() => import('./BookingFlow').then((m) => m.BookingFlow), {
  ssr: false,
  loading: () => (
    <p className={styles.notice} aria-live="polite">
      Carregando agenda…
    </p>
  ),
});
