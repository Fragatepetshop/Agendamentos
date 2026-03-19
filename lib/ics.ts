import { addDays, createZonedDate, formatDateKey } from "@/lib/date";

type ParsedIcsEvent = {
  uid: string;
  summary: string;
  description: string;
  dtstart: string;
  dtend: string;
  rrule?: string;
  exdates: string[];
  recurrenceId?: string;
  status?: string;
};

function unfoldLines(text: string) {
  return text.replace(/\r\n[ \t]/g, "").split(/\r?\n/);
}

function parseKeyValue(line: string) {
  const [rawKey, ...rest] = line.split(":");
  return {
    key: rawKey,
    value: rest.join(":")
  };
}

function parsePropertyName(rawKey: string) {
  return rawKey.split(";")[0].toUpperCase();
}

function unescapeIcsText(value: string) {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function parseDateValue(value: string) {
  if (/^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00-03:00`);
  }

  if (value.endsWith("Z")) {
    return new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
    );
  }

  return new Date(
    `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}-03:00`
  );
}

function buildOccurrenceKey(value: string) {
  return parseDateValue(value).toISOString();
}

function parseRRule(rrule: string) {
  return Object.fromEntries(
    rrule.split(";").map((part) => {
      const [key, value] = part.split("=");
      return [key.toUpperCase(), value];
    })
  );
}

function expandRecurringEvent(event: ParsedIcsEvent, rangeStart: Date, rangeEnd: Date) {
  const dtstart = parseDateValue(event.dtstart);
  const dtend = event.dtend ? parseDateValue(event.dtend) : dtstart;
  const durationMs = dtend.getTime() - dtstart.getTime();
  const exdates = new Set(event.exdates.map((value) => buildOccurrenceKey(value)));

  if (!event.rrule) {
    return [{ start: dtstart, end: dtend, originalStart: dtstart }];
  }

  const rule = parseRRule(event.rrule);
  const interval = Number(rule.INTERVAL ?? "1");
  const count = Number(rule.COUNT ?? "0");
  const until = rule.UNTIL ? parseDateValue(rule.UNTIL) : null;
  const byDay = (rule.BYDAY ?? "").split(",").filter(Boolean);
  const weekdayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const occurrences: Array<{ start: Date; end: Date; originalStart: Date }> = [];

  let cursor = new Date(dtstart);
  let generated = 0;

  while (cursor <= rangeEnd) {
    if (until && cursor > until) break;

    const sameWeekday = byDay.length === 0 || byDay.includes(weekdayMap[cursor.getUTCDay()]);
    const occurrenceKey = cursor.toISOString();
    const inWindow = cursor <= rangeEnd && new Date(cursor.getTime() + durationMs) >= rangeStart;

    if (sameWeekday && !exdates.has(occurrenceKey) && inWindow) {
      occurrences.push({
        start: new Date(cursor),
        end: new Date(cursor.getTime() + durationMs),
        originalStart: new Date(cursor)
      });
    }

    generated += 1;
    if (count && generated >= count) break;

    switch (rule.FREQ) {
      case "WEEKLY":
        if (byDay.length > 0) {
          const currentWeekStart = addDays(createZonedDate(formatDateKey(cursor)), -cursor.getUTCDay());
          const candidates = byDay
            .map((dayCode) => {
              const offset = weekdayMap.indexOf(dayCode);
              const date = addDays(currentWeekStart, offset);
              const nextDate = new Date(date);
              nextDate.setUTCHours(dtstart.getUTCHours(), dtstart.getUTCMinutes(), dtstart.getUTCSeconds(), 0);
              return nextDate;
            })
            .filter((date) => date > cursor)
            .sort((a, b) => a.getTime() - b.getTime());

          if (candidates.length > 0) {
            cursor = candidates[0];
          } else {
            const nextWeek = addDays(currentWeekStart, 7 * interval);
            const firstDay = weekdayMap.indexOf(byDay[0]);
            const nextDate = addDays(nextWeek, firstDay);
            nextDate.setUTCHours(dtstart.getUTCHours(), dtstart.getUTCMinutes(), dtstart.getUTCSeconds(), 0);
            cursor = nextDate;
          }
        } else {
          cursor = addDays(cursor, 7 * interval);
        }
        break;
      case "MONTHLY": {
        const next = new Date(cursor);
        next.setUTCMonth(next.getUTCMonth() + interval);
        cursor = next;
        break;
      }
      case "DAILY":
      default:
        cursor = addDays(cursor, interval);
        break;
    }
  }

  return occurrences;
}

export function parseIcsEvents(icsText: string, rangeStart: Date, rangeEnd: Date) {
  const lines = unfoldLines(icsText);
  const events: ParsedIcsEvent[] = [];
  let current: ParsedIcsEvent | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = { uid: "", summary: "", description: "", dtstart: "", dtend: "", exdates: [] };
      continue;
    }

    if (line === "END:VEVENT" && current) {
      events.push(current);
      current = null;
      continue;
    }

    if (!current) continue;

    const { key, value } = parseKeyValue(line);
    const property = parsePropertyName(key);

    if (property === "UID") current.uid = value;
    if (property === "SUMMARY") current.summary = unescapeIcsText(value);
    if (property === "DESCRIPTION") current.description = unescapeIcsText(value);
    if (property === "DTSTART") current.dtstart = value;
    if (property === "DTEND") current.dtend = value;
    if (property === "RRULE") current.rrule = value;
    if (property === "EXDATE") current.exdates.push(...value.split(","));
    if (property === "RECURRENCE-ID") current.recurrenceId = value;
    if (property === "STATUS") current.status = value.toUpperCase();
  }

  const masterEvents = events.filter((event) => !event.recurrenceId);
  const overridesByUid = new Map<string, Map<string, ParsedIcsEvent>>();

  for (const event of events.filter((item) => item.recurrenceId)) {
    const key = buildOccurrenceKey(event.recurrenceId!);
    const currentOverrides = overridesByUid.get(event.uid) ?? new Map<string, ParsedIcsEvent>();
    currentOverrides.set(key, event);
    overridesByUid.set(event.uid, currentOverrides);
  }

  const seenOverrideKeys = new Set<string>();
  const parsedEvents = masterEvents.flatMap((event) => {
    if (event.status === "CANCELLED") {
      return [];
    }

    return expandRecurringEvent(event, rangeStart, rangeEnd).flatMap((occurrence, index) => {
      const occurrenceKey = occurrence.originalStart.toISOString();
      const override = overridesByUid.get(event.uid)?.get(occurrenceKey);

      if (override) {
        seenOverrideKeys.add(`${event.uid}|${occurrenceKey}`);

        if (override.status === "CANCELLED") {
          return [];
        }

        const overrideStart = parseDateValue(override.dtstart);
        const overrideEnd = override.dtend ? parseDateValue(override.dtend) : overrideStart;

        if (overrideStart > rangeEnd || overrideEnd < rangeStart) {
          return [];
        }

        return [
          {
            id: `${override.uid}-${index}-${overrideStart.toISOString()}`,
            title: override.summary || event.summary || "Sem titulo",
            description: override.description || event.description || null,
            start: overrideStart.toISOString(),
            end: overrideEnd.toISOString()
          }
        ];
      }

      return [
        {
          id: `${event.uid}-${index}-${occurrence.start.toISOString()}`,
          title: event.summary || "Sem titulo",
          description: event.description || null,
          start: occurrence.start.toISOString(),
          end: occurrence.end.toISOString()
        }
      ];
    });
  });

  const orphanOverrides = events
    .filter((event) => event.recurrenceId && event.status !== "CANCELLED")
    .filter((event) => !seenOverrideKeys.has(`${event.uid}|${buildOccurrenceKey(event.recurrenceId!)}`))
    .flatMap((event, index) => {
      const start = parseDateValue(event.dtstart);
      const end = event.dtend ? parseDateValue(event.dtend) : start;

      if (start > rangeEnd || end < rangeStart) {
        return [];
      }

      return [
        {
          id: `${event.uid}-override-${index}-${start.toISOString()}`,
          title: event.summary || "Sem titulo",
          description: event.description || null,
          start: start.toISOString(),
          end: end.toISOString()
        }
      ];
    });

  return [...parsedEvents, ...orphanOverrides];
}
