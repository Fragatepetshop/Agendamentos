import {
  DAILY_POINT_LIMIT,
  GENERAL_TEAM_SIZE,
  SATURDAY_POINT_LIMIT,
  WEEKDAY_AFTERNOON_POINT_LIMIT,
  WEEKDAY_MORNING_POINT_LIMIT,
  getDefaultSettings,
  resolveAgendas,
  resolveStaff
} from "@/lib/config";
import {
  addDays,
  addMinutes,
  buildDateRangePreset,
  createZonedDate,
  enumerateDays,
  formatDateKey,
  formatHumanDate,
  formatTime,
  getBusinessSlots,
  getWorkingWindows,
  nowInAppTimezone,
  startOfMonth,
  startOfWeek
} from "@/lib/date";
import {
  AgendaBreakdown,
  AppSettings,
  AvailabilitySummary,
  CalendarEvent,
  ChecklistSummary,
  DailySummary,
  DashboardPayload,
  FormPendingSummary,
  MonthlyGoalSummary,
  NextAvailabilityInfo,
  PackageClientItem,
  PetInsights,
  ReportSummary,
  SuggestedAssignmentItem,
  SuggestedAssignmentReport,
  TaxiScheduleItem
} from "@/lib/types";
import { parseEventTitle } from "@/lib/event-title";
import { getCapacityStatus, roundPoints, toPercent } from "@/lib/utils";

function normalizeMatchValue(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function filterEventsByRange(events: CalendarEvent[], start: Date, end: Date) {
  return events.filter((event) => {
    const eventStart = new Date(event.start);
    return eventStart >= start && eventStart <= end;
  });
}

function summarizeByAgenda(events: CalendarEvent[], settings?: AppSettings): AgendaBreakdown[] {
  const agendas = resolveAgendas(settings).filter((agenda) => agenda.active);

  return agendas
    .map((agenda) => {
      const agendaEvents = events.filter((event) => event.agendaId === agenda.id);
      const points = roundPoints(agendaEvents.reduce((total, event) => total + event.points, 0));

      return {
        agendaId: agenda.id,
        agendaName: agenda.name,
        points,
        events: agendaEvents.length,
        color: agenda.color
      };
    })
    .sort((a, b) => b.points - a.points);
}

function summarizeDaily(events: CalendarEvent[], start: Date, end: Date): DailySummary[] {
  return enumerateDays(start, end).map((dateKey) => {
    const dayEvents = events.filter((event) => formatDateKey(new Date(event.start)) === dateKey);
    const points = roundPoints(dayEvents.reduce((total, event) => total + event.points, 0));

    return {
      date: dateKey,
      points,
      events: dayEvents.length,
      occupancyPercent: toPercent(points, DAILY_POINT_LIMIT),
      remainingPoints: roundPoints(Math.max(0, DAILY_POINT_LIMIT - points)),
      status: getCapacityStatus(points)
    };
  });
}

function summarizeReport(events: CalendarEvent[], start: Date, end: Date, settings?: AppSettings): ReportSummary {
  const dailyBreakdown = summarizeDaily(events, start, end);
  const totalPoints = roundPoints(dailyBreakdown.reduce((total, day) => total + day.points, 0));
  const activeDays = dailyBreakdown.filter((day) => day.events > 0).length || 1;

  return {
    totalPoints,
    totalEvents: events.length,
    averagePointsPerDay: roundPoints(totalPoints / activeDays),
    busiestDays: [...dailyBreakdown].sort((a, b) => b.points - a.points).slice(0, 5),
    agendaBreakdown: summarizeByAgenda(events, settings),
    dailyBreakdown
  };
}

function buildMonthlyGoalSummary(currentPoints: number, referenceDate: Date): MonthlyGoalSummary {
  const monthRange = buildDateRangePreset("este-mes", referenceDate);
  const monthDays = enumerateDays(monthRange.start, monthRange.end);
  const maxPoints = monthDays.reduce((total, dateKey) => {
    const dayOfWeek = createZonedDate(dateKey).getUTCDay();
    if (dayOfWeek === 0) return total;
    if (dayOfWeek === 6) return total + SATURDAY_POINT_LIMIT;
    return total + DAILY_POINT_LIMIT;
  }, 0);
  const targetPoints = roundPoints(maxPoints * 0.8);

  return {
    monthLabel: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      month: "long",
      year: "numeric"
    }).format(referenceDate),
    maxPoints,
    targetPoints,
    currentPoints,
    remainingToTarget: roundPoints(Math.max(0, targetPoints - currentPoints)),
    progressPercent: toPercent(currentPoints, targetPoints)
  };
}

