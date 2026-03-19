import { AgendaConfig, AppSettings, StaffMember } from "@/lib/types";

export const APP_TIMEZONE = "America/Sao_Paulo";
export const DAILY_POINT_LIMIT = 40;
export const MAX_CONCURRENT_APPOINTMENTS = 4;
export const WORKDAY_START = "08:30";
export const LUNCH_START = "11:30";
export const LUNCH_END = "13:00";
export const WORKDAY_END = "18:00";
export const SATURDAY_START = "08:00";
export const SATURDAY_END = "12:00";
export const SLOT_INTERVAL_MINUTES = 30;
export const GENERAL_TEAM_SIZE = 4;
export const WEEKDAY_MORNING_POINT_LIMIT = 15;
export const WEEKDAY_AFTERNOON_POINT_LIMIT = 25;
export const SATURDAY_POINT_LIMIT = 20;
export const GOOGLE_FORMS_SHEET_ID = "1mVM-qQ6ka412NXM_Q8ldhCCa4InMms0t7pypVE6wtNk";
export const GOOGLE_FORMS_SHEET_NAME = "Forms_Responses";
export const WHATSAPP_REMINDER_LOOKAHEAD_DAYS = 7;

export const STAFF: StaffMember[] = [
  { id: "bruna", name: "Bruna", skills: ["banho", "tosa-tesoura"], color: "#BE123C" },
  { id: "angelita", name: "Angelita", skills: ["banho"], color: "#0F766E" },
  { id: "ana", name: "Ana", skills: ["banho"], color: "#1D4ED8" },
  { id: "tais", name: "Tais", skills: ["banho", "tosa-maquina"], color: "#7C3AED" }
];

// Duracoes padrao configuraveis por agenda. Ajuste conforme a operacao real.
export const AGENDAS: AgendaConfig[] = [
  {
    id: "porte-pequeno",
    name: "Porte Pequeno até 10kg",
    url: "https://calendar.google.com/calendar/ical/683c923fbaad9dfc6a86d1ef1b1f9c02d540970965f9574e0a9dc5f4ecf0bc4a%40group.calendar.google.com/public/basic.ics",
    points: 1,
    color: "#1D4ED8",
    active: true,
    serviceLabel: "Porte Pequeno",
    durationMinutes: 80,
    requiredSkill: "banho"
  },
  {
    id: "porte-medio",
    name: "Porte Médio 10 a 25kg",
    url: "https://calendar.google.com/calendar/ical/f650e26425012247c687b908a622bbcb45f4ee2b554237e559a813282a51a4e2%40group.calendar.google.com/public/basic.ics",
    points: 2,
    color: "#0F766E",
    active: true,
    serviceLabel: "Porte Médio",
    durationMinutes: 150,
    requiredSkill: "banho"
  },
  {
    id: "porte-grande",
    name: "Porte Grande 25kg ou mais",
    url: "https://calendar.google.com/calendar/ical/1542dd56d3f225dc0d2c76b14f549ca91c02daf0b170cc5d61c347b3ca345df2%40group.calendar.google.com/public/basic.ics",
    points: 3,
    color: "#C76B50",
    active: true,
    serviceLabel: "Porte Grande",
    durationMinutes: 180,
    requiredSkill: "banho"
  },
  {
    id: "tosa-maquina",
    name: "Tosa na Máquina",
    url: "https://calendar.google.com/calendar/ical/f526pels3ho9b8k9k6nkq40q6k%40group.calendar.google.com/public/basic.ics",
    points: 2.5,
    color: "#7C3AED",
    active: true,
    serviceLabel: "Tosa na Máquina",
    durationMinutes: 120,
    requiredSkill: "tosa-maquina"
  },
  {
    id: "tosa-tesoura",
    name: "Tosa na Tesoura",
    url: "https://calendar.google.com/calendar/ical/580ebee1a860fb44256951cafdd7b6eddd1f76993b08cc6bb637f26d21f97ad6%40group.calendar.google.com/public/basic.ics",
    points: 3,
    color: "#BE123C",
    active: true,
    serviceLabel: "Tosa na Tesoura",
    durationMinutes: 180,
    requiredSkill: "tosa-tesoura"
  }
];

export function getDefaultSettings(): AppSettings {
  return {
    agendas: AGENDAS.map((agenda) => ({
      id: agenda.id,
      durationMinutes: agenda.durationMinutes,
      requiredSkill: agenda.requiredSkill
    })),
    staff: STAFF.map((member) => ({
      id: member.id,
      skills: [...member.skills]
    })),
    contacts: []
  };
}

export function resolveAgendas(settings?: AppSettings) {
  const overrides = new Map((settings?.agendas ?? []).map((agenda) => [agenda.id, agenda]));
  return AGENDAS.map((agenda) => {
    const override = overrides.get(agenda.id);
    return override
      ? {
          ...agenda,
          durationMinutes: override.durationMinutes,
          requiredSkill: override.requiredSkill
        }
      : agenda;
  });
}

export function resolveStaff(settings?: AppSettings) {
  const overrides = new Map((settings?.staff ?? []).map((member) => [member.id, member]));
  return STAFF.map((member) => {
    const override = overrides.get(member.id);
    return override
      ? {
          ...member,
          skills: [...override.skills]
        }
      : member;
  });
}
