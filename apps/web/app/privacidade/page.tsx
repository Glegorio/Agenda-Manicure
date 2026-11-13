import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Política de privacidade · Agende',
  description: 'Como seus dados são usados ao agendar um horário pelo Agende.',
};

/**
 * Q-33: texto provisório até a 8.5. A profissional é a controladora dos dados das clientes; o
 * Agende é operador (guarda e processa por conta dela).
 */
export default function PrivacyPage() {
  return (
    <main className={styles.main}>
      <h1>Política de privacidade</h1>
      <p>
        <strong>Versão provisória.</strong> Este texto será revisado antes do lançamento.
      </p>

      <h2>Quem cuida dos seus dados</h2>
      <p>
        Ao agendar, a profissional com quem você marcou o horário é a controladora dos seus dados: é
        ela quem decide como usá-los para o seu atendimento. O Agende é a plataforma que guarda e
        processa esses dados em nome dela.
      </p>

      <h2>O que coletamos</h2>
      <ul>
        <li>Nome e WhatsApp, para identificar você e falar sobre o horário.</li>
        <li>O serviço, o dia e o horário escolhidos.</li>
        <li>Observações, se você escrever alguma.</li>
      </ul>

      <h2>Informações de saúde</h2>
      <p>
        Se você contar algo sobre sua saúde nas observações (como uma alergia), essa informação é
        sensível. Ela só é enviada com a sua autorização e só é usada pela profissional no seu
        atendimento.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir à profissional para ver, corrigir ou apagar seus dados a qualquer momento.
      </p>
    </main>
  );
}
