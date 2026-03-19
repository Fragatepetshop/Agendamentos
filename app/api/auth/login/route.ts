import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, buildSessionToken, isAuthConfigured, validatePassword } from "@/lib/auth";

type LoginInput = {
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json(
        {
          message: "Defina APP_ACCESS_PASSWORD nas variaveis de ambiente para ativar o acesso protegido."
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as LoginInput;
    const password = body.password?.trim() || "";
    const isValid = await validatePassword(password);

    if (!isValid) {
      return NextResponse.json({ message: "Senha invalida" }, { status: 401 });
    }

    const token = await buildSessionToken();

    if (!token) {
      return NextResponse.json({ message: "Nao foi possivel iniciar a sessao" }, { status: 500 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao autenticar";
    return NextResponse.json({ message }, { status: 500 });
  }
}
