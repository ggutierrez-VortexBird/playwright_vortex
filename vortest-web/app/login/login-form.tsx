"use client";

import { useActionState, useState } from "react";

interface LoginFormProps {
  action: (
    _prevState: Record<string, unknown>,
    formData: FormData
  ) => Promise<{ error?: string; field?: "email" | "password" }>;
  callbackUrl?: string;
}

export function LoginForm({ action, callbackUrl }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  // Controlado a propósito: React 19 resetea los campos no controlados de un
  // <form action={...}> cuando la action resuelve (incluso con error), lo que
  // borraba el email tras un login fallido y obligaba a retipearlo.
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {callbackUrl && (
        <input type="hidden" name="from" value={callbackUrl} />
      )}

      {/* Email field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="font-label text-label-sm font-medium text-m3-on-surface"
        >
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={isPending}
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={[
            "rounded-lg border px-3 py-2.5 font-body text-body-md text-m3-on-surface",
            "bg-m3-surface-container-lowest",
            "border-m3-outline",
            "placeholder:text-m3-on-surface-variant",
            "focus:border-m3-primary focus:outline-none focus:ring-1 focus:ring-m3-primary",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors duration-200",
            state?.field === "email" && "border-m3-error focus:border-m3-error focus:ring-m3-error",
          ]
            .filter(Boolean)
            .join(" ")}
        />
        {state?.field === "email" && state?.error && (
          <p role="alert" className="flex items-center gap-1 font-label text-label-sm text-m3-error">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {state.error}
          </p>
        )}
      </div>

      {/* Password field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="font-label text-label-sm font-medium text-m3-on-surface"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          disabled={isPending}
          placeholder="tu contraseña"
          className={[
            "rounded-lg border px-3 py-2.5 font-body text-body-md text-m3-on-surface",
            "bg-m3-surface-container-lowest",
            "border-m3-outline",
            "placeholder:text-m3-on-surface-variant",
            "focus:border-m3-primary focus:outline-none focus:ring-1 focus:ring-m3-primary",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors duration-200",
            state?.field === "password" && "border-m3-error focus:border-m3-error focus:ring-m3-error",
          ]
            .filter(Boolean)
            .join(" ")}
        />
        {state?.field === "password" && state?.error && (
          <p role="alert" className="flex items-center gap-1 font-label text-label-sm text-m3-error">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {state.error}
          </p>
        )}
      </div>

      {/* Non-field error (e.g. suspended account) */}
      {state?.error && !state?.field && (
        <p
          role="alert"
          className="flex items-center gap-1.5 rounded-md bg-m3-error-container px-3 py-2 font-body text-body-sm text-m3-error"
        >
          <span className="material-symbols-outlined text-[16px]">error</span>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-m3-primary px-4 py-2.5 font-label text-label-lg font-semibold text-m3-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity duration-200"
      >
        {isPending && (
          <span className="material-symbols-outlined animate-spin text-[18px]">
            progress_activity
          </span>
        )}
        {isPending ? "Iniciando sesión..." : "Iniciar sesión"}
      </button>
    </form>
  );
}
