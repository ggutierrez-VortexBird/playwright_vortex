import { forwardRef } from "react";
import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";

export type ButtonVariant = "primary" | "secondary" | "tonal" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

interface ButtonVisualProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícono Material Symbols a la izquierda del texto. */
  icon?: string;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVisualProps {
  /** Deshabilita el botón, muestra un spinner y, si se pasa, cambia el texto (p. ej. "Guardando…"). */
  loading?: boolean;
  loadingText?: string;
}

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-[background-color,color,box-shadow,transform,opacity] duration-fast ease-standard active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:active:scale-100";

const SOLID_BASE = "rounded-md font-label text-label-md font-semibold";

const VARIANT_CLASSNAMES: Record<ButtonVariant, string> = {
  primary: "bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90 shadow-sm",
  secondary: "border border-m3-outline-variant bg-m3-surface-container-lowest text-m3-on-surface hover:bg-m3-surface-container-high",
  tonal: "bg-m3-primary-fixed text-m3-on-primary-fixed hover:bg-m3-primary-fixed-dim",
  danger: "bg-m3-error text-m3-on-error hover:bg-m3-error/90",
  ghost: "rounded-md text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface",
};

const SIZE_CLASSNAMES: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { sm: "h-8 px-3 text-label-sm", md: "h-10 px-4" },
  secondary: { sm: "h-8 px-3 text-label-sm", md: "h-10 px-4" },
  tonal: { sm: "h-8 px-3 text-label-sm", md: "h-10 px-4" },
  danger: { sm: "h-8 px-3 text-label-sm", md: "h-10 px-4" },
  ghost: { sm: "p-1.5", md: "p-2" },
};

export function buttonClassName({ variant = "primary", size = "md" }: ButtonVisualProps = {}, className?: string) {
  return cn(BASE, variant !== "ghost" && SOLID_BASE, VARIANT_CLASSNAMES[variant], SIZE_CLASSNAMES[variant][size], className);
}

/** Botón único de la app: variantes, tamaños, ícono y estado de carga. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", icon, loading = false, loadingText, disabled, className, children, type = "button", ...rest }, ref) => {
    const iconSize = size === "sm" ? 16 : 18;
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonClassName({ variant, size }, className)}
        {...rest}
      >
        {loading ? <Spinner size={iconSize} /> : icon && <Icon name={icon} size={iconSize} />}
        {loading && loadingText ? loadingText : children}
      </button>
    );
  }
);

Button.displayName = "Button";

export interface ButtonLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">,
    Pick<LinkProps, "href" | "prefetch" | "replace" | "scroll">,
    ButtonVisualProps {}

/** Mismo aspecto que <Button> pero navega: usable desde Server Components. */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant = "primary", size = "md", icon, className, href, prefetch, replace, scroll, children, ...rest }, ref) => (
    <Link
      ref={ref}
      href={href}
      prefetch={prefetch}
      replace={replace}
      scroll={scroll}
      className={buttonClassName({ variant, size }, className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
    </Link>
  )
);

ButtonLink.displayName = "ButtonLink";
