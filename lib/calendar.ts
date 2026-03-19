import { AGENDAS } from "@/lib/config";
import { parseIcsEvents } from "@/lib/ics";
import { CalendarEvent } from "@/lib/types";

function parseDescriptionSections(description: string | null) {
  const lines = (description ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const observations = lines.filter((line) => /^obs\s*:/i.test(line));
  const serviceLines = lines.filter((line) => !/^obs\s*:/i.test(line));

  return {
    primaryService: serviceLines[0] ?? null,
    additionalServices: serviceLines.slice(1),
    observations
  };
}

export async function fetchCalendarEvents(rangeStart: Date, rangeEnd: Date): Promise<CalendarEvent[]> {
  const activeAgendas = AGENDAS.filter((agenda) => agenda.active);

  const results = await Promise.all(
    activeAgendas.map(async (agenda) => {
      const response = await fetch(agenda.url, {
        cache: "no-store",
        headers: {
          "User-Agent": "pet-shop-agendamentos"
        }
      });

      if (!response.ok) {
        throw new Error(`Falha ao carregar agenda ${agenda.name}`);
      }

      const icsText = await response.text();
      const events = parseIcsEvents(icsText, rangeStart, rangeEnd);

      return events.map<CalendarEvent>((event) => ({
        ...parseDescriptionSections(event.description),
        id: event.id,
        agendaId: agenda.id,
        agendaName: agenda.name,
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        points: agenda.points,
        color: agenda.color
      }));
    })
  );

  const deduped = new Map<string, CalendarEvent>();

  for (const event of results.flat()) {
    const dedupeKey = [event.agendaId, event.title.trim(), event.start].join("|");
    const current = deduped.get(dedupeKey);

    if (!current) {
      deduped.set(dedupeKey, event);
      continue;
    }

    if (new Date(event.end) > new Date(current.end)) {
      deduped.set(dedupeKey, event);
    }
  }

  return [...deduped.values()].sort((a, b) => a.start.localeCompare(b.start));
}
