"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CarFront, ChevronLeft, ChevronRight, ClipboardList, Download, LoaderCircle, Package, Phone, RefreshCw, Scissors, Settings2, TrendingUp, Trophy } from "lucide-react";
import { AGENDAS, DAILY_POINT_LIMIT, STAFF, getDefaultSettings } from "@/lib/config";
import { addDays, buildDateRangePreset, createZonedDate, formatDateKey, formatHumanDate, formatHumanDateTime, formatTime, getWorkingWindows } from "@/lib/date";
import { parseEventTitle } from "@/lib/event-title";
import { AppSettings, DashboardPayload, StaffSkill } from "@/lib/types";
import { cn, downloadFile, formatNumber, formatPoints, statusLabel } from "@/lib/utils";

type TabKey = "dashboard" | "relatorios" | "agenda" | "agendamento" | "equipe" | "taxi" | "pacotes" | "ranking" | "checklist" | "pendencias-formulario" | "configuracoes";
type PresetKey = "hoje" | "ontem" | "esta-semana" | "este-mes" | "mes-anterior" | "personalizado";

const SETTINGS_STORAGE_KEY = "pet-shop-settings-v1";
const PRESETS: Array<{ value: PresetKey; label: string }> = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "esta-semana", label: "Esta semana" },
  { value: "este-mes", label: "Este mes" },
  { value: "mes-anterior", label: "Mes anterior" },
  { value: "personalizado", label: "Personalizado" }
];
const SKILLS: Array<{ value: StaffSkill; label: string }> = [
  { value: "banho", label: "Banhista" },
  { value: "tosa-maquina", label: "Tosa na Maquina" },
  { value: "tosa-tesoura", label: "Tosa na Tesoura" }
];

function Card({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function skillLabel(skill: StaffSkill) {
  return SKILLS.find((item) => item.value === skill)?.label ?? skill;
}

function skillList(skills: StaffSkill[]) {
  return skills.map(skillLabel).join(" - ");
}

function getStaffColor(staffId: string) {
  return STAFF.find((member) => member.id === staffId)?.color ?? "#94A3B8";
}

function getAssignmentVisual(agendaName: string, staffColor: string) {
  if (agendaName.toLowerCase().includes("tesoura")) {
    return {
      bgColor: "#15803D",
      chipClassName: "bg-green-700 text-white",
      cardClassName: "border border-green-200 bg-green-50",
      textClassName: "text-green-800",
      icon: <Scissors className="h-4 w-4" />
    };
  }

  if (agendaName.toLowerCase().includes("maquina") || agendaName.toLowerCase().includes("máquina")) {
    return {
      bgColor: "#EA580C",
      chipClassName: "bg-orange-600 text-white",
      cardClassName: "border border-orange-200 bg-orange-50",
      textClassName: "text-orange-800",
      icon: <Settings2 className="h-4 w-4" />
    };
  }

  return {
    bgColor: staffColor,
    chipClassName: "",
    cardClassName: "bg-white",
    textClassName: "text-slate-500",
    icon: null
  };
}

function buildAssignmentCsv(payload: DashboardPayload) {
  const header = "Profissional;Inicio;Fim;Agenda;Compromisso";
  const lines = payload.assignmentReport.grouped.flatMap((group) =>
    group.items.map((item) =>
      [
        group.staffName,
        formatTime(item.start),
        formatTime(item.end),
        item.agendaName,
        `"${item.title.replace(/"/g, '""')}"`
      ].join(";")
    )
  );

  const unassigned = payload.assignmentReport.unassigned.map((item) =>
    [
      "Nao alocado",
      formatTime(item.start),
      formatTime(item.end),
      item.agendaName,
      `"${item.title.replace(/"/g, '""')}"`
    ].join(";")
  );

  return [header, ...lines, ...unassigned].join("\n");
}

function MiniBarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(...values, 1);

  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ink">Grafico por dia</h3>
        <TrendingUp className="h-5 w-5 text-slate-400" />
      </div>
      <div className="flex h-56 items-end gap-3">
        {values.map((value, index) => (
          <div key={`${labels[index]}-${value}`} className="flex flex-1 flex-col items-center gap-2">
            <div className="w-full rounded-t-2xl" style={{ height: `${Math.max(10, (value / max) * 180)}px`, backgroundColor: color }} />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">{value}</p>
              <p className="text-xs text-slate-500">{labels[index]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaChart({ items }: { items: DashboardPayload["report"]["agendaBreakdown"] }) {
  const total = items.reduce((sum, item) => sum + item.points, 0) || 1;

  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
      <h3 className="mb-4 text-lg font-semibold text-ink">Grafico por agenda</h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.agendaId}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{item.agendaName}</span>
              <span className="text-slate-500">{formatPoints(item.points)} • {item.events} compromissos</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max(4, (item.points / total) * 100)}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PackageAgendaChart({ items }: { items: Array<{ agendaName: string; total: number; color: string }> }) {
  const total = items.reduce((sum, item) => sum + item.total, 0) || 1;

  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
      <h3 className="mb-4 text-lg font-semibold text-ink">Pacotes por agenda</h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={`package-${item.agendaName}`}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{item.agendaName}</span>
              <span className="text-slate-500">{item.total} cliente(s)</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max(6, (item.total / total) * 100)}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDurationLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function formatLongDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  }).format(createZonedDate(dateKey));
}

function buildOverlappingColumns<T extends { startDate: Date; endDate: Date }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const positioned: Array<T & { column: number; totalColumns: number }> = [];
  let cluster: Array<T & { column: number }> = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];

  function flushCluster() {
    if (cluster.length === 0) return;
    const totalColumns = Math.max(...cluster.map((item) => item.column)) + 1;
    positioned.push(...cluster.map((item) => ({ ...item, totalColumns })));
    cluster = [];
    clusterEnd = -1;
    columnEnds = [];
  }

  for (const item of sorted) {
    const startMs = item.startDate.getTime();
    const endMs = item.endDate.getTime();

    if (cluster.length > 0 && startMs >= clusterEnd) {
      flushCluster();
    }

    let column = columnEnds.findIndex((columnEnd) => columnEnd <= startMs);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(endMs);
    } else {
      columnEnds[column] = endMs;
    }

    cluster.push({ ...item, column });
    clusterEnd = Math.max(clusterEnd, endMs);
  }

  flushCluster();
  return positioned;
}

