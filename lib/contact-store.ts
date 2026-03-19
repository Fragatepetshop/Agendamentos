import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "@vercel/postgres";
import { ContactRecord } from "@/lib/types";

const localDataDir = path.join(process.cwd(), "data");
const localContactsPath = path.join(localDataDir, "contacts.json");

function normalizeMatchValue(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canUsePostgres() {
  return Boolean(process.env.POSTGRES_URL);
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS pet_shop_contacts (
      id SERIAL PRIMARY KEY,
      pet_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      normalized_pet_name TEXT NOT NULL,
      normalized_client_name TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (normalized_pet_name, normalized_client_name)
    )
  `;
}

async function listContactsFromPostgres(): Promise<ContactRecord[]> {
  await ensureTable();
  const result = await sql<{
    pet_name: string;
    client_name: string;
    phone: string;
  }>`
    SELECT pet_name, client_name, phone
    FROM pet_shop_contacts
    ORDER BY updated_at DESC, pet_name ASC
  `;

  return result.rows.map((row) => ({
    petName: row.pet_name,
    clientName: row.client_name,
    phone: row.phone
  }));
}

async function saveContactToPostgres(contact: ContactRecord) {
  await ensureTable();

  await sql`
    INSERT INTO pet_shop_contacts (pet_name, client_name, phone, normalized_pet_name, normalized_client_name, updated_at)
    VALUES (
      ${contact.petName},
      ${contact.clientName},
      ${contact.phone},
      ${normalizeMatchValue(contact.petName)},
      ${normalizeMatchValue(contact.clientName)},
      NOW()
    )
    ON CONFLICT (normalized_pet_name, normalized_client_name)
    DO UPDATE SET
      pet_name = EXCLUDED.pet_name,
      client_name = EXCLUDED.client_name,
      phone = EXCLUDED.phone,
      updated_at = NOW()
  `;
}

async function ensureLocalDataDir() {
  await mkdir(localDataDir, { recursive: true });
}

async function listContactsFromFile(): Promise<ContactRecord[]> {
  await ensureLocalDataDir();

  try {
    const raw = await readFile(localContactsPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is ContactRecord => {
      return Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as ContactRecord).petName === "string" &&
          typeof (item as ContactRecord).clientName === "string" &&
          typeof (item as ContactRecord).phone === "string"
      );
    });
  } catch {
    return [];
  }
}

async function saveContactToFile(contact: ContactRecord) {
  const contacts = await listContactsFromFile();
  const matchIndex = contacts.findIndex(
    (item) =>
      normalizeMatchValue(item.petName) === normalizeMatchValue(contact.petName) &&
      normalizeMatchValue(item.clientName) === normalizeMatchValue(contact.clientName)
  );

  if (matchIndex >= 0) {
    contacts[matchIndex] = contact;
  } else {
    contacts.push(contact);
  }

  await ensureLocalDataDir();
  await writeFile(localContactsPath, JSON.stringify(contacts, null, 2), "utf8");
}

export async function listStoredContacts() {
  if (canUsePostgres()) {
    return listContactsFromPostgres();
  }

  if (process.env.VERCEL) {
    throw new Error("Configure o Vercel Postgres para salvar telefones compartilhados no sistema.");
  }

  return listContactsFromFile();
}

export async function saveStoredContact(contact: ContactRecord) {
  if (canUsePostgres()) {
    await saveContactToPostgres(contact);
    return;
  }

  if (process.env.VERCEL) {
    throw new Error("Configure o Vercel Postgres para salvar telefones compartilhados no sistema.");
  }

  await saveContactToFile(contact);
}
