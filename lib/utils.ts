import { CapacityStatus } from "@/lib/types";
import { DAILY_POINT_LIMIT } from "@/lib/config";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function roundPoints(value: number) {
  return Math.round(value * 100) / 100;
}

export function toPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(999, Math.round((value / total) * 100));
}

export function getCapacityStatus(points: number): CapacityStatus {
  if (points > DAILY_POINT_LIMIT) return "lotado";
  if (points >= 34) return "quase-cheio";
  if (points >= 28) return "atencao";
  return "confortavel";
}

export function statusLabel(status: CapacityStatus) {
  switch (status) {
    case "lotado":
      return "Lotado";
    case "quase-cheio":
      return "Quase cheio";
    case "atencao":
      return "Atenção";
    default:
      return "Confortável";
  }
}

export function formatPoints(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1
  })} pts`;
}

export function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
