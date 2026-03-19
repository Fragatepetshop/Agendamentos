export type AgendaConfig = {
  id: string;
  name: string;
  url: string;
  points: number;
  color: string;
  active: boolean;
  serviceLabel: string;
  durationMinutes: number;
  requiredSkill: StaffSkill;
};

export type StaffSkill = "banho" | "tosa-maquina" | "tosa-tesoura";

export type StaffMember = {
  id: string;
  name: string;
  skills: StaffSkill[];
  color: string;
};

export type AppSettings = {
  agendas: Array<{
    id: string;
    durationMinutes: number;
    requiredSkill: StaffSkill;
  }>;
  staff: Array<{
    id: string;
    skills: StaffSkill[];
  }>;
  contacts: Array<{
    petName: string;
    clientName: string;
    phone: string;
  }>;
};

export type ContactRecord = {
  petName: string;
  clientName: string;
  phone: string;
};

export type CalendarEvent = {
  id: string;
  agendaId: string;
  agendaName: string;
  title: string;
  description: string | null;
  primaryService: string | null;
  additionalServices: string[];
  observations: string[];
  start: string;
  end: string;
  points: number;
  color: string;
};

export type CapacityStatus = "confortavel" | "atencao" | "quase-cheio" | "lotado";

export type DailySummary = {
  date: string;
  points: number;
  events: number;
  occupancyPercent: number;
  remainingPoints: number;
  status: CapacityStatus;
};

export type AgendaBreakdown = {
  agendaId: string;
  agendaName: string;
  points: number;
  events: number;
  color: string;
};

export type SlotAvailability = {
  startsAt: string;
  time: string;
  label: string;
  availableSeats: number;
  occupiedSeats: number;
  isAvailable: boolean;
  blockedReason: string | null;
  availableStaff: string[];
  suggestedStaff: string[];
};

export type AvailabilitySummary = {
  selectedDate: string;
  selectedAgendaId: string;
  servicePoints: number;
  serviceDurationMinutes: number;
  dayPoints: number;
  remainingPoints: number;
  nextAvailableTime: string | null;
  nextAvailableDate: string | null;
  nextAvailableStartsAt: string | null;
  nextAvailableDateTimeLabel: string | null;
  nextAvailableStaff: string[];
  slotAvailability: SlotAvailability[];
};

export type NextAvailabilityInfo = {
  agendaId: string;
  serviceLabel: string;
  startsAt: string | null;
  dateLabel: string | null;
  dateTimeLabel: string | null;
  staff: string[];
};

export type SuggestedAssignmentItem = {
  eventId: string;
  title: string;
  agendaName: string;
  start: string;
  end: string;
  points: number;
  staffId: string | null;
  staffName: string | null;
};

export type SuggestedAssignmentGroup = {
  staffId: string;
  staffName: string;
  items: SuggestedAssignmentItem[];
};

export type SuggestedAssignmentReport = {
  date: string;
  grouped: SuggestedAssignmentGroup[];
  unassigned: SuggestedAssignmentItem[];
};

export type ReportSummary = {
  totalPoints: number;
  totalEvents: number;
  averagePointsPerDay: number;
  busiestDays: DailySummary[];
  agendaBreakdown: AgendaBreakdown[];
  dailyBreakdown: DailySummary[];
};

export type MonthlyGoalSummary = {
  monthLabel: string;
  maxPoints: number;
  targetPoints: number;
  currentPoints: number;
  remainingToTarget: number;
  progressPercent: number;
};

export type PetRankingItem = {
  petName: string;
  clientName: string | null;
  phone: string | null;
  taxiVisits: number;
  visits: number;
  lastVisit: string;
  daysSinceLastVisit: number;
  totalPoints: number;
};

export type PetInsights = {
  topFrequent: PetRankingItem[];
  missingThirtyDays: PetRankingItem[];
};

export type TaxiScheduleItem = {
  eventId: string;
  title: string;
  petName: string;
  clientName: string | null;
  phone: string | null;
  agendaName: string;
  start: string;
  end: string;
  points: number;
};

export type PackageClientItem = {
  eventId: string;
  title: string;
  petName: string;
  clientName: string | null;
  phone: string | null;
  agendaId: string;
  agendaName: string;
  start: string;
  end: string;
  points: number;
};

export type ChecklistItem = {
  id: string;
  submittedAt: string;
  tutorName: string;
  cpf: string | null;
  tutorPhone: string | null;
  tutorAddress: string | null;
  petName: string;
  petSlot: number;
  breed: string | null;
  age: string | null;
  hasBathHistory: string | null;
  hasSkinAllergyHistory: string | null;
  usesControlledMedication: string | null;
  flaggedConditions: string | null;
  termsAccepted: string | null;
};

export type ChecklistSummary = {
  totalEntries: number;
  uniqueTutors: number;
  uniquePets: number;
  items: ChecklistItem[];
};

export type FormPendingItem = {
  eventId: string;
  petName: string;
  clientName: string | null;
  phone: string | null;
  agendaName: string;
  start: string;
  end: string;
  title: string;
};

export type FormPendingSummary = {
  totalPending: number;
  items: FormPendingItem[];
};

export type WhatsAppReminderStatus = "agendado" | "pronto" | "sem-telefone" | "expirado";

export type WhatsAppReminderItem = {
  eventId: string;
  title: string;
  petName: string;
  clientName: string | null;
  phone: string | null;
  agendaName: string;
  start: string;
  end: string;
  scheduledSendAt: string;
  message: string | null;
  whatsappUrl: string | null;
  status: WhatsAppReminderStatus;
};

export type WhatsAppReminderSummary = {
  total: number;
  dueNow: number;
  scheduled: number;
  withoutPhone: number;
  expired: number;
  items: WhatsAppReminderItem[];
};

export type DashboardPayload = {
  generatedAt: string;
  timezone: string;
  today: DailySummary;
  weekPoints: number;
  monthPoints: number;
  monthGoal: MonthlyGoalSummary;
  todayEventsCount: number;
  todayAgendaBreakdown: AgendaBreakdown[];
  report: ReportSummary;
  availabilityByService: AvailabilitySummary[];
  selectedAvailability: AvailabilitySummary;
  overallNextAvailability: NextAvailabilityInfo | null;
  assignmentReport: SuggestedAssignmentReport;
  petInsights: PetInsights;
  taxiSchedule: TaxiScheduleItem[];
  packageClients: PackageClientItem[];
  checklist: ChecklistSummary;
  pendingForms: FormPendingSummary;
  whatsappReminders: WhatsAppReminderSummary;
  events: CalendarEvent[];
};
