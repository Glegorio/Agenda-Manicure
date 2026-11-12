import type { AppointmentResponse } from '@agende/contracts';
import type { AppointmentRow } from './appointments.repository.js';

export function toAppointmentResponse(row: AppointmentRow): AppointmentResponse {
  return {
    id: row.id,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    status: row.status,
    source: row.source,
    serviceId: row.serviceId,
    serviceName: row.serviceNameSnapshot,
    priceCents: row.priceCentsSnapshot,
    durationMin: row.durationMinSnapshot,
    client: { id: row.client.id, name: row.client.name, phone: row.client.phoneE164 },
    bookedName: row.bookedName,
    clientNotes: row.clientNotes,
    paidCents: row.paidCents,
    paymentMethod: row.paymentMethod,
    cancelledBy: row.cancelledBy,
    reason: row.cancelReason,
    statusChangedAt: row.statusChangedAt.toISOString(),
  };
}