function normalizePetName(title: string) {
  return parseEventTitle(title).petName;
}

function buildPetInsights(
  events: CalendarEvent[],
  referenceDate: Date,
  topStart: Date,
  topEnd: Date,
  missingStart: Date,
  missingEnd: Date
): PetInsights {
  const topEvents = filterEventsByRange(events, topStart, topEnd);
  const missingEvents = filterEventsByRange(events, missingStart, missingEnd);

  function groupPets(sourceEvents: CalendarEvent[]) {
    const grouped = new Map<
      string,
      {
        clientName: string | null;
        phone: string | null;
        taxiVisits: number;
        visits: number;
        lastVisit: string;
        totalPoints: number;
      }
    >();

    for (const event of sourceEvents) {
      const parsed = parseEventTitle(event.title);
      const petName = normalizePetName(event.title);
      const groupKey = [petName, parsed.clientName ?? ""].join("|");
      const current = grouped.get(groupKey);

      if (!current) {
        grouped.set(groupKey, {
          clientName: parsed.clientName,
          phone: parsed.phone,
          taxiVisits: parsed.isTaxi ? 1 : 0,
          visits: 1,
          lastVisit: event.start,
          totalPoints: event.points
        });
        continue;
      }

      grouped.set(groupKey, {
        clientName: current.clientName ?? parsed.clientName,
        phone: parsed.phone ?? current.phone,
        taxiVisits: current.taxiVisits + (parsed.isTaxi ? 1 : 0),
        visits: current.visits + 1,
        lastVisit: new Date(event.start) > new Date(current.lastVisit) ? event.start : current.lastVisit,
        totalPoints: roundPoints(current.totalPoints + event.points)
      });
    }

    return [...grouped.entries()].map(([groupKey, summary]) => {
      const [petName] = groupKey.split("|");
      const lastVisitDate = new Date(summary.lastVisit);
      const daysSinceLastVisit = Math.floor((referenceDate.getTime() - lastVisitDate.getTime()) / 86400000);

      return {
        petName,
        clientName: summary.clientName,
        phone: summary.phone,
        taxiVisits: summary.taxiVisits,
        visits: summary.visits,
        lastVisit: summary.lastVisit,
        daysSinceLastVisit: Math.max(0, daysSinceLastVisit),
        totalPoints: roundPoints(summary.totalPoints)
      };
    });
  }

  const topItems = groupPets(topEvents);
  const missingItems = groupPets(missingEvents);

  return {
    topFrequent: [...topItems]
      .sort((a, b) => b.visits - a.visits || new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime() || a.petName.localeCompare(b.petName))
      .slice(0, 10),
    missingThirtyDays: missingItems
      .filter((item) => item.daysSinceLastVisit >= 30 && item.daysSinceLastVisit <= 60)
      .sort((a, b) => a.daysSinceLastVisit - b.daysSinceLastVisit || a.petName.localeCompare(b.petName))
      .slice(0, 20)
  };
}

