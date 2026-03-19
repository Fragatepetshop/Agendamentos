import { LoginScreen } from "./login-screen";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  return <LoginScreen nextPath={resolvedSearchParams.next || "/"} />;
}
