import { iniciarSesion } from "./actions";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/ui/logo";

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { from } = await searchParams;

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(circle at 30% 20%, #1B2438 0%, #131B2E 55%, #0B0F1A 100%)",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo variant="light" />
          <p className="mt-2 font-body text-body-sm text-m3-on-surface-variant">
            Automatización de pruebas y actas de evidencia
          </p>
        </div>
        <LoginForm action={iniciarSesion} callbackUrl={from} />
      </div>
    </main>
  );
}
