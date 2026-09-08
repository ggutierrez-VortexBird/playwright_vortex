import { iniciarSesion } from "./actions";
import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { from } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-m3-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-8 shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]">
        <div className="mb-6 text-center">
          <h1 className="font-headline text-headline-lg font-bold uppercase tracking-[0.14em] text-m3-primary">
            Acta
          </h1>
          <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
            Automatización de pruebas y actas de evidencia
          </p>
        </div>
        <LoginForm action={iniciarSesion} callbackUrl={from} />
      </div>
    </main>
  );
}