function GoogleLikeAgenda({ dateKey, events }: { dateKey: string; events: DashboardPayload["events"] }) {
  const windows = getWorkingWindows(dateKey);

  if (windows.length === 0) {
    return (
      <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
        <h3 className="text-lg font-semibold text-ink">Agenda visual do dia</h3>
        <p className="mt-3 text-sm text-slate-500">Domingo sem atendimento.</p>
      </div>
    );
  }

  const dayEvents = events
    .filter((event) => formatDateKey(new Date(event.start)) === dateKey)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const isToday = dateKey === formatDateKey(new Date());

  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">Agenda visual do dia</h3>
          <p className="text-sm text-slate-500">Leitura no estilo agenda, com blocos por horario e cores das agendas.</p>
        </div>
        <p className="text-sm text-slate-500">{formatHumanDate(dateKey)}</p>
      </div>

      <div className="mt-5 space-y-4">
        {windows.map((window, windowIndex) => {
          const windowEvents = dayEvents
            .filter((event) => new Date(event.start) < window.end && new Date(event.end) > window.start)
            .map((event) => ({
              ...event,
              startDate: new Date(Math.max(new Date(event.start).getTime(), window.start.getTime())),
              endDate: new Date(Math.min(new Date(event.end).getTime(), window.end.getTime()))
            }));

          const positionedEvents = buildOverlappingColumns(windowEvents);
          const slotHeight = 52;
          const totalMinutes = (window.end.getTime() - window.start.getTime()) / 60000;
          const totalHeight = (totalMinutes / 30) * slotHeight;
          const rows = Array.from({ length: totalMinutes / 30 }, (_, index) => {
            const rowTime = new Date(window.start.getTime() + index * 30 * 60000);
            return {
              key: `${windowIndex}-${index}`,
              label: formatTime(rowTime),
              top: index * slotHeight
            };
          });
          const now = new Date();
          const showNowLine = isToday && now >= window.start && now <= window.end;
          const nowTop = ((now.getTime() - window.start.getTime()) / 60000 / 30) * slotHeight;

          return (
            <div key={`${window.start.toISOString()}-${window.end.toISOString()}`} className="overflow-hidden rounded-3xl border border-slate-100">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                {formatTime(window.start)} - {formatTime(window.end)}
              </div>

              <div className="grid grid-cols-[72px_1fr]">
                <div className="relative border-r border-slate-100 bg-white">
                  <div style={{ height: totalHeight }}>
                    {rows.map((row) => (
                      <div key={row.key} className="absolute left-0 right-0 border-t border-slate-100 px-3 text-xs text-slate-400" style={{ top: row.top }}>
                        <span className="-translate-y-1/2 inline-block bg-white pr-2">{row.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,1))]" style={{ height: totalHeight }}>
                  {rows.map((row) => (
                    <div key={`grid-${row.key}`} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: row.top }} />
                  ))}

                  {showNowLine && (
                    <div className="absolute left-0 right-0 z-20 border-t-2 border-rose-500" style={{ top: nowTop }}>
                      <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-rose-500" />
                    </div>
                  )}

                  {positionedEvents.map((event) => {
                    const parsedTitle = parseEventTitle(event.title);
                    const top = ((event.startDate.getTime() - window.start.getTime()) / 60000 / 30) * slotHeight;
                    const height = Math.max(48, ((event.endDate.getTime() - event.startDate.getTime()) / 60000 / 30) * slotHeight - 4);
                    const width = `calc(${100 / event.totalColumns}% - 8px)`;
                    const left = `calc(${(100 / event.totalColumns) * event.column}% + 4px)`;

                    return (
                      <div
                        key={`${windowIndex}-${event.id}`}
                        className="absolute overflow-hidden rounded-2xl border px-3 py-2 text-white shadow-sm"
                        style={{
                          top,
                          left,
                          width,
                          height,
                          backgroundColor: event.color,
                          borderColor: event.color
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/75">{event.agendaName}</p>
                          <div className="flex items-center gap-2">
                            {parsedTitle.isTaxi && (
                              <span className="inline-flex items-center justify-center rounded-full border-2 border-white bg-yellow-400 p-1 shadow-sm">
                                <CarFront className="h-3.5 w-3.5 text-amber-900" />
                              </span>
                            )}
                            {parsedTitle.isPackage && (
                              <span className="inline-flex items-center justify-center rounded-full border-2 border-slate-900 bg-white p-1 shadow-sm">
                                <Package className="h-3.5 w-3.5 text-slate-900" />
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold">{event.title}</p>
                        <p className="mt-1 text-xs text-white/85">
                          {formatTime(event.start)} - {formatTime(event.end)}
                        </p>
                      </div>
                    );
                  })}

                  {positionedEvents.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Nenhum compromisso neste periodo.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PetShopDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [preset, setPreset] = useState<PresetKey>("este-mes");
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [selectedAgendaId, setSelectedAgendaId] = useState(AGENDAS[0].id);
  const [customStart, setCustomStart] = useState(formatDateKey(buildDateRangePreset("este-mes").start));
  const [customEnd, setCustomEnd] = useState(formatDateKey(buildDateRangePreset("este-mes").end));
  const [rankingTopStart, setRankingTopStart] = useState(formatDateKey(new Date(new Date().setFullYear(new Date().getFullYear() - 1))));
  const [rankingTopEnd, setRankingTopEnd] = useState(formatDateKey(new Date()));
  const [rankingMissingStart, setRankingMissingStart] = useState(formatDateKey(new Date(new Date().setMonth(new Date().getMonth() - 6))));
  const [rankingMissingEnd, setRankingMissingEnd] = useState(formatDateKey(new Date()));
  const [checklistSearch, setChecklistSearch] = useState("");
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      try {
        setSettings(JSON.parse(saved) as AppSettings);
      } catch {
        setSettings(getDefaultSettings());
      }
    }
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings, settingsLoaded]);

  useEffect(() => {
    if (preset === "personalizado") return;
    const range = buildDateRangePreset(preset);
    setCustomStart(formatDateKey(range.start));
    setCustomEnd(formatDateKey(range.end));
  }, [preset]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedDate,
          selectedAgendaId,
          preset,
          start: preset === "personalizado" ? customStart : undefined,
          end: preset === "personalizado" ? customEnd : undefined,
          rankingTopStart,
          rankingTopEnd,
          rankingMissingStart,
          rankingMissingEnd,
          settings
        })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message ?? "Falha ao carregar dados");
      }
      setPayload(await response.json());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!settingsLoaded) return;
    void fetchMetrics();
  }, [settingsLoaded, selectedDate, selectedAgendaId, preset, customStart, customEnd, rankingTopStart, rankingTopEnd, rankingMissingStart, rankingMissingEnd, settings]);

  const exportCsv = async () => {
    try {
      setDownloading(true);
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset,
          start: preset === "personalizado" ? customStart : undefined,
          end: preset === "personalizado" ? customEnd : undefined
        })
      });
      if (!response.ok) throw new Error("Falha ao exportar CSV");
      downloadFile("relatorio-pet-shop.csv", await response.text(), "text/csv;charset=utf-8");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Falha ao exportar CSV");
    } finally {
      setDownloading(false);
    }
  };

  const updateAgenda = (agendaId: string, patch: Partial<AppSettings["agendas"][number]>) => {
    setSettings((current) => ({
      ...current,
      agendas: current.agendas.map((agenda) => (agenda.id === agendaId ? { ...agenda, ...patch } : agenda))
    }));
  };

  const toggleSkill = (staffId: string, skill: StaffSkill) => {
    setSettings((current) => ({
      ...current,
      staff: current.staff.map((member) => {
        if (member.id !== staffId) return member;
        const skills = member.skills.includes(skill) ? member.skills.filter((item) => item !== skill) : [...member.skills, skill];
        return { ...member, skills };
      })
    }));
  };

  const dayEvents = useMemo(
    () => payload?.events.filter((event) => formatDateKey(new Date(event.start)) === selectedDate) ?? [],
    [payload, selectedDate]
  );
  const packageAgendaBreakdown = useMemo(() => {
    if (!payload) return [];

    const counts = new Map<string, { agendaName: string; total: number; color: string }>();

    for (const item of payload.packageClients) {
      const agenda = AGENDAS.find((entry) => entry.id === item.agendaId);
      const current = counts.get(item.agendaId);

      if (current) {
        current.total += 1;
      } else {
        counts.set(item.agendaId, {
          agendaName: item.agendaName,
          total: 1,
          color: agenda?.color ?? "#94A3B8"
        });
      }
    }

    return [...counts.values()].sort((a, b) => b.total - a.total || a.agendaName.localeCompare(b.agendaName));
  }, [payload]);

  const exportAssignmentCsv = () => {
    if (!payload) return;
    downloadFile(`divisao-sugerida-${payload.assignmentReport.date}.csv`, buildAssignmentCsv(payload), "text/csv;charset=utf-8");
  };
  const filteredChecklistItems = useMemo(() => {
    if (!payload) return [];
    const search = checklistSearch.trim().toLowerCase();
    if (!search) return payload.checklist.items;

    return payload.checklist.items.filter((item) =>
      [item.petName, item.tutorName, item.tutorPhone ?? "", item.cpf ?? ""].some((value) => value.toLowerCase().includes(search))
    );
  }, [payload, checklistSearch]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(233,223,199,0.7),_rgba(246,244,239,0.95)_48%,_#f8fafc_100%)] text-ink">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded-[32px] border border-white/80 bg-white/75 p-6 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-ink">Painel de agendamentos do pet shop</h1>
              <p className="mt-2 text-slate-600">Com configuracoes editaveis, filtro corrigido e proxima disponibilidade real com base no horario atual.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => void fetchMetrics()} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Atualizar agendas
              </button>
              <div className="rounded-full bg-slate-100 px-4 py-3 text-sm text-slate-600">Ultima atualizacao: {payload ? formatHumanDateTime(payload.generatedAt) : "--"}</div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card title="Pontos de hoje" value={payload ? formatPoints(payload.today.points) : "--"} subtitle={payload ? `${payload.today.remainingPoints} pontos restantes` : "Carregando"} />
          <Card title="Pontos da semana" value={payload ? formatPoints(payload.weekPoints) : "--"} subtitle="Semana atual" />
          <Card title="Pontos do mes" value={payload ? formatPoints(payload.monthPoints) : "--"} subtitle="Mes atual" />
          <Card title="Ocupacao do dia" value={payload ? `${payload.today.occupancyPercent}%` : "--"} subtitle={payload ? statusLabel(payload.today.status) : "Carregando"} />
          <Card title="Proxima data disponivel" value={payload?.overallNextAvailability?.dateTimeLabel ?? "--"} subtitle={payload?.overallNextAvailability ? `${payload.overallNextAvailability.serviceLabel} - ${payload.overallNextAvailability.staff.join(", ") || "sem equipe sugerida"}` : "Sem vaga encontrada"} />
        </section>

        <section className="mt-6 flex flex-wrap gap-3">
          {[
            { key: "dashboard", label: "Dashboard", icon: CalendarDays },
            { key: "relatorios", label: "Relatorios", icon: TrendingUp },
            { key: "agenda", label: "Agenda", icon: CalendarDays },
            { key: "agendamento", label: "Agendamento", icon: Scissors },
            { key: "equipe", label: "Equipe", icon: Trophy },
            { key: "taxi", label: "Taxi Dog", icon: CarFront },
            { key: "pacotes", label: "Pacotes", icon: Package },
            { key: "ranking", label: "Ranking", icon: Trophy },
            { key: "checklist", label: "Checklist", icon: ClipboardList },
            { key: "pendencias-formulario", label: "Pendencias Form", icon: Phone },
            { key: "configuracoes", label: "Configuracoes", icon: Settings2 }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as TabKey)} className={cn("inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium", activeTab === tab.key ? "bg-teal text-white" : "bg-white/90 text-slate-600 shadow-panel")}>
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </section>

        {loading && <div className="mt-8 flex items-center justify-center rounded-3xl border border-white/70 bg-white/90 p-10 shadow-panel"><LoaderCircle className="mr-3 h-5 w-5 animate-spin text-teal" />Carregando...</div>}
        {error && !loading && <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div>}

        {!loading && payload && activeTab === "dashboard" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Dashboard" subtitle={`Resumo rapido de ${formatHumanDate(payload.today.date)}`} />
            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-ink">Meta mensal de produtividade</h3>
                  <p className="text-sm text-slate-500">
                    Maximo possivel em {payload.monthGoal.monthLabel}: {formatPoints(payload.monthGoal.maxPoints)}. Meta operacional: {formatPoints(payload.monthGoal.targetPoints)}.
                  </p>
                </div>
                <div className="text-sm text-slate-500">
                  {formatPoints(payload.monthGoal.currentPoints)} realizados
                </div>
              </div>
              <div className="mt-4 h-5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal via-emerald-500 to-clay"
                  style={{ width: `${Math.min(100, payload.monthGoal.progressPercent)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>{payload.monthGoal.progressPercent}% da meta de 80%</span>
                <span>{formatPoints(payload.monthGoal.remainingToTarget)} para bater a meta</span>
              </div>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">Capacidade do dia</h3>
                <div className="mt-4 h-5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal via-emerald-500 to-clay" style={{ width: `${Math.min(100, payload.today.occupancyPercent)}%` }} /></div>
                <p className="mt-3 text-sm text-slate-500">{formatPoints(payload.today.points)} usados de {DAILY_POINT_LIMIT} pontos</p>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">Agenda</th><th className="px-4 py-3">Compromissos</th><th className="px-4 py-3">Pontos</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 bg-white">{payload.todayAgendaBreakdown.map((item) => <tr key={item.agendaId}><td className="px-4 py-3">{item.agendaName}</td><td className="px-4 py-3">{item.events}</td><td className="px-4 py-3">{formatPoints(item.points)}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
              <MiniBarChart values={payload.report.dailyBreakdown.slice(-10).map((item) => item.points)} labels={payload.report.dailyBreakdown.slice(-10).map((item) => item.date.slice(5))} color="#0F766E" />
            </div>
          </section>
        )}

        {!loading && payload && activeTab === "relatorios" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Relatorios" subtitle="O preset atualiza as datas visiveis e o mes anterior usa a faixa correta." />
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                <div className="grid gap-4 md:grid-cols-3">
                  <select value={preset} onChange={(event) => setPreset(event.target.value as PresetKey)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  <input type="date" value={customStart} onChange={(event) => { setPreset("personalizado"); setCustomStart(event.target.value); }} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input type="date" value={customEnd} onChange={(event) => { setPreset("personalizado"); setCustomEnd(event.target.value); }} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                </div>
              </div>
              <button onClick={() => void exportCsv()} disabled={downloading} className="inline-flex items-center justify-center gap-2 rounded-full bg-clay px-5 py-3 text-sm font-medium text-white"><Download className="h-4 w-4" />{downloading ? "Gerando CSV..." : "Exportar CSV"}</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card title="Pontos no periodo" value={formatPoints(payload.report.totalPoints)} subtitle="Total do filtro ativo" />
              <Card title="Compromissos" value={formatNumber(payload.report.totalEvents)} subtitle="Eventos no periodo" />
              <Card title="Media por dia" value={formatPoints(payload.report.averagePointsPerDay)} subtitle="Dias com movimento" />
              <Card title="Dias no ranking" value={String(payload.report.busiestDays.length)} subtitle="Top dias do periodo" />
            </div>
            <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
              <AgendaChart items={payload.report.agendaBreakdown} />
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">Ranking dos dias mais cheios</h3>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Pontos</th><th className="px-4 py-3">Compromissos</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 bg-white">{payload.report.busiestDays.map((day) => <tr key={day.date}><td className="px-4 py-3">{formatHumanDate(day.date)}</td><td className="px-4 py-3">{formatPoints(day.points)}</td><td className="px-4 py-3">{day.events}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {!loading && payload && activeTab === "agenda" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Agenda" subtitle="Visualizacao diaria em formato de agenda, separada para consulta rapida da operacao." />
            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => setSelectedDate(formatDateKey(new Date()))} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400">
                      Hoje
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedDate(formatDateKey(addDays(createZonedDate(selectedDate), -1)))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-ink"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSelectedDate(formatDateKey(addDays(createZonedDate(selectedDate), 1)))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-ink"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:border-slate-400"
                    />
                  </div>
                  <p className="text-3xl font-medium capitalize tracking-tight text-ink">{formatLongDate(selectedDate)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {AGENDAS.map((agenda) => (
                    <span key={`legend-${agenda.id}`} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: agenda.color }} />
                      {agenda.serviceLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <GoogleLikeAgenda dateKey={selectedDate} events={payload.events} />
          </section>
        )}

        {!loading && payload && activeTab === "agendamento" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Agendamento" subtitle="A proxima vaga considera o horario atual, os limites de pontos por periodo, sabado das 08:00 as 12:00 e domingo sem atendimento." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {payload.availabilityByService.map((item) => {
                const agenda = AGENDAS.find((entry) => entry.id === item.selectedAgendaId)!;

                return (
                  <div key={item.selectedAgendaId} className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Proxima vaga</p>
                        <h3 className="mt-2 text-lg font-semibold text-ink">{agenda.serviceLabel}</h3>
                      </div>
                      <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: agenda.color }} />
                    </div>
                    <p className="mt-4 text-base font-medium text-slate-700">{item.nextAvailableDateTimeLabel ?? "Sem vaga encontrada"}</p>
                    <p className="mt-2 text-sm text-slate-500">{item.nextAvailableStaff.join(", ") || "Sem profissional sugerida"}</p>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                      <span>{formatPoints(item.servicePoints)}</span>
                      <span>{formatDurationLabel(item.serviceDurationMinutes)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">Compromissos do dia</h3>
                <div className="mt-4 space-y-3">
                  {dayEvents.length === 0 && <p className="text-sm text-slate-500">Nenhum compromisso encontrado para esta data.</p>}
                  {dayEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-ink">{event.title}</p>
                          <p className="text-sm text-slate-500">{event.agendaName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-ink">{formatTime(event.start)} - {formatTime(event.end)}</p>
                          <p className="text-sm text-slate-500">{formatPoints(event.points)}</p>
                        </div>
                      </div>

                      {(event.primaryService || event.additionalServices.length > 0 || event.observations.length > 0) && (
                        <div className="mt-4 space-y-3">
                          {event.primaryService && (
                            <div className="rounded-xl border border-teal-100 bg-teal-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">Banho principal</p>
                              <p className="mt-1 text-sm font-medium text-teal-900">{event.primaryService}</p>
                            </div>
                          )}

                          {event.additionalServices.length > 0 && (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Adicionais</p>
                              <div className="flex flex-wrap gap-2">
                                {event.additionalServices.map((service) => (
                                  <span key={`${event.id}-${service}`} className="rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                                    {service}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {event.observations.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Observacoes</p>
                              <div className="mt-1 space-y-1">
                                {event.observations.map((observation) => (
                                  <p key={`${event.id}-${observation}`} className="text-sm text-amber-900">{observation}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">Resumo das proximas vagas</h3>
                <div className="mt-4 space-y-3">
                  {payload.availabilityByService.map((item) => {
                    const agenda = AGENDAS.find((entry) => entry.id === item.selectedAgendaId)!;
                    return <div key={item.selectedAgendaId} className="rounded-2xl bg-slate-50 p-4"><p className="font-medium text-ink">{agenda.serviceLabel}</p><p className="mt-1 text-sm text-slate-600">{item.nextAvailableDateTimeLabel ?? "Sem vaga"}</p><p className="text-sm text-slate-500">{item.nextAvailableStaff.join(", ") || "Sem profissional livre"}</p><p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">{formatPoints(item.servicePoints)} • {formatDurationLabel(item.serviceDurationMinutes)}</p></div>;
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {!loading && payload && activeTab === "equipe" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Equipe" subtitle="Divisao sugerida por profissional para a data selecionada." />
            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-ink">Divisao sugerida por profissional</h3>
                  <p className="text-sm text-slate-500">Sugestao para a data {formatHumanDate(payload.assignmentReport.date)}, respeitando habilitacao e os limites de pontos por periodo.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <button onClick={exportAssignmentCsv} className="inline-flex items-center justify-center gap-2 rounded-full bg-clay px-5 py-3 text-sm font-medium text-white">
                    <Download className="h-4 w-4" />
                    Exportar divisao
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="xl:col-span-2 rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-sm font-medium text-slate-600">Escala visual do dia</p>
                  <div className="mt-4 space-y-4">
                    {payload.assignmentReport.grouped.map((group) => (
                      <div key={`timeline-${group.staffId}`}>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-medium text-ink">{group.staffName}</p>
                          <p className="text-xs text-slate-500">{group.items.length} compromisso(s)</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.items.length === 0 && <span className="rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-500">Livre no dia</span>}
                          {group.items.map((item) => {
                            const visual = getAssignmentVisual(item.agendaName, getStaffColor(group.staffId));

                            return (
                              <div
                                key={`chip-${item.eventId}`}
                                className={cn("rounded-2xl px-3 py-2 text-xs font-medium text-white", visual.chipClassName)}
                                style={{ backgroundColor: visual.chipClassName ? undefined : visual.bgColor }}
                              >
                                <span className="inline-flex items-center gap-2">
                                  {visual.icon}
                                  {formatTime(item.start)} - {formatTime(item.end)} • {item.agendaName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {payload.assignmentReport.grouped.map((group) => (
                  <div key={group.staffId} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-medium text-ink">{group.staffName}</p>
                    <div className="mt-3 space-y-2">
                      {group.items.length === 0 && <p className="text-sm text-slate-500">Sem compromisso sugerido.</p>}
                      {group.items.map((item) => {
                        const visual = getAssignmentVisual(item.agendaName, getStaffColor(group.staffId));

                        return (
                          <div key={item.eventId} className={cn("rounded-xl p-3", visual.cardClassName)}>
                            <p className="text-sm font-medium text-ink">{item.title}</p>
                            <p className={cn("mt-1 inline-flex items-center gap-2 text-sm font-medium", visual.textClassName)}>
                              {visual.icon}
                              {item.agendaName}
                            </p>
                            <p className="text-sm text-slate-500">{formatTime(item.start)} - {formatTime(item.end)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {payload.assignmentReport.unassigned.length > 0 && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-medium text-amber-800">Compromissos sem sugestao de alocacao</p>
                  <div className="mt-3 space-y-2">
                    {payload.assignmentReport.unassigned.map((item) => (
                      <div key={item.eventId} className="rounded-xl bg-white p-3">
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        <p className="text-sm text-slate-500">{item.agendaName}</p>
                        <p className="text-sm text-slate-500">{formatTime(item.start)} - {formatTime(item.end)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && payload && activeTab === "taxi" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Taxi Dog" subtitle="Compromissos do dia identificados pelo marcador de taxi no titulo da agenda." />
            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  {payload.taxiSchedule.length} horario(s) de taxi dog em {formatHumanDate(selectedDate)}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-ink">Horarios do Taxi Dog</h3>
              <div className="mt-4 space-y-3">
                {payload.taxiSchedule.length === 0 && <p className="text-sm text-slate-500">Nenhum taxi dog encontrado para esta data.</p>}
                {payload.taxiSchedule.map((item) => (
                  <div key={item.eventId} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Taxi Dog</p>
                        <p className="mt-1 text-lg font-semibold text-ink">{item.petName}</p>
                        <p className="text-sm text-slate-500">{item.clientName ?? "Cliente nao informado"}</p>
                        {item.phone && <p className="text-sm text-slate-500">{item.phone}</p>}
                        <p className="mt-1 text-sm text-slate-500">{item.agendaName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-ink">{formatTime(item.start)} - {formatTime(item.end)}</p>
                        <p className="text-sm text-slate-500">{formatPoints(item.points)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {!loading && payload && activeTab === "pacotes" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Pacotes" subtitle="Clientes de pacote dos ultimos 60 dias ate os proximos 30 dias, sem duplicar cliente." />
            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {payload.packageClients.length} cliente(s) de pacote encontrados entre os ultimos 60 dias e os proximos 30 dias
              </div>
            </div>

            {packageAgendaBreakdown.length > 0 && <PackageAgendaChart items={packageAgendaBreakdown} />}

            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-ink">Clientes de pacote</h3>
              <div className="mt-4 space-y-3">
                {payload.packageClients.length === 0 && <p className="text-sm text-slate-500">Nenhum pacote encontrado entre os ultimos 60 dias e os proximos 30 dias.</p>}
                {payload.packageClients.map((item) => (
                  <div key={item.eventId} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Pacote</p>
                        <p className="mt-1 text-lg font-semibold text-ink">{item.petName}</p>
                        <p className="text-sm text-slate-500">{item.clientName ?? "Cliente nao informado"}</p>
                        {item.phone && <p className="text-sm text-slate-500">{item.phone}</p>}
                        <p className="mt-1 text-sm text-slate-500">{item.agendaName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-ink">{formatTime(item.start)} - {formatTime(item.end)}</p>
                        <p className="text-sm text-slate-500">{formatPoints(item.points)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {!loading && payload && activeTab === "ranking" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Ranking" subtitle="Leitura por titulo do agendamento para encontrar os pets mais frequentes e os ausentes entre 30 e 60 dias." />
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">Filtro dos pets mais presentes</h3>
                <p className="mt-1 text-sm text-slate-500">Padrao: ultimos 12 meses.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="date" value={rankingTopStart} onChange={(event) => setRankingTopStart(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input type="date" value={rankingTopEnd} onChange={(event) => setRankingTopEnd(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                </div>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">Filtro dos pets sem retorno</h3>
                <p className="mt-1 text-sm text-slate-500">Padrao: ultimos 6 meses.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="date" value={rankingMissingStart} onChange={(event) => setRankingMissingStart(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input type="date" value={rankingMissingEnd} onChange={(event) => setRankingMissingEnd(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                </div>
              </div>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">Pets mais presentes</h3>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Pet</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Telefone</th>
                        <th className="px-4 py-3">Visitas</th>
                        <th className="px-4 py-3">Taxi</th>
                        <th className="px-4 py-3">Ultima visita</th>
                        <th className="px-4 py-3">Pontos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {payload.petInsights.topFrequent.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-slate-500">Sem dados suficientes para o ranking.</td>
                        </tr>
                      )}
                      {payload.petInsights.topFrequent.map((pet) => (
                        <tr key={`top-${pet.petName}`}>
                          <td className="px-4 py-3 font-medium text-ink">{pet.petName}</td>
                          <td className="px-4 py-3">{pet.clientName ?? "--"}</td>
                          <td className="px-4 py-3">{pet.phone ?? "--"}</td>
                          <td className="px-4 py-3">{pet.visits}</td>
                          <td className="px-4 py-3">{pet.taxiVisits}</td>
                          <td className="px-4 py-3">{formatHumanDate(formatDateKey(new Date(pet.lastVisit)))}</td>
                          <td className="px-4 py-3">{formatPoints(pet.totalPoints)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">Pets sem retorno entre 30 e 60 dias</h3>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Pet</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Telefone</th>
                        <th className="px-4 py-3">Dias sem vir</th>
                        <th className="px-4 py-3">Ultima visita</th>
                        <th className="px-4 py-3">Visitas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {payload.petInsights.missingThirtyDays.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-500">Nenhum pet entre 30 e 60 dias sem retorno.</td>
                        </tr>
                      )}
                      {payload.petInsights.missingThirtyDays.map((pet) => (
                        <tr key={`missing-${pet.petName}`}>
                          <td className="px-4 py-3 font-medium text-ink">{pet.petName}</td>
                          <td className="px-4 py-3">{pet.clientName ?? "--"}</td>
                          <td className="px-4 py-3">{pet.phone ?? "--"}</td>
                          <td className="px-4 py-3">{pet.daysSinceLastVisit} dias</td>
                          <td className="px-4 py-3">{formatHumanDate(formatDateKey(new Date(pet.lastVisit)))}</td>
                          <td className="px-4 py-3">{pet.visits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {!loading && payload && activeTab === "checklist" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Checklist" subtitle="Respostas do Google Forms organizadas por pet para consulta rapida da operacao." />
            <div className="grid gap-4 md:grid-cols-3">
              <Card title="Checklists" value={formatNumber(payload.checklist.totalEntries)} subtitle="Registros por pet" />
              <Card title="Tutores" value={formatNumber(payload.checklist.uniqueTutors)} subtitle="Tutores unicos" />
              <Card title="Pets" value={formatNumber(payload.checklist.uniquePets)} subtitle="Pets unicos" />
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
              <input
                type="text"
                value={checklistSearch}
                onChange={(event) => setChecklistSearch(event.target.value)}
                placeholder="Buscar por pet, tutor, telefone ou CPF"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
            </div>

            <div className="space-y-4">
              {filteredChecklistItems.length === 0 && (
                <div className="rounded-3xl border border-white/70 bg-white/90 p-5 text-sm text-slate-500 shadow-panel">
                  Nenhum checklist encontrado para o filtro atual.
                </div>
              )}

              {filteredChecklistItems.map((item) => (
                <div key={item.id} className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Checklist do pet</p>
                      <h3 className="mt-1 text-xl font-semibold text-ink">{item.petName}</h3>
                      <p className="text-sm text-slate-500">{item.tutorName}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                        {item.tutorPhone && <span>{item.tutorPhone}</span>}
                        {item.cpf && <span>CPF: {item.cpf}</span>}
                        {item.tutorAddress && <span>{item.tutorAddress}</span>}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">
                      <p>{item.submittedAt}</p>
                      <p>Pet #{item.petSlot} no formulario</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Raca</p>
                      <p className="mt-2 text-sm text-ink">{item.breed ?? "--"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Idade</p>
                      <p className="mt-2 text-sm text-ink">{item.age ?? "--"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Banho e tosa antes</p>
                      <p className="mt-2 text-sm text-ink">{item.hasBathHistory ?? "--"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Historico de alergia</p>
                      <p className="mt-2 text-sm text-ink">{item.hasSkinAllergyHistory ?? "--"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Medicacao controlada</p>
                      <p className="mt-2 text-sm text-ink">{item.usesControlledMedication ?? "--"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Aceite de Termos</p>
                      <p className="mt-2 text-sm text-ink">{item.termsAccepted ?? "--"}</p>
                    </div>
                  </div>

                  {item.flaggedConditions && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Itens sinalizados</p>
                      <p className="mt-2 text-sm text-amber-900">{item.flaggedConditions}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && payload && activeTab === "pendencias-formulario" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Pendencias de Formulario" subtitle="Pets com banho agendado nos proximos 30 dias e sem checklist preenchido." />
            <div className="grid gap-4 md:grid-cols-3">
              <Card title="Pendencias" value={formatNumber(payload.pendingForms.totalPending)} subtitle="Banhos sem formulario" />
              <Card title="Janela" value="30 dias" subtitle="A partir de hoje" />
              <Card title="Base de contato" value={formatNumber(payload.pendingForms.items.filter((item) => item.phone).length)} subtitle="Com telefone no agendamento" />
            </div>

            <div className="space-y-4">
              {payload.pendingForms.items.length === 0 && (
                <div className="rounded-3xl border border-white/70 bg-white/90 p-5 text-sm text-slate-500 shadow-panel">
                  Nenhum pet com banho agendado esta pendente de formulario neste momento.
                </div>
              )}

              {payload.pendingForms.items.map((item) => (
                <div key={`${item.eventId}-pending`} className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-500">Formulario pendente</p>
                      <h3 className="mt-1 text-xl font-semibold text-ink">{item.petName}</h3>
                      <p className="text-sm text-slate-500">{item.clientName ?? "Cliente nao identificado"}</p>
                      {item.phone && <p className="mt-1 text-sm font-medium text-slate-700">{item.phone}</p>}
                      <p className="mt-1 text-sm text-slate-500">{item.agendaName}</p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <p>{formatHumanDate(formatDateKey(new Date(item.start)))}</p>
                      <p>{formatTime(item.start)} - {formatTime(item.end)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "configuracoes" && (
          <section className="mt-8 space-y-6">
            <SectionTitle title="Configuracoes" subtitle="Altere tempos e funcoes da equipe sem mexer no codigo." />
            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel">
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setSettings(getDefaultSettings())} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white">Restaurar padrao</button>
              </div>
              <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-ink">Servicos</h3>
                  {AGENDAS.map((agenda) => {
                    const config = settings.agendas.find((item) => item.id === agenda.id)!;
                    return <div key={agenda.id} className="rounded-2xl bg-slate-50 p-4"><p className="font-medium text-ink">{agenda.serviceLabel}</p><div className="mt-3 grid gap-3 md:grid-cols-2"><input type="number" min={30} step={10} value={config.durationMinutes} onChange={(event) => updateAgenda(agenda.id, { durationMinutes: Math.max(30, Number(event.target.value) || 30) })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" /><select value={config.requiredSkill} onChange={(event) => updateAgenda(agenda.id, { requiredSkill: event.target.value as StaffSkill })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{SKILLS.map((skill) => <option key={skill.value} value={skill.value}>{skill.label}</option>)}</select></div></div>;
                  })}
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-ink">Equipe</h3>
                  {STAFF.map((member) => {
                    const config = settings.staff.find((item) => item.id === member.id)!;
                    return <div key={member.id} className="rounded-2xl bg-slate-50 p-4"><p className="font-medium text-ink">{member.name}</p><p className="mt-1 text-sm text-slate-500">{skillList(config.skills)}</p><div className="mt-3 flex flex-wrap gap-3">{SKILLS.map((skill) => <label key={skill.value} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600"><input type="checkbox" checked={config.skills.includes(skill.value)} onChange={() => toggleSkill(member.id, skill.value)} />{skill.label}</label>)}</div></div>;
                  })}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
