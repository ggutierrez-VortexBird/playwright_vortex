import { iniciarSesion } from "./actions";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/ui/logo";

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { from } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-m3-surface p-4">
      <div className="w-full max-w-sm rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-8 shadow-card">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo variant="light" />
          <p className="mt-3 font-body text-body-sm text-m3-on-surface-variant">
            Automatización de pruebas
          </p>
        </div>
        <LoginForm action={iniciarSesion} callbackUrl={from} />
      </div>
    </main>
  );
}
