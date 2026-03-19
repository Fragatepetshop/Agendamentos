import { NextRequest, NextResponse } from "next/server";
import { fetchCalendarEvents } from "@/lib/calendar";
import { fetchChecklistSummary } from "@/lib/checklist";
import { listStoredContacts } from "@/lib/contact-store";
import { buildDashboardPayload } from "@/lib/metrics";
import { addDays, buildDateRangePreset, createZonedDate, endOfMonth, formatDateKey, startOfMonth } from "@/lib/date";
import { AppSettings } from "@/lib/types";

type MetricsInput = {
  selectedDate?: string;
  selectedAgendaId?: string;
  preset?: string;
  start?: string;
  end?: string;
  rankingTopStart?: string;
  rankingTopEnd?: string;
  rankingMissingStart?: string;
  rankingMissingEnd?: string;
  settings?: AppSettings;
};

function buildRanges(input: MetricsInput) {
  const selectedDate = input.selectedDate ?? formatDateKey(new Date());
  const reportPreset = input.preset ?? "este-mes";
  const reportRange =
    input.start && input.end
      ? { start: createZonedDate(input.start), end: createZonedDate(input.end, "23:59") }
      : buildDateRangePreset(reportPreset);

  const now = new Date();
  const selectedDateValue = createZonedDate(selectedDate);
  const availabilitySearchEnd = endOfMonth(addDays(now, 45));
  const rankingTopRange =
    input.rankingTopStart && input.rankingTopEnd
      ? { start: createZonedDate(input.rankingTopStart), end: new Date(Math.min(createZonedDate(input.rankingTopEnd, "23:59").getTime(), now.getTime())) }
      : { start: addDays(now, -365), end: now };
  const rankingMissingRange =
    input.rankingMissingStart && input.rankingMissingEnd
      ? { start: createZonedDate(input.rankingMissingStart), end: new Date(Math.min(createZonedDate(input.rankingMissingEnd, "23:59").getTime(), now.getTime())) }
      : { start: addDays(now, -180), end: now };
  const fetchStart = new Date(
    Math.min(
      startOfMonth(reportRange.start).getTime(),
      startOfMonth(now).getTime(),
      startOfMonth(selectedDateValue).getTime(),
      rankingTopRange.start.getTime(),
      rankingMissingRange.start.getTime()
    )
  );
  const fetchEnd = new Date(
    Math.max(endOfMonth(reportRange.end).getTime(), availabilitySearchEnd.getTime(), endOfMonth(selectedDateValue).getTime(), rankingTopRange.end.getTime(), rankingMissingRange.end.getTime())
  );

  return {
    selectedDate,
    selectedAgendaId: input.selectedAgendaId,
    reportRange,
    rankingTopRange,
    rankingMissingRange,
    fetchStart,
    fetchEnd,
    settings: input.settings
  };
}

async function handleMetrics(input: MetricsInput) {
  const { selectedDate, selectedAgendaId, reportRange, rankingTopRange, rankingMissingRange, fetchStart, fetchEnd, settings } = buildRanges(input);
  const [events, checklist, storedContacts] = await Promise.all([
    fetchCalendarEvents(fetchStart, fetchEnd),
    fetchChecklistSummary().catch(() => ({
      totalEntries: 0,
      uniqueTutors: 0,
      uniquePets: 0,
      items: []
    })),
    listStoredContacts().catch(() => [])
  ]);

  const mergedSettings = settings
    ? {
        ...settings,
        contacts: [...storedContacts, ...(settings.contacts ?? [])]
      }
    : undefined;

  return buildDashboardPayload(
    events,
    selectedDate,
    selectedAgendaId,
    reportRange.start,
    reportRange.end,
    mergedSettings,
    rankingTopRange.start,
    rankingTopRange.end,
    rankingMissingRange.start,
    rankingMissingRange.end,
    checklist
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await handleMetrics({
      selectedDate: searchParams.get("date") ?? undefined,
      selectedAgendaId: searchParams.get("agendaId") ?? undefined,
      preset: searchParams.get("preset") ?? undefined,
      start: searchParams.get("start") ?? undefined,
      end: searchParams.get("end") ?? undefined
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao montar os indicadores";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await handleMetrics((await request.json()) as MetricsInput);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao montar os indicadores";
    return NextResponse.json({ message }, { status: 500 });
  }
}
