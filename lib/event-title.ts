export type ParsedEventTitle = {
  rawTitle: string;
  isTaxi: boolean;
  isPackage: boolean;
  petName: string;
  clientName: string | null;
  phone: string | null;
};

function stripLeadingMarker(title: string, markerPattern: RegExp) {
  return title.replace(markerPattern, "").trim();
}

function normalizeSegment(segment: string) {
  return segment.replace(/[()]/g, "").trim();
}

function isTaxiSegment(segment: string) {
  return normalizeSegment(segment).toLowerCase() === "taxi";
}

function isPackageSegment(segment: string) {
  return normalizeSegment(segment).toLowerCase() === "p";
}

function isPhoneSegment(segment: string) {
  const digits = segment.replace(/\D/g, "");
  return digits.length >= 10;
}

export function parseEventTitle(title: string): ParsedEventTitle {
  const isTaxiByPrefix = /^\s*\(\s*taxi\s*\)/i.test(title);
  const isPackageAtEnd = /\(\s*p\s*\)\s*$/i.test(title);
  let cleanedTitle = isTaxiByPrefix ? stripLeadingMarker(title, /^\s*\(\s*taxi\s*\)\s*-?\s*/i) : title;

  if (isPackageAtEnd) {
    cleanedTitle = cleanedTitle.replace(/\s*\(\s*p\s*\)\s*$/i, "").trim();
  }

  const parts = cleanedTitle
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const firstPartIsTaxi = parts.length > 0 && isTaxiSegment(parts[0]);
  const isTaxi = isTaxiByPrefix || firstPartIsTaxi;
  const payloadParts = firstPartIsTaxi ? parts.slice(1) : parts;
  const petName = payloadParts[0] ?? (cleanedTitle.trim() || "Sem nome");
  const phonePart = payloadParts.find(isPhoneSegment) ?? null;
  const clientParts = payloadParts.slice(1).filter((part) => part !== phonePart);
  const clientName = clientParts.length > 0 ? clientParts.join(" - ") : null;

  return {
    rawTitle: title,
    isTaxi,
    isPackage: isPackageAtEnd,
    petName,
    clientName,
    phone: phonePart
  };
}
