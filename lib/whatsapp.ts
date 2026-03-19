import { WHATSAPP_REMINDER_LOOKAHEAD_DAYS } from "@/lib/config";
import { addDays, createZonedDate, formatDateKey, formatHumanDate, formatTime } from "@/lib/date";
import { parseEventTitle } from "@/lib/event-title";
import { AppSettings, CalendarEvent, WhatsAppReminderItem, WhatsAppReminderStatus, WhatsAppReminderSummary } from "@/lib/types";

const REMINDER_TEMPLATES = [
  "Ola, {client}. Passando para lembrar do banho d{o(a)} {pet} {dayLabel} as {time}. Qualquer ajuste, me avise por aqui.",
  "Oi, {client}! Tudo bem? Fica o lembrete do horario d{o(a)} {pet}: {dayLabel} as {time}. Estamos te esperando.",
  "Ola! Confirmando o atendimento d{o(a)} {pet} {dayLabel} as {time}. Se precisar de algo, e so responder esta mensagem.",
  "Oi, {client}. So para nao esquecer: o banho d{o(a)} {pet} esta marcado para {dayLabel} as {time}.",
  "Tudo certinho por ai? O banho d{o(a)} {pet} acontece {dayLabel} as {time}. Se precisar remarcar, nos chame.",
  "Passando para lembrar do compromisso d{o(a)} {pet}: {dayLabel} as {time}. Qualquer duvida, estou por aqui.",
  "Ola, {client}. Seu horario para d{o(a)} {pet} esta confirmado para {dayLabel} as {time}.",
  "Oi! Estamos passando para lembrar que d{o(a)} {pet} tem banho agendado {dayLabel} as {time}.",
  "Tudo bem, {client}? Lembrando que d{o(a)} {pet} vem para o banho {dayLabel} as {time}.",
  "Ola! O horario d{o(a)} {pet} esta reservado para {dayLabel} as {time}. Ficamos a disposicao.",
  "Oi, {client}. Confirmando o banho d{o(a)} {pet} {dayLabel} as {time}. Estamos te aguardando.",
  "Passando para avisar que o atendimento d{o(a)} {pet} sera {dayLabel} as {time}.",
  "Ola, {client}! So reforcando o lembrete do banho d{o(a)} {pet}: {dayLabel} as {time}.",
  "Oi! Nao se esqueca do horario d{o(a)} {pet} {dayLabel} as {time}. Qualquer necessidade, nos avise.",
  "Tudo certo por ai? O banho d{o(a)} {pet} esta previsto para {dayLabel} as {time}.",
  "Ola, {client}. Fica o lembrete do compromisso d{o(a)} {pet} {dayLabel} as {time}.",
  "Oi, {client}! D{o(a)} {pet} esta com banho marcado para {dayLabel} as {time}. Esperamos voces.",
  "Passando para confirmar que d{o(a)} {pet} sera atendid{o(a)} {dayLabel} as {time}.",
  "Ola! A agenda d{o(a)} {pet} esta confirmada para {dayLabel} as {time}. Se precisar remarcar, nos chame."
];

