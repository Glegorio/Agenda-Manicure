'use client';

import styles from './not-found.module.css';

/** Falha da API (5xx, rede): mensagem em PT-BR em vez da tela padrão do Next. */
export default function ProfileError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className={styles.main}>
      <h1>Não foi possível carregar a agenda</h1>
      <p>Verifique sua conexão e tente de novo em instantes.</p>
      <button type="button" onClick={reset}>
        Tentar de novo
      </button>
    </main>
  );
}
