import { Injectable } from '@nestjs/common';
import {
  type AvailabilityDaysResponse,
  type AvailabilityResponse,
  type PublicProfileResponse,
  slugSchema,
} from '@agende/contracts';
import {
  addLocalDays,
  computeAvailableDays,
  computeAvailableSlots,
  localDateOf,
  localTimeToInstant,
  type SlotQuery,
} from '@agende/scheduling';
import { Clock } from '../clock/clock.js';
import { DomainError } from '../common/domain-error.js';
import { localDateToDb, toDomainException, toWeeklySchedule } from '../schedule/schedule.mapper.js';
import { type PublicProfessional, PublicRepository } from './public.repository.js';

const pageNotFound = () => new DomainError('NOT_FOUND', 'Página não encontrada.');
const serviceNotFound = () => new DomainError('NOT_FOUND', 'Serviço não encontrado.');

/**
 * Folga na busca de ocupações: a sobreposição já pega o que começou antes; a margem cobre o
 * buffer de um candidato que passa da meia-noite (janela até 24:00) e saltos de DST (Q-15).
 */
const DAY_MARGIN = 1;

/**
 * Página pública de agendamento (sem login). O cálculo de horários é todo do domínio
 * (`@agende/scheduling`, regra 2); aqui só se carregam os dados e se converte a resposta.
 */
@Injectable()
export class PublicService {
  constructor(
    private readonly repository: PublicRepository,
    private readonly clock: Clock,
  ) {}

  /** Q-21: profissional sem slug não tem página (o slug é a chave de busca). */
  async getProfile(slug: string): Promise<PublicProfileResponse> {
    const pro = await this.professional(slug);
    const services = await this.repository.listVisibleServices(pro.id);
    return {
      // O slug existe (foi a chave da busca); `??` só satisfaz o tipo anulável.
      slug: pro.slug ?? slug,
      businessName: pro.businessName,
      timezone: pro.timezone,
      addressLine: pro.showFullAddress ? pro.addressLine : null, // Q-27: só com opt-in
      city: pro.city,
      state: pro.state,
      logoUrl: pro.logoUrl,
      coverUrl: pro.coverUrl,
      themePalette: pro.themePalette,
      themeMode: pro.themeMode,
      cancellationPolicy: pro.cancellationPolicy,
      services,
    };
  }

  async getSlots(slug: string, serviceId: string, date: string): Promise<AvailabilityResponse> {
    const { pro, service } = await this.professionalAndService(slug, serviceId);
    const range = this.bookableRange(pro, date, date);
    if (!range) return { timezone: pro.timezone, slots: [] };
    const query = await this.slotQuery(pro, service.durationMin, range.from, range.to);
    const slots = computeAvailableSlots({ ...query, date });
    return { timezone: pro.timezone, slots: slots.map((slot) => slot.toISOString()) };
  }

  async getDays(
    slug: string,
    serviceId: string,
    from: string,
    to: string,
  ): Promise<AvailabilityDaysResponse> {
    const { pro, service } = await this.professionalAndService(slug, serviceId);
    const range = this.bookableRange(pro, from, to);
    if (!range) return { timezone: pro.timezone, days: [] };
    const query = await this.slotQuery(pro, service.durationMin, range.from, range.to);
    return { timezone: pro.timezone, days: computeAvailableDays(range.from, range.to, query) };
  }

  private async professional(slug: string): Promise<PublicProfessional> {
    // RN-90: formato inválido não pode existir; 404 sem ir ao banco (citext aceita maiúsculas).
    if (!slugSchema.safeParse(slug.toLowerCase()).success) throw pageNotFound();
    const pro = await this.repository.findProfessionalBySlug(slug);
    if (!pro) throw pageNotFound();
    return pro;
  }

  private async professionalAndService(slug: string, serviceId: string) {
    const pro = await this.professional(slug);
    // RN-91: inativo, não público ou de outra profissional → mesma resposta.
    const service = await this.repository.findVisibleService(pro.id, serviceId);
    if (!service) throw serviceNotFound();
    return { pro, service };
  }

  /**
   * RN-33: só de hoje até hoje + horizonte, pela data local da profissional. Recorta o pedido
   * antes de ir ao banco; `null` quando nada dele é agendável.
   */
  private bookableRange(
    pro: PublicProfessional,
    from: string,
    to: string,
  ): { from: string; to: string } | null {
    const today = localDateOf(this.clock.now(), pro.timezone);
    const last = addLocalDays(today, pro.bookingHorizonDays);
    const start = from > today ? from : today;
    const end = to < last ? to : last;
    return start <= end ? { from: start, to: end } : null;
  }

  /** Carrega tudo que o domínio precisa para as datas locais `[from, to]`. */
  private async slotQuery(
    pro: PublicProfessional,
    durationMin: number,
    from: string,
    to: string,
  ): Promise<Omit<SlotQuery, 'date'>> {
    const tz = pro.timezone;
    const [weekly, exceptions, busy] = await Promise.all([
      this.repository.listWeekly(pro.id),
      this.repository.listExceptions(pro.id, localDateToDb(from), localDateToDb(to)),
      this.repository.busyBetween(
        pro.id,
        localTimeToInstant(addLocalDays(from, -DAY_MARGIN), '00:00', tz),
        localTimeToInstant(addLocalDays(to, 1 + DAY_MARGIN), '00:00', tz),
      ),
    ]);

    return {
      durationMin,
      now: this.clock.now(),
      settings: {
        timezone: tz,
        bufferMin: pro.bufferMin,
        // CHECK no banco garante 5/10/15/30; o domínio ainda revalida (assertValidQuery).
        slotStepMin: pro.slotStepMin as SlotQuery['settings']['slotStepMin'],
        minNoticeMin: pro.minNoticeMin,
        bookingHorizonDays: pro.bookingHorizonDays,
      },
      weeklySchedule: toWeeklySchedule(weekly),
      exceptions: exceptions.map(toDomainException),
      busy,
    };
  }
}