function buildTaxiSchedule(events: CalendarEvent[], dateKey: string): TaxiScheduleItem[] {
  return events
    .filter((event) => formatDateKey(new Date(event.start)) === dateKey)
    .map((event) => {
      const parsed = parseEventTitle(event.title);
      return {
        eventId: event.id,
        title: event.title,
        petName: parsed.petName,
        clientName: parsed.clientName,
        phone: parsed.phone,
        agendaName: event.agendaName,
        start: event.start,
        end: event.end,
        points: event.points
      };
    })
    .filter((item) => parseEventTitle(item.title).isTaxi)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function buildPackageClients(events: CalendarEvent[], referenceDate: Date): PackageClientItem[] {
  const referenceEnd = createZonedDate(formatDateKey(addDays(referenceDate, 30)), "23:59");
  const rangeStart = addDays(createZonedDate(formatDateKey(referenceDate)), -60);
  const validPackageAgendaIds = new Set(["porte-pequeno", "porte-medio", "porte-grande"]);
  const packageHistory = events
    .map((event) => {
      const parsed = parseEventTitle(event.title);
      return {
        ...event,
        parsed,
        clientKey: [parsed.petName, parsed.clientName ?? ""].join("|")
      };
    });

  const recentPackageEvents = filterEventsByRange(events, rangeStart, referenceEnd)
    .map((event) => {
      const parsed = parseEventTitle(event.title);
      const clientKey = [parsed.petName, parsed.clientName ?? ""].join("|");
      const fallbackPackage = !validPackageAgendaIds.has(event.agendaId)
        ? packageHistory
            .filter((historyEvent) => historyEvent.clientKey === clientKey && validPackageAgendaIds.has(historyEvent.agendaId))
            .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0]
        : null;

      return {
        eventId: event.id,
        title: event.title,
        petName: parsed.petName,
        clientName: parsed.clientName,
        phone: parsed.phone,
        agendaId: fallbackPackage?.agendaId ?? event.agendaId,
        agendaName: fallbackPackage?.agendaName ?? event.agendaName,
        start: event.start,
        end: event.end,
        points: fallbackPackage?.points ?? event.points
      };
    })
    .filter((item) => parseEventTitle(item.title).isPackage)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  const uniqueClients = new Map<string, PackageClientItem>();

  for (const item of recentPackageEvents) {
    const clientKey = [item.clientName ?? "", item.phone ?? "", item.petName].join("|");
    if (!uniqueClients.has(clientKey)) {
      uniqueClients.set(clientKey, item);
    }
  }

  return [...uniqueClients.values()].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
}

function buildPendingForms(events: CalendarEvent[], checklist: ChecklistSummary | undefined, referenceDate: Date): FormPendingSummary {
  const bathAgendaIds = new Set(["porte-pequeno", "porte-medio", "porte-grande"]);
  const rangeStart = createZonedDate(formatDateKey(referenceDate));
  const rangeEnd = createZonedDate(formatDateKey(addDays(referenceDate, 30)), "23:59");
  const checklistItems = checklist?.items ?? [];
  const knownForms = new Set(
    checklistItems.flatMap((item) => {
      const pet = normalizeMatchValue(item.petName);
      const tutor = normalizeMatchValue(item.tutorName);
      return tutor ? [`${pet}|${tutor}`, pet] : [pet];
    })
  );

  const uniquePending = new Map<string, FormPendingSummary["items"][number]>();

  for (const event of filterEventsByRange(events, rangeStart, rangeEnd)) {
    if (!bathAgendaIds.has(event.agendaId)) continue;

    const parsed = parseEventTitle(event.title);
    const petKey = normalizeMatchValue(parsed.petName);
    const tutorKey = normalizeMatchValue(parsed.clientName);
    const combinedKey = tutorKey ? `${petKey}|${tutorKey}` : petKey;
    const hasChecklist = knownForms.has(combinedKey) || knownForms.has(petKey);

    if (hasChecklist) continue;

    const uniqueKey = [petKey, tutorKey || parsed.phone || "", event.start].join("|");
    if (!uniquePending.has(uniqueKey)) {
      uniquePending.set(uniqueKey, {
        eventId: event.id,
        petName: parsed.petName,
        clientName: parsed.clientName,
        phone: parsed.phone,
        agendaName: event.agendaName,
        start: event.start,
        end: event.end,
        title: event.title
      });
    }
  }

  const items = [...uniquePending.values()].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return {
    totalPending: items.length,
    items
  };
}

