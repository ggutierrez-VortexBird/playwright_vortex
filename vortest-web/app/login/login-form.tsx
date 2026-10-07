"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";

interface LoginFormProps {
  action: (
    _prevState: Record<string, unknown>,
    formData: FormData
  ) => Promise<{ error?: string; field?: "email" | "password" }>;
  callbackUrl?: string;
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ action, callbackUrl }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  // Controlados a propósito: React 19 resetea los campos no controlados de un <form action> al resolver, y se perdía el email tras un error.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorLocal, setErrorLocal] = useState<{ field: "email" | "password"; error: string } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const errorCampo = errorLocal ?? (state?.field && state.error ? { field: state.field, error: state.error } : null);

  // Tras un error del servidor el foco va al campo que lo causó.
  useEffect(() => {
    if (state?.field === "email") emailRef.current?.focus();
    else if (state?.field === "password") passwordRef.current?.focus();
  }, [state]);

  function validar(e: React.FormEvent<HTMLFormElement>) {
    if (!EMAIL_VALIDO.test(email.trim())) {
      e.preventDefault();
      setErrorLocal({ field: "email", error: "Escribe un correo válido, p. ej. nombre@empresa.com" });
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      e.preventDefault();
      setErrorLocal({ field: "password", error: "Escribe tu contraseña" });
      passwordRef.current?.focus();
      return;
    }
    setErrorLocal(null);
  }

  return (
    <form action={formAction} onSubmit={validar} noValidate className="flex flex-col gap-5">
      {callbackUrl && <input type="hidden" name="from" value={callbackUrl} />}

      <Field label="Correo electrónico" id="email" required error={errorCampo?.field === "email" ? errorCampo.error : null}>
        <Input
          ref={emailRef}
          name="email"
          type="email"
          autoComplete="email"
          disabled={isPending}
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
        />
      </Field>

      <Field label="Contraseña" id="password" required error={errorCampo?.field === "password" ? errorCampo.error : null}>
        <Input
          ref={passwordRef}
          name="password"
          type="password"
          autoComplete="current-password"
          disabled={isPending}
          placeholder="tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
        />
      </Field>

      {state?.error && !state?.field && !errorLocal && <Alert tone="error">{state.error}</Alert>}

      <Button type="submit" loading={isPending} loadingText="Iniciando sesión…" className="mt-1 h-11 w-full text-label-lg">
        Iniciar sesión
      </Button>
    </form>
  );
}
