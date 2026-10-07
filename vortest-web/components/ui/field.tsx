"use client";

import { cloneElement, forwardRef, isValidElement, useId, type ReactElement } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

const CONTROL =
  "block w-full rounded-md border bg-m3-surface-container-lowest px-3 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant/70 transition-[border-color,box-shadow] duration-fast ease-standard focus:outline-none focus-visible:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-m3-surface-container disabled:text-m3-on-surface-variant";

const CONTROL_OK = "border-m3-outline-variant hover:border-m3-outline focus:border-m3-primary focus:ring-m3-primary/25";
const CONTROL_ERROR = "border-m3-error focus:border-m3-error focus:ring-m3-error/25";

interface ControlProps {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & ControlProps>(
  ({ invalid, className, ...rest }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
      className={cn(CONTROL, "h-10", invalid ? CONTROL_ERROR : CONTROL_OK, className)}
      {...rest}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & ControlProps>(
  ({ invalid, className, ...rest }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
      className={cn(CONTROL, "min-h-24 py-2", invalid ? CONTROL_ERROR : CONTROL_OK, className)}
      {...rest}
    />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & ControlProps>(
  ({ invalid, className, children, ...rest }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || rest["aria-invalid"] || undefined}
        className={cn(CONTROL, "h-10 appearance-none pr-9", invalid ? CONTROL_ERROR : CONTROL_OK, className)}
        {...rest}
      >
        {children}
      </select>
      <Icon name="expand_more" size={20} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-m3-on-surface-variant" />
    </div>
  )
);
Select.displayName = "Select";

interface FieldProps {
  label: string;
  /** Un solo control (Input/Select/Textarea): recibe id, aria-describedby y aria-invalid automáticamente. */
  children: ReactElement<Record<string, unknown>>;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  id?: string;
}

/** Etiqueta + control + ayuda + error, enlazados para lectores de pantalla. */
export function Field({ label, children, hint, error, required, className, id }: FieldProps) {
  const generado = useId();
  const controlId = id ?? (children.props.id as string | undefined) ?? generado;
  const hintId = hint ? `${controlId}-ayuda` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy,
        invalid: Boolean(error),
        required: required ?? children.props.required,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={controlId}
        className={cn("font-label text-label-md text-m3-on-surface", required && "after:ml-0.5 after:text-m3-error after:content-['*']")}
      >
        {label}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="font-body text-body-xs text-m3-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1 font-body text-body-xs text-m3-error">
          <Icon name="error" size={14} filled />
          {error}
        </p>
      )}
    </div>
  );
}