function overlapEvents(a: { start: string; end: string }, b: { start: string; end: string }) {
  return new Date(a.start) < new Date(b.end) && new Date(a.end) > new Date(b.start);
}

function getPeriodKey(dateKey: string, start: Date) {
  const day = createZonedDate(dateKey).getUTCDay();
  if (day === 0) return "fechado";
  if (day === 6) return "sabado";
  const lunchStart = createZonedDate(dateKey, "11:30");
  return start < lunchStart ? "manha" : "tarde";
}

function getPeriodPointLimit(periodKey: string) {
  switch (periodKey) {
    case "manha":
      return WEEKDAY_MORNING_POINT_LIMIT;
    case "tarde":
      return WEEKDAY_AFTERNOON_POINT_LIMIT;
    case "sabado":
      return SATURDAY_POINT_LIMIT;
    default:
      return 0;
  }
}

function getPeriodPoints(events: CalendarEvent[], dateKey: string, periodKey: string) {
  return roundPoints(
    events
      .filter((event) => formatDateKey(new Date(event.start)) === dateKey)
      .filter((event) => getPeriodKey(dateKey, new Date(event.start)) === periodKey)
      .reduce((total, event) => total + event.points, 0)
  );
}

function countSimultaneousEvents(events: CalendarEvent[], slotStart: Date, slotEnd: Date) {
  const checkpoints = new Set<number>([slotStart.getTime()]);

  for (const event of events) {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    if (eventStart < slotEnd && eventEnd > slotStart) {
      checkpoints.add(Math.max(slotStart.getTime(), eventStart.getTime()));
      checkpoints.add(Math.min(slotEnd.getTime(), eventEnd.getTime()));
    }
  }

  let peak = 0;

  for (const checkpoint of checkpoints) {
    const concurrent = events.filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const point = new Date(checkpoint);
      return eventStart <= point && eventEnd > point;
    }).length;

    peak = Math.max(peak, concurrent);
  }

  return peak;
}

function getQualifiedStaff(agendaId: string, settings?: AppSettings) {
  const agendas = resolveAgendas(settings);
  const staff = resolveStaff(settings);
  const agenda = agendas.find((item) => item.id === agendaId) ?? agendas[0];
  return staff.filter((member) => member.skills.includes(agenda.requiredSkill));
}

function findPeakOverlappingEvents(events: CalendarEvent[], slotStart: Date, slotEnd: Date) {
  const checkpoints = new Set<number>([slotStart.getTime()]);

  for (const event of events) {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    if (eventStart < slotEnd && eventEnd > slotStart) {
      checkpoints.add(Math.max(slotStart.getTime(), eventStart.getTime()));
      checkpoints.add(Math.min(slotEnd.getTime(), eventEnd.getTime()));
    }
  }

  let peakEvents: CalendarEvent[] = [];

  for (const checkpoint of checkpoints) {
    const point = new Date(checkpoint);
    const overlapping = events.filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return eventStart <= point && eventEnd > point;
    });

    if (overlapping.length > peakEvents.length) {
      peakEvents = overlapping;
    }
  }

  return peakEvents;
}

function isWithinOperationalWindow(selectedDate: string, slotStart: Date, slotEnd: Date) {
  const workingWindows = getWorkingWindows(selectedDate);
  if (workingWindows.length === 0) return false;
  return workingWindows.some((window) => slotStart >= window.start && slotEnd <= window.end);
}

function canStaffHandleEvent(
  assignedItems: SuggestedAssignmentItem[],
  candidate: { start: string; end: string },
  candidateAgendaId: string,
  staffId: string,
  settings?: AppSettings
) {
  const staff = resolveStaff(settings).find((member) => member.id === staffId);
  if (!staff) return false;
  const agenda = resolveAgendas(settings).find((item) => item.id === candidateAgendaId);
  if (!agenda || !staff.skills.includes(agenda.requiredSkill)) return false;

  return true;
}

