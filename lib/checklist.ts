import { GOOGLE_FORMS_SHEET_ID, GOOGLE_FORMS_SHEET_NAME } from "@/lib/config";
import { ChecklistItem, ChecklistSummary } from "@/lib/types";

const SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_FORMS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(GOOGLE_FORMS_SHEET_NAME)}`;

const HEADER_MAP = {
  submittedAt: "Carimbo de data/hora",
  tutorName: "NOME TUTOR",
  cpf: "CPF",
  tutorPhone: "TELEFONE TUTOR",
  tutorAddress: "ENDEREÇO TUTOR",
  pet1: "QUAL O NOME DO PET?",
  pet2: "QUAL O NOME DO SEGUNDO PET? (CASO TENHA)",
  pet3: "QUAL O NOME DO TERCEIRO PET? (CASO TENHA)",
  pet4: "QUAL O NOME DO QUARTO PET? (CASO TENHA)",
  pet5: "QUAL O NOME DO QUINTO PET ? (CASO TENHA)",
  breed: "QUAL A RAÇA DO PET?",
  age: "QUAL A IDADE DO PET? (CASO NÃO SAIBA, COLOQUE APROXIMADO)",
  bathHistory: "JA TOMOU BANHO EM BANHO E TOSA?",
  allergyHistory: "ELE TEM HISTÓRICO DE ALERGIA NA PELE APÓS BANHO EM BANHO E TOSA?",
  controlledMedication: "ELE TOMA ALGUM MEDICAMENTO CONTROLADO?",
  flaggedConditions: "MARQUE A CAIXA CASO O PET JA TENHA PRESENTADO ALGUM DOS ITENS ABAIXO.",
  termsAccepted:
    'Declaro estar ciente de que os serviços de banho, secagem, escovação e tosa podem gerar estresse no animal, especialmente em pets idosos, com doenças pré-existentes ou sensibilidade física, podendo ocorrer reações inesperadas durante o procedimento.\nAutorizo o Fragate Petshop a realizar os procedimentos solicitados e compreendo que:\nCaso o pet apresente sinais de estresse excessivo, mal-estar, alteração de pressão, convulsão, dificuldade respiratória ou qualquer situação que coloque sua saúde em risco, o procedimento poderá ser interrompido imediatamente visando a segurança do animal.\nCaso seja necessário, autorizo o encaminhamento para atendimento veterinário, sendo os custos de consulta, exames ou tratamento de responsabilidade do tutor.\nEstou ciente de que pets com pelagem muito embaraçada ou com nós podem necessitar de tosa mais curta, a fim de evitar dor ou sofrimento ao animal.\nCaso sejam identificados pulgas, carrapatos, feridas, irritações de pele ou outras condições, poderei ser informado para avaliação ou tratamento adequado.\nAutorizo o uso de focinheira ou contenção segura, caso seja necessário para a segurança do animal e da equipe.'
} as const;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function getColumnIndex(headers: string[], name: string) {
  return headers.findIndex((header) => header.trim() === name);
}

function getValue(row: string[], headers: string[], headerName: string) {
  const index = getColumnIndex(headers, headerName);
  if (index === -1) return null;
  const value = row[index]?.trim();
  return value ? value : null;
}

export async function fetchChecklistSummary(): Promise<ChecklistSummary> {
  const response = await fetch(SHEET_URL, {
    cache: "no-store",
    headers: {
      "User-Agent": "pet-shop-agendamentos"
    }
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar a planilha de checklist");
  }

  const csv = await response.text();
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return {
      totalEntries: 0,
      uniqueTutors: 0,
      uniquePets: 0,
      items: []
    };
  }

  const [headers, ...dataRows] = rows;
  const petHeaders = [HEADER_MAP.pet1, HEADER_MAP.pet2, HEADER_MAP.pet3, HEADER_MAP.pet4, HEADER_MAP.pet5];
  const items: ChecklistItem[] = [];

  for (const row of dataRows) {
    const submittedAt = getValue(row, headers, HEADER_MAP.submittedAt);
    const tutorName = getValue(row, headers, HEADER_MAP.tutorName);

    if (!submittedAt || !tutorName) continue;

    petHeaders.forEach((petHeader, petIndex) => {
      const petName = getValue(row, headers, petHeader);
      if (!petName) return;

      items.push({
        id: `${submittedAt}-${tutorName}-${petIndex + 1}-${petName}`,
        submittedAt,
        tutorName,
        cpf: getValue(row, headers, HEADER_MAP.cpf),
        tutorPhone: getValue(row, headers, HEADER_MAP.tutorPhone),
        tutorAddress: getValue(row, headers, HEADER_MAP.tutorAddress),
        petName,
        petSlot: petIndex + 1,
        breed: getValue(row, headers, HEADER_MAP.breed),
        age: getValue(row, headers, HEADER_MAP.age),
        hasBathHistory: getValue(row, headers, HEADER_MAP.bathHistory),
        hasSkinAllergyHistory: getValue(row, headers, HEADER_MAP.allergyHistory),
        usesControlledMedication: getValue(row, headers, HEADER_MAP.controlledMedication),
        flaggedConditions: getValue(row, headers, HEADER_MAP.flaggedConditions),
        termsAccepted: getValue(row, headers, HEADER_MAP.termsAccepted)
      });
    });
  }

  const uniqueTutors = new Set(items.map((item) => item.tutorName.toLowerCase())).size;
  const uniquePets = new Set(items.map((item) => `${item.petName.toLowerCase()}|${item.tutorName.toLowerCase()}`)).size;

  return {
    totalEntries: items.length,
    uniqueTutors,
    uniquePets,
    items: items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
  };
}
