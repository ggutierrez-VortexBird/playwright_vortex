'use client';

interface ClientBandProps {
  espacioColor?: string | null;
}

export function ClientBand({ espacioColor }: ClientBandProps) {
  if (!espacioColor) {
    return null;
  }

  return (
    <span
      className="client-band"
      style={{ backgroundColor: espacioColor }}
      aria-hidden="true"
    />
  );
}