function hashValue(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildRandomReminderTime(event: CalendarEvent) {
  const appointmentDate = createZonedDate(formatDateKey(new Date(event.start)));
  const sendDate = addDays(appointmentDate, -1);
  const dateKey = formatDateKey(sendDate);
  const slots = [
    "09:05",
    "09:40",
    "10:15",
    "10:55",
    "13:10",
    "13:50",
    "14:35",
    "15:20",
    "16:05",
    "16:50",
    "17:35"
  ];
  const slot = slots[hashValue(`${event.id}:send-time`) % slots.length];

  return createZonedDate(dateKey, slot);
}

function normalizePhone(phone: string | null) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function normalizeMatchValue(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveStoredPhone(petName: string, clientName: string | null, settings?: AppSettings) {
  const contacts = settings?.contacts ?? [];
  const petKey = normalizeMatchValue(petName);
  const clientKey = normalizeMatchValue(clientName);

  const exactMatch = contacts.find(
    (contact) => normalizeMatchValue(contact.petName) === petKey && normalizeMatchValue(contact.clientName) === clientKey
  );

  if (exactMatch?.phone) {
    return exactMatch.phone;
  }

  const petOnlyMatch = contacts.find((contact) => normalizeMatchValue(contact.petName) === petKey);
  return petOnlyMatch?.phone ?? null;
}

function buildDayLabel(referenceDate: Date, appointmentDate: Date) {
  const referenceKey = formatDateKey(referenceDate);
  const appointmentKey = formatDateKey(appointmentDate);

  if (referenceKey === appointmentKey) {
    return "hoje";
  }

  if (formatDateKey(addDays(referenceDate, 1)) === appointmentKey) {
    return "amanha";
  }

  return `no dia ${formatHumanDate(appointmentKey)}`;
}

function buildReminderMessage(event: CalendarEvent, scheduledSendAt: Date) {
  const parsed = parseEventTitle(event.title);
  const appointmentDate = new Date(event.start);
  const template = REMINDER_TEMPLATES[hashValue(`${event.id}:message`) % REMINDER_TEMPLATES.length];

  return template
    .replace("{client}", parsed.clientName || "tudo bem")
    .replace(/\{o\(a\)\}/g, "o(a)")
    .replace("{pet}", parsed.petName)
    .replace("{dayLabel}", buildDayLabel(scheduledSendAt, appointmentDate))
    .replace("{time}", formatTime(event.start));
}

function buildReminderStatus(phone: string | null, scheduledSendAt: Date, appointmentDate: Date, referenceDate: Date): WhatsAppReminderStatus {
  if (!phone) {
    return "sem-telefone";
  }

  if (referenceDate >= appointmentDate) {
    return "expirado";
  }

  if (referenceDate >= scheduledSendAt) {
    return "pronto";
  }

  return "agendado";
}

function isEligibleReminderEvent(event: CalendarEvent, referenceDate: Date) {
  const eventStart = new Date(event.start);
  const lastDate = addDays(createZonedDate(formatDateKey(referenceDate), "23:59"), WHATSAPP_REMINDER_LOOKAHEAD_DAYS);
  return eventStart >= referenceDate && eventStart <= lastDate;
}

export function buildWhatsAppReminders(events: CalendarEvent[], referenceDate: Date, settings?: AppSettings): WhatsAppReminderSummary {
  const items = events
    .filter((event) => isEligibleReminderEvent(event, referenceDate))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((event): WhatsAppReminderItem => {
      const parsed = parseEventTitle(event.title);
      const fallbackPhone = resolveStoredPhone(parsed.petName, parsed.clientName, settings);
      const resolvedPhone = parsed.phone ?? fallbackPhone;
      const normalizedPhone = normalizePhone(resolvedPhone);
      const scheduledSendAt = buildRandomReminderTime(event);
      const message = normalizedPhone ? buildReminderMessage(event, scheduledSendAt) : null;
      const status = buildReminderStatus(normalizedPhone, scheduledSendAt, new Date(event.start), referenceDate);

      return {
        eventId: event.id,
        title: event.title,
        petName: parsed.petName,
        clientName: parsed.clientName,
        phone: resolvedPhone,
        agendaName: event.agendaName,
        start: event.start,
        end: event.end,
        scheduledSendAt: scheduledSendAt.toISOString(),
        message,
        whatsappUrl: normalizedPhone && message ? `https://web.whatsapp.com/send?phone=${normalizedPhone}&text=${encodeURIComponent(message)}` : null,
        status
      };
    });

  return {
    total: items.length,
    dueNow: items.filter((item) => item.status === "pronto").length,
    scheduled: items.filter((item) => item.status === "agendado").length,
    withoutPhone: items.filter((item) => item.status === "sem-telefone").length,
    expired: items.filter((item) => item.status === "expirado").length,
    items
  };
}
