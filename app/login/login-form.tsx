"use client";

import { useActionState } from "react";

interface LoginFormProps {
  action: (
    _prevState: Record<string, unknown>,
    formData: FormData
  ) => Promise<{ error?: string }>;
  callbackUrl?: string;
}

export function LoginForm({ action, callbackUrl }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {callbackUrl && (
        <input type="hidden" name="from" value={callbackUrl} />
      )}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="email"
          className="font-label text-label-sm font-semibold text-m3-on-surface"
        >
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-secondary focus:border-m3-secondary transition-shadow"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="font-label text-label-sm font-semibold text-m3-on-surface"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-secondary focus:border-m3-secondary transition-shadow"
        />
      </div>
      {state?.error && (
        <p role="alert" className="font-body text-body-sm text-m3-error">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-m3-primary px-4 py-2 font-label text-label-lg font-semibold text-m3-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Iniciando sesión..." : "Iniciar sesión"}
      </button>
    </form>
  );
}
