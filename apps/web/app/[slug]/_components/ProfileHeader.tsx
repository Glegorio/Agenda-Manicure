import type { PublicProfileResponse } from '@agende/contracts';
import styles from './ProfileHeader.module.css';

type Address = Pick<PublicProfileResponse, 'addressLine' | 'city' | 'state'>;

/** Q-27: endereço completo só com opt-in (`addressLine` preenchido); senão cidade e UF. */
export function formatLocation({ addressLine, city, state }: Address): string | null {
  const cityState = [city, state].filter(Boolean).join(' – ');
  const parts = [addressLine, cityState].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function ProfileHeader({ businessName, ...address }: Address & { businessName: string }) {
  const location = formatLocation(address);
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{businessName}</h1>
      {location && (
        <p className={styles.location} data-testid="profile-location">
          {location}
        </p>
      )}
    </header>
  );
}
