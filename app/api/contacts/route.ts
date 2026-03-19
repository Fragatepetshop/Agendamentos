import { NextRequest, NextResponse } from "next/server";
import { listStoredContacts, saveStoredContact } from "@/lib/contact-store";
import { ContactRecord } from "@/lib/types";

function normalizeContactInput(input: Partial<ContactRecord>) {
  return {
    petName: input.petName?.trim() ?? "",
    clientName: input.clientName?.trim() ?? "",
    phone: input.phone?.trim() ?? ""
  };
}

export async function GET() {
  try {
    const contacts = await listStoredContacts();
    return NextResponse.json({ contacts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar contatos";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ContactRecord>;
    const contact = normalizeContactInput(body);

    if (!contact.petName || !contact.phone) {
      return NextResponse.json({ message: "Informe o nome do pet e o telefone." }, { status: 400 });
    }

    await saveStoredContact(contact);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar contato";
    return NextResponse.json({ message }, { status: 500 });
  }
}
