import Image from "next/image";

interface LogoProps {
  /** Controla el tamaño: "light" (login, más grande) vs "dark" (sidebar, más compacto). */
  variant?: "light" | "dark";
  className?: string;
}

const SIZES: Record<"light" | "dark", { width: number; height: number }> = {
  light: { width: 176, height: 61 },
  dark: { width: 140, height: 49 },
};

export function Logo({ variant = "light", className }: LogoProps) {
  const { width, height } = SIZES[variant];
  return (
    <Image
      src="/logo.png"
      alt="VorTest"
      width={width}
      height={height}
      priority
      className={className}
    />
  );
}
