"use client";

interface SectionSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

/** Buscador local reactivo — filtra en el cliente mientras se escribe, sin navegación. */
export function SectionSearch({ value, onChange, placeholder, className = "" }: SectionSearchProps) {
  return (
    <div
      className={`flex w-full max-w-xs items-center gap-2 rounded-full border border-m3-outline-variant bg-m3-surface px-3.5 py-2 text-m3-on-surface-variant transition-colors focus-within:border-m3-secondary ${className}`}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        search
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent font-body text-body-sm text-m3-on-surface placeholder:text-m3-on-surface-variant focus:outline-none"
      />
    </div>
  );
}
