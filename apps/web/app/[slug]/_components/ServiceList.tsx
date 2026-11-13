import Link from 'next/link';
import type { PublicServiceItem } from '@agende/contracts';
import { formatBRL } from '@agende/money';
import { formatDuration } from '../../../lib/format';
import styles from './ServiceList.module.css';

interface Props {
  slug: string;
  /** Já filtrados pela API (RN-91: `active && public`), na ordem dela. */
  services: PublicServiceItem[];
}

/** Etapa 1: escolha do serviço. Cada card leva à etapa 2 com `?service=<id>` na URL. */
export function ServiceList({ slug, services }: Props) {
  return (
    <section className={styles.section} aria-labelledby="services-title">
      <h2 id="services-title" className={styles.title}>
        Escolha o serviço
      </h2>
      {services.length === 0 ? (
        <p className={styles.empty}>Esta agenda ainda não tem serviços disponíveis para agendar.</p>
      ) : (
        <ul className={styles.list}>
          {services.map((service) => (
            <li key={service.id}>
              <ServiceCard slug={slug} service={service} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ServiceCard({ slug, service }: { slug: string; service: PublicServiceItem }) {
  return (
    // Sem prefetch: cada card apontaria para a mesma rota dinâmica, uma chamada à API por card.
    <Link href={`/${slug}?service=${service.id}`} prefetch={false} className={styles.card}>
      {service.imageUrl && (
        // Q-09: provedor de imagem ainda não decidido; <img> simples até lá.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.image}
          src={service.imageUrl}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className={styles.body}>
        <span className={styles.category}>{service.category}</span>
        <h3 className={styles.name}>{service.name}</h3>
        {service.description && <span className={styles.description}>{service.description}</span>}
        <span className={styles.meta}>
          <span>{formatDuration(service.durationMin)}</span>
          <span aria-hidden="true"> · </span>
          <span className={styles.visuallyHidden}>, </span>
          <span className={styles.price}>{formatBRL(service.priceCents)}</span>
        </span>
      </div>
    </Link>
  );
}