function getAssignmentScore(
  staffId: string,
  event: CalendarEvent,
  dateKey: string,
  assignments: Map<string, SuggestedAssignmentItem[]>,
  settings?: AppSettings
) {
  const assignedItems = assignments.get(staffId) ?? [];
  const assignedEvents = assignedItems.map((item) => ({
    start: item.start,
    end: item.end,
    points: item.points
  }));
  const totalAssignedPoints = roundPoints(assignedEvents.reduce((sum, item) => sum + item.points, 0));
  const periodKey = getPeriodKey(dateKey, new Date(event.start));
  const periodAssignedPoints = roundPoints(
    assignedEvents
      .filter((item) => getPeriodKey(dateKey, new Date(item.start)) === periodKey)
      .reduce((sum, item) => sum + item.points, 0)
  );
  const concurrentAtStart = assignedItems.filter((item) => overlapEvents(item, event)).length;

  return {
    concurrentAtStart,
    totalAssignedPoints,
    totalAssignedItems: assignedItems.length,
    periodAssignedPoints
  };
}

function buildAssignmentReport(events: CalendarEvent[], dateKey: string, settings?: AppSettings): SuggestedAssignmentReport {
  const staff = resolveStaff(settings);
  const dayEvents = events
    .filter((event) => formatDateKey(new Date(event.start)) === dateKey)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const assignments = new Map<string, SuggestedAssignmentItem[]>();
  const unassigned: SuggestedAssignmentItem[] = [];

  for (const member of staff) {
    assignments.set(member.id, []);
  }

  for (const event of dayEvents) {
    const qualified = getQualifiedStaff(event.agendaId, settings);
    const rankedQualified = qualified
      .filter((member) => canStaffHandleEvent(assignments.get(member.id) ?? [], event, event.agendaId, member.id, settings))
      .sort((a, b) => {
        const scoreA = getAssignmentScore(a.id, event, dateKey, assignments, settings);
        const scoreB = getAssignmentScore(b.id, event, dateKey, assignments, settings);

        if (scoreA.concurrentAtStart !== scoreB.concurrentAtStart) {
          return scoreA.concurrentAtStart - scoreB.concurrentAtStart;
        }

        if (scoreA.totalAssignedItems !== scoreB.totalAssignedItems) {
          return scoreA.totalAssignedItems - scoreB.totalAssignedItems;
        }

        if (scoreA.periodAssignedPoints !== scoreB.periodAssignedPoints) {
          return scoreA.periodAssignedPoints - scoreB.periodAssignedPoints;
        }

        if (scoreA.totalAssignedPoints !== scoreB.totalAssignedPoints) {
          return scoreA.totalAssignedPoints - scoreB.totalAssignedPoints;
        }

        return a.name.localeCompare(b.name);
      });
    const assignedStaff = rankedQualified[0];

    const item: SuggestedAssignmentItem = {
      eventId: event.id,
      title: event.title,
      agendaName: event.agendaName,
      start: event.start,
      end: event.end,
      points: event.points,
      staffId: assignedStaff?.id ?? null,
      staffName: assignedStaff?.name ?? null
    };

    if (assignedStaff) {
      assignments.set(assignedStaff.id, [...(assignments.get(assignedStaff.id) ?? []), item]);
    } else {
      unassigned.push(item);
    }
  }

  return {
    date: dateKey,
    grouped: staff.map((member) => ({
      staffId: member.id,
      staffName: member.name,
      items: assignments.get(member.id) ?? []
    })),
    unassigned
  };
}

function findAvailableStaffForSlot(
  assignmentReport: SuggestedAssignmentReport,
  candidate: { start: string; end: string },
  candidateAgendaId: string,
  settings?: AppSettings
) {
  const available = assignmentReport.grouped.filter((group) => canStaffHandleEvent(group.items, candidate, candidateAgendaId, group.staffId, settings));
  return available.map((group) => group.staffName);
}

