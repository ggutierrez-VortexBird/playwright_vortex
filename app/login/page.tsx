import { iniciarSesion } from "./actions";
import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { from } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <h1
            className="text-2xl font-semibold text-ink"
            style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Acta
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            Automatización de pruebas y actas de evidencia
          </p>
        </div>
        <LoginForm action={iniciarSesion} callbackUrl={from} />
      </div>
    </main>
  );
}
