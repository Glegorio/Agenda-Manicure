import { formatBRL } from '@agende/money';
import { formatSlotTime, localDateOf } from './datetime';

interface ConfirmationInput {
  clientName: string;
  startAt: string;
  serviceName: string;
  priceCents: number;
  /** RN-02a: data e hora no fuso da profissional. */
  timezone: string;
  businessName: string;
  /** Q-27: só o que a profissional publicou (endereço completo ou cidade/UF). */
  location: string | null;
}

/**
 * Texto padrão de confirmação (doc 06). O template editável pela profissional (`renderTemplate`)
 * chega na 5.2; até lá a web usa este texto fixo.
 */
export function buildConfirmationMessage(input: ConfirmationInput): string {
  // RN-02a: mesma fonte de data/hora no fuso da profissional que o resto da web.
  const [year, month, day] = localDateOf(input.startAt, input.timezone).split('-');
  const time = formatSlotTime(input.startAt, input.timezone);

  return [
    `Olá ${input.clientName}, seu agendamento foi confirmado!`,
    `📅 Data: ${day ?? ''}/${month ?? ''}/${year ?? ''} às ${time}`,
    `💅 Serviço: ${input.serviceName}`,
    `💰 Valor: ${formatBRL(input.priceCents)}`,
    ...(input.location ? [`📍 Endereço: ${input.location}`] : []),
    `👤 Profissional: ${input.businessName}`,
  ].join('\n');
}

/** Q-32: `wa.me` sem número — o WhatsApp abre e a cliente escolhe a quem enviar. */
export function buildWhatsAppShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
