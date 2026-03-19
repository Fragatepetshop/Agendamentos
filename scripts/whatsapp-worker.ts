import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import qrcode from "qrcode-terminal";
import { Client, LocalAuth } from "whatsapp-web.js";
import { fetchCalendarEvents } from "../lib/calendar";
import { buildWhatsAppReminders } from "../lib/whatsapp";
import { addDays, createZonedDate, formatDateKey, nowInAppTimezone } from "../lib/date";

type WorkerMode = "connect" | "send";

type SentLogEntry = {
  eventId: string;
  sentAt: string;
  scheduledSendAt: string;
  phone: string | null;
  petName: string;
};

type SentLog = {
  reminders: SentLogEntry[];
};

const mode = (process.argv[2] as WorkerMode | undefined) ?? "connect";
const workspaceRoot = process.cwd();
const dataDirectory = path.join(workspaceRoot, "data");
const sentLogPath = path.join(dataDirectory, "whatsapp-sent-log.json");

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDataDirectory() {
  await mkdir(dataDirectory, { recursive: true });
}

async function loadSentLog(): Promise<SentLog> {
  await ensureDataDirectory();

  try {
    const raw = await readFile(sentLogPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SentLog>;
    return {
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : []
    };
  } catch {
    return { reminders: [] };
  }
}

async function saveSentLog(log: SentLog) {
  await ensureDataDirectory();
  await writeFile(sentLogPath, JSON.stringify(log, null, 2), "utf8");
}

function createClient() {
  return new Client({
    authStrategy: new LocalAuth({
      clientId: "pet-shop-agendamentos"
    }),
    puppeteer: {
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  });
}

async function waitForReady(client: Client) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Tempo esgotado ao conectar no WhatsApp Web."));
    }, 180000);

    client.on("qr", (qr) => {
      console.log("\nEscaneie o QR code abaixo com o seu WhatsApp:\n");
      qrcode.generate(qr, { small: true });
    });

    client.on("ready", () => {
      clearTimeout(timeout);
      resolve();
    });

    client.on("auth_failure", (message) => {
      clearTimeout(timeout);
      reject(new Error(`Falha de autenticacao: ${message}`));
    });

    client.on("disconnected", (reason) => {
      clearTimeout(timeout);
      reject(new Error(`WhatsApp desconectado: ${reason}`));
    });
  });
}

async function getDueReminders() {
  const now = nowInAppTimezone();
  const fetchStart = createZonedDate(formatDateKey(now));
  const fetchEnd = createZonedDate(formatDateKey(addDays(now, 8)), "23:59");
  const events = await fetchCalendarEvents(fetchStart, fetchEnd);
  const reminders = buildWhatsAppReminders(events, now);
  const sentLog = await loadSentLog();
  const sentIds = new Set(sentLog.reminders.map((entry) => entry.eventId));

  const dueItems = reminders.items.filter((item) => item.status === "pronto" && item.phone && item.message && !sentIds.has(item.eventId));

  return {
    dueItems,
    sentLog
  };
}

async function connectMode() {
  const client = createClient();

  try {
    console.log("Abrindo o WhatsApp Web para conectar a sessao...");
    const readyPromise = waitForReady(client);
    await client.initialize();
    await readyPromise;
    console.log("WhatsApp conectado com sucesso. A sessao ficou salva neste computador.");
    await delay(1500);
  } finally {
    await client.destroy().catch(() => undefined);
  }
}

async function sendMode() {
  const { dueItems, sentLog } = await getDueReminders();

  if (dueItems.length === 0) {
    console.log("Nenhum lembrete pronto para envio neste momento.");
    return;
  }

  const client = createClient();

  try {
    console.log(`Conectando ao WhatsApp Web para enviar ${dueItems.length} lembrete(s)...`);
    const readyPromise = waitForReady(client);
    await client.initialize();
    await readyPromise;

    for (const item of dueItems) {
      const phoneDigits = item.phone?.replace(/\D/g, "");

      if (!phoneDigits || !item.message) {
        continue;
      }

      const chatId = `${phoneDigits}@c.us`;
      console.log(`Enviando para ${item.petName} (${item.clientName ?? "cliente sem nome"})...`);
      await client.sendMessage(chatId, item.message);

      sentLog.reminders.push({
        eventId: item.eventId,
        sentAt: new Date().toISOString(),
        scheduledSendAt: item.scheduledSendAt,
        phone: item.phone,
        petName: item.petName
      });

      await saveSentLog(sentLog);

      const pauseMs = 12000 + (item.eventId.length % 5) * 4000;
      await delay(pauseMs);
    }

    console.log("Envio concluido.");
  } finally {
    await client.destroy().catch(() => undefined);
  }
}

async function main() {
  if (mode !== "connect" && mode !== "send") {
    throw new Error("Use 'connect' ou 'send' ao executar o worker.");
  }

  if (mode === "connect") {
    await connectMode();
    return;
  }

  await sendMode();
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Erro inesperado no worker de WhatsApp.");
  process.exit(1);
});
