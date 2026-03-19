"use client";

import { FormEvent, useState } from "react";
import { Eye, LoaderCircle, LockKeyhole } from "lucide-react";

export function LoginScreen({ nextPath }: { nextPath: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      const result = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Nao foi possivel entrar.");
      }

      window.location.href = nextPath;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.22),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#fffdf7_100%)] px-6 py-10 text-ink">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[36px] border border-white/70 bg-white/85 shadow-panel backdrop-blur xl:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden bg-ink px-10 py-12 text-white xl:flex xl:flex-col xl:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                <LockKeyhole className="h-4 w-4" />
                Area protegida
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight">Acesso ao painel operacional do pet shop</h1>
              <p className="mt-4 max-w-md text-sm text-white/75">
                Use a senha configurada para abrir o sistema, consultar a operacao do dia e acessar os dados publicados na internet com seguranca.
              </p>
            </div>

            <div className="space-y-3 text-sm text-white/70">
              <p>Funciona no navegador, no ambiente local e na Vercel.</p>
              <p>Depois do login, o acesso fica mantido por cookie seguro no proprio navegador.</p>
            </div>
          </section>

          <section className="px-6 py-8 sm:px-10 sm:py-12">
            <div className="mx-auto max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal">
                <Eye className="h-4 w-4" />
                Login
              </div>
              <h2 className="mt-6 text-3xl font-semibold text-ink">Entrar no sistema</h2>
              <p className="mt-2 text-sm text-slate-500">Informe a senha do painel para liberar o acesso.</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-600">Senha</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite a senha de acesso"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
                  />
                </label>

                {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Entrar
                </button>
              </form>

              <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Se ainda nao configurou a senha, defina <code>APP_ACCESS_PASSWORD</code> no ambiente local e na Vercel. Se quiser reforcar a sessao, adicione tambem <code>APP_ACCESS_SECRET</code>.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