function getTesouraRules(dayEvents: CalendarEvent[], selectedDate: string, slotStart: Date, agendaId: string) {
  if (agendaId !== "tosa-tesoura") {
    return {
      exceedsTesouraStartInterval: false,
      exceedsTesouraPeriodLimit: false
    };
  }

  const tesouraEvents = dayEvents.filter((event) => event.agendaId === "tosa-tesoura");
  const candidatePeriod = getPeriodKey(selectedDate, slotStart);
  const periodMax = candidatePeriod === "manha" ? 2 : candidatePeriod === "tarde" ? 3 : 0;
  const samePeriodCount = tesouraEvents.filter((event) => getPeriodKey(selectedDate, new Date(event.start)) === candidatePeriod).length;
  const exceedsTesouraPeriodLimit = periodMax > 0 && samePeriodCount >= periodMax;
  const exceedsTesouraStartInterval = tesouraEvents.some((event) => Math.abs(new Date(event.start).getTime() - slotStart.getTime()) < 120 * 60000);

  return {
    exceedsTesouraStartInterval,
    exceedsTesouraPeriodLimit
  };
}

function buildAvailability(events: CalendarEvent[], selectedDate: string, agendaId: string, settings?: AppSettings): AvailabilitySummary {
  const agendas = resolveAgendas(settings);
  const agenda = agendas.find((item) => item.id === agendaId) ?? agendas[0];
  const dayEvents = events.filter((event) => formatDateKey(new Date(event.start)) === selectedDate);
  const assignmentReport = buildAssignmentReport(events, selectedDate, settings);
  const dayPoints = roundPoints(dayEvents.reduce((total, event) => total + event.points, 0));
  const remainingPoints = roundPoints(Math.max(0, DAILY_POINT_LIMIT - dayPoints));
  const slots = getBusinessSlots(selectedDate);

  const slotAvailability = slots.map((slotStart) => {
    const slotEnd = addMinutes(slotStart, agenda.durationMinutes);
    const occupiedSeats = countSimultaneousEvents(dayEvents, slotStart, slotEnd);
    const availableSeats = Math.max(0, GENERAL_TEAM_SIZE - occupiedSeats);
    const outsideWindow = !isWithinOperationalWindow(selectedDate, slotStart, slotEnd);
    const periodKey = getPeriodKey(selectedDate, slotStart);
    const periodLimit = getPeriodPointLimit(periodKey);
    const currentPeriodPoints = getPeriodPoints(dayEvents, selectedDate, periodKey);
    const exceedsPointLimit = dayPoints + agenda.points > DAILY_POINT_LIMIT;
    const exceedsPeriodLimit = currentPeriodPoints + agenda.points > periodLimit;
    const { exceedsTesouraStartInterval, exceedsTesouraPeriodLimit } = getTesouraRules(dayEvents, selectedDate, slotStart, agenda.id);
    const overloaded = occupiedSeats >= GENERAL_TEAM_SIZE;
    const availableStaff = findAvailableStaffForSlot(
      assignmentReport,
      { start: slotStart.toISOString(), end: slotEnd.toISOString() },
      agenda.id,
      settings
    );
    const qualifiedBlocked = availableStaff.length === 0;
    const blockedReason = outsideWindow
      ? "Fora do horario operacional"
      : exceedsPointLimit
        ? "Limite diario de 40 pontos atingido"
        : exceedsPeriodLimit
          ? `Limite de ${periodLimit} pontos para este periodo atingido`
          : exceedsTesouraStartInterval
            ? "Tosa na tesoura exige 2 horas entre inicios"
            : exceedsTesouraPeriodLimit
              ? `Limite de tosa na tesoura para ${periodKey === "manha" ? "a manha" : "a tarde"} atingido`
              : overloaded
                ? "Equipe totalmente ocupada"
                : qualifiedBlocked
                  ? "Nenhuma funcionaria habilitada livre para este servico"
                  : null;

    return {
      startsAt: slotStart.toISOString(),
      time: formatTime(slotStart),
      label: `${formatTime(slotStart)} - ${formatTime(slotEnd)}`,
      availableSeats: qualifiedBlocked ? 0 : Math.min(availableSeats, Math.max(0, availableStaff.length)),
      occupiedSeats,
      isAvailable: !outsideWindow && !exceedsPointLimit && !exceedsPeriodLimit && !exceedsTesouraStartInterval && !exceedsTesouraPeriodLimit && !overloaded && !qualifiedBlocked,
      blockedReason,
      availableStaff,
      suggestedStaff: availableStaff.slice(0, 1)
    };
  });

  const nextSlot = slotAvailability.find((slot) => slot.isAvailable) ?? null;

  return {
    selectedDate,
    selectedAgendaId: agenda.id,
    servicePoints: agenda.points,
    serviceDurationMinutes: agenda.durationMinutes,
    dayPoints,
    remainingPoints,
    nextAvailableTime: nextSlot?.time ?? null,
    nextAvailableDate: nextSlot ? selectedDate : null,
    nextAvailableStartsAt: nextSlot?.startsAt ?? null,
    nextAvailableDateTimeLabel: nextSlot ? `${formatHumanDate(selectedDate)} as ${nextSlot.time}` : null,
    nextAvailableStaff: nextSlot?.suggestedStaff ?? [],
    slotAvailability
  };
}

