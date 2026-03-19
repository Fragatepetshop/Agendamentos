import { NextRequest, NextResponse } from "next/server";
import { fetchCalendarEvents } from "@/lib/calendar";
import { buildCsv } from "@/lib/metrics";
import { buildDateRangePreset, createZonedDate, endOfMonth, startOfMonth } from "@/lib/date";

type ExportInput = {
  preset?: string;
  start?: string;
  end?: string;
};

async function handleExport(input: ExportInput) {
  const reportPreset = input.preset ?? "este-mes";
  const range =
    input.start && input.end
      ? { start: createZonedDate(input.start), end: createZonedDate(input.end, "23:59") }
      : buildDateRangePreset(reportPreset);

  const events = await fetchCalendarEvents(startOfMonth(range.start), endOfMonth(range.end));
  const filtered = events.filter((event) => new Date(event.start) <= range.end && new Date(event.end) >= range.start);
  return buildCsv(filtered);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const csv = await handleExport({
      preset: searchParams.get("preset") ?? undefined,
      start: searchParams.get("start") ?? undefined,
      end: searchParams.get("end") ?? undefined
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="relatorio-pet-shop.csv"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao exportar CSV";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const csv = await handleExport((await request.json()) as ExportInput);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="relatorio-pet-shop.csv"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao exportar CSV";
    return NextResponse.json({ message }, { status: 500 });
  }
}
