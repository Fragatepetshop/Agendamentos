import {
  APP_TIMEZONE,
  LUNCH_END,
  LUNCH_START,
  SATURDAY_END,
  SATURDAY_START,
  SLOT_INTERVAL_MINUTES,
  WORKDAY_END,
  WORKDAY_START
} from "@/lib/config";

const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

export function nowInAppTimezone() {
  return new Date();
}

export function formatDateKey(date: Date) {
  return DATE_ONLY_FORMATTER.format(date);
}

export function createZonedDate(dateKey: string, time = "00:00") {
  return new Date(`${dateKey}T${time}:00-03:00`);
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

export function addMinutes(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 60000);
}

export function startOfWeek(date: Date) {
  const copy = createZonedDate(formatDateKey(date));
  const day = copy.getUTCDay();
  const distance = day === 0 ? -6 : 1 - day;
  return addDays(copy, distance);
}

export function endOfWeek(date: Date) {
  return createZonedDate(formatDateKey(addDays(startOfWeek(date), 6)), "23:59");
}

export function startOfMonth(date: Date) {
  const parts = formatDateKey(date).split("-");
  return createZonedDate(`${parts[0]}-${parts[1]}-01`);
}

export function endOfMonth(date: Date) {
  const currentMonthStart = startOfMonth(date);
  const nextMonth = new Date(currentMonthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);
  return createZonedDate(formatDateKey(nextMonth), "23:59");
}

export function enumerateDays(start: Date, end: Date) {
  const days: string[] = [];
  for (let cursor = createZonedDate(formatDateKey(start)); cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(formatDateKey(cursor));
  }
  return days;
}

export function getBusinessSlots(dateKey: string) {
  const slots: Date[] = [];
  const day = createZonedDate(dateKey).getUTCDay();

  if (day === 0) return slots;

  if (day === 6) {
    const saturdayStart = createZonedDate(dateKey, SATURDAY_START);
    const saturdayEnd = createZonedDate(dateKey, SATURDAY_END);

    for (let cursor = saturdayStart; cursor < saturdayEnd; cursor = addMinutes(cursor, SLOT_INTERVAL_MINUTES)) {
      slots.push(cursor);
    }

    return slots;
  }

  const morningStart = createZonedDate(dateKey, WORKDAY_START);
  const morningEnd = createZonedDate(dateKey, LUNCH_START);
  const afternoonStart = createZonedDate(dateKey, LUNCH_END);
  const afternoonEnd = createZonedDate(dateKey, WORKDAY_END);

  for (let cursor = morningStart; cursor < morningEnd; cursor = addMinutes(cursor, SLOT_INTERVAL_MINUTES)) {
    slots.push(cursor);
  }

  for (let cursor = afternoonStart; cursor < afternoonEnd; cursor = addMinutes(cursor, SLOT_INTERVAL_MINUTES)) {
    slots.push(cursor);
  }

  return slots;
}

export function getWorkingWindows(dateKey: string) {
  const day = createZonedDate(dateKey).getUTCDay();

  if (day === 0) return [] as Array<{ start: Date; end: Date }>;

  if (day === 6) {
    return [{ start: createZonedDate(dateKey, SATURDAY_START), end: createZonedDate(dateKey, SATURDAY_END) }];
  }

  return [
    { start: createZonedDate(dateKey, WORKDAY_START), end: createZonedDate(dateKey, LUNCH_START) },
    { start: createZonedDate(dateKey, LUNCH_END), end: createZonedDate(dateKey, WORKDAY_END) }
  ];
}

export function formatHumanDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(createZonedDate(dateKey));
}

export function formatHumanDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date(iso));
}

export function formatTime(isoOrDate: string | Date) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

export function buildDateRangePreset(preset: string, referenceDate = nowInAppTimezone()) {
  const todayKey = formatDateKey(referenceDate);
  const today = createZonedDate(todayKey);

  switch (preset) {
    case "hoje":
      return { start: createZonedDate(todayKey), end: createZonedDate(todayKey, "23:59") };
    case "ontem": {
      const yesterday = addDays(today, -1);
      const key = formatDateKey(yesterday);
      return { start: createZonedDate(key), end: createZonedDate(key, "23:59") };
    }
    case "esta-semana":
      return { start: startOfWeek(referenceDate), end: endOfWeek(referenceDate) };
    case "mes-anterior": {
      const monthStart = startOfMonth(referenceDate);
      const previousMonthDate = addDays(monthStart, -1);
      return { start: startOfMonth(previousMonthDate), end: endOfMonth(previousMonthDate) };
    }
    case "este-mes":
    default:
      return { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) };
  }
}