function findNextAvailableDateTime(events: CalendarEvent[], agendaId: string, fromDate = nowInAppTimezone(), settings?: AppSettings) {
  const baseDate = createZonedDate(formatDateKey(fromDate));

  for (let offset = 0; offset < 45; offset += 1) {
    const currentDate = addDays(baseDate, offset);
    const dateKey = formatDateKey(currentDate);
    const availability = buildAvailability(events, dateKey, agendaId, settings);
    const nextSlot = availability.slotAvailability.find((slot) => slot.isAvailable && new Date(slot.startsAt) >= fromDate);

    if (nextSlot) {
      return {
        startsAt: nextSlot.startsAt,
        dateLabel: formatHumanDate(dateKey),
        dateTimeLabel: `${formatHumanDate(dateKey)} as ${nextSlot.time}`,
        staff: nextSlot.suggestedStaff
      };
    }
  }

  return {
    startsAt: null,
    dateLabel: null,
    dateTimeLabel: null,
    staff: []
  };
}

export function buildCsv(events: CalendarEvent[]) {
  const headers = ["Data", "Inicio", "Fim", "Agenda", "Servico", "Pontos", "Titulo"];
  const rows = events.map((event) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const dateKey = formatDateKey(start);

    return [
      dateKey,
      formatTime(start),
      formatTime(end),
      event.agendaName,
      resolveAgendas(getDefaultSettings()).find((agenda) => agenda.id === event.agendaId)?.serviceLabel ?? event.agendaName,
      String(event.points).replace(".", ","),
      `"${event.title.replace(/"/g, '""')}"`
    ].join(";");
  });

  return [headers.join(";"), ...rows].join("\n");
}

