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
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-rule px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-rule px-3 py-2"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-stamp">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-ink px-4 py-2 text-surface hover:bg-ink-2 disabled:opacity-50"
      >
        {isPending ? "Iniciando sesión..." : "Iniciar sesión"}
      </button>
    </form>
  );
}