export function buildDashboardPayload(
  events: CalendarEvent[],
  selectedDate?: string,
  selectedAgendaId?: string,
  reportStart?: Date,
  reportEnd?: Date,
  settings?: AppSettings,
  rankingTopStart?: Date,
  rankingTopEnd?: Date,
  rankingMissingStart?: Date,
  rankingMissingEnd?: Date,
  checklist?: ChecklistSummary
): DashboardPayload {
  const now = nowInAppTimezone();
  const todayKey = formatDateKey(now);
  const availabilityDateKey = selectedDate ?? todayKey;
  const agendas = resolveAgendas(settings).filter((agenda) => agenda.active);
  const todayStart = createZonedDate(todayKey);
  const todayEnd = createZonedDate(todayKey, "23:59");
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const monthEnd = buildDateRangePreset("este-mes", now).end;

  const todayEvents = filterEventsByRange(events, todayStart, todayEnd);
  const weekEvents = filterEventsByRange(events, weekStart, buildDateRangePreset("esta-semana", now).end);
  const monthEvents = filterEventsByRange(events, monthStart, monthEnd);

  const defaultReportRange = buildDateRangePreset("este-mes", now);
  const report = summarizeReport(
    filterEventsByRange(events, reportStart ?? defaultReportRange.start, reportEnd ?? defaultReportRange.end),
    reportStart ?? defaultReportRange.start,
    reportEnd ?? defaultReportRange.end,
    settings
  );

  const todayPoints = roundPoints(todayEvents.reduce((total, event) => total + event.points, 0));
  const todaySummary: DailySummary = {
    date: todayKey,
    points: todayPoints,
    events: todayEvents.length,
    occupancyPercent: toPercent(todayPoints, DAILY_POINT_LIMIT),
    remainingPoints: roundPoints(Math.max(0, DAILY_POINT_LIMIT - todayPoints)),
    status: getCapacityStatus(todayPoints)
  };
  const monthGoal = buildMonthlyGoalSummary(roundPoints(monthEvents.reduce((total, event) => total + event.points, 0)), now);

  const availabilityByService = agendas.map((agenda) => {
    const currentDateAvailability = buildAvailability(events, availabilityDateKey, agenda.id, settings);
    const nextActual = findNextAvailableDateTime(events, agenda.id, now, settings);

    return {
      ...currentDateAvailability,
      nextAvailableDate: nextActual.dateLabel,
      nextAvailableStartsAt: nextActual.startsAt,
      nextAvailableDateTimeLabel: nextActual.dateTimeLabel,
      nextAvailableStaff: nextActual.staff
    };
  });

  const selectedAvailabilityBase = buildAvailability(events, availabilityDateKey, selectedAgendaId ?? agendas[0].id, settings);
  const selectedNextActual = findNextAvailableDateTime(events, selectedAgendaId ?? agendas[0].id, now, settings);
  const selectedAvailability = {
    ...selectedAvailabilityBase,
    nextAvailableDate: selectedNextActual.dateLabel,
    nextAvailableStartsAt: selectedNextActual.startsAt,
    nextAvailableDateTimeLabel: selectedNextActual.dateTimeLabel,
    nextAvailableStaff: selectedNextActual.staff
  };

  const overallNextAvailability: NextAvailabilityInfo | null = availabilityByService
    .map((availability) => {
      const agenda = agendas.find((item) => item.id === availability.selectedAgendaId)!;
      return {
        agendaId: availability.selectedAgendaId,
        serviceLabel: agenda.serviceLabel,
        startsAt: availability.nextAvailableStartsAt,
        dateLabel: availability.nextAvailableDate,
        dateTimeLabel: availability.nextAvailableDateTimeLabel,
        staff: availability.nextAvailableStaff
      };
    })
    .filter((item) => item.startsAt)
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())[0] ?? null;

  const assignmentReport = buildAssignmentReport(events, availabilityDateKey, settings);
  const petInsights = buildPetInsights(
    events,
    now,
    rankingTopStart ?? addDays(now, -365),
    rankingTopEnd ?? now,
    rankingMissingStart ?? addDays(now, -180),
    rankingMissingEnd ?? now
  );
  const taxiSchedule = buildTaxiSchedule(events, availabilityDateKey);
  const packageClients = buildPackageClients(events, now);
  const pendingForms = buildPendingForms(events, checklist, now);

  return {
    generatedAt: new Date().toISOString(),
    timezone: "America/Sao_Paulo",
    today: todaySummary,
    weekPoints: roundPoints(weekEvents.reduce((total, event) => total + event.points, 0)),
    monthPoints: roundPoints(monthEvents.reduce((total, event) => total + event.points, 0)),
    monthGoal,
    todayEventsCount: todayEvents.length,
    todayAgendaBreakdown: summarizeByAgenda(todayEvents, settings),
    report,
    availabilityByService,
    selectedAvailability,
    overallNextAvailability,
    assignmentReport,
    petInsights,
    taxiSchedule,
    packageClients,
    checklist: checklist ?? { totalEntries: 0, uniqueTutors: 0, uniquePets: 0, items: [] },
    pendingForms,
    events
  };
}
