"use client";

interface UrlBarProps {
  url: string;
  onChange?: (url: string) => void;
}

export function UrlBar({ url }: UrlBarProps) {
  return (
    <div className="vp-urlbar" data-testid="url-bar">
      <span className="vp-urlbar-label">URL</span>
      <input
        readOnly
        value={url}
        className="vp-urlbar-input"
      />
    </div>
  );
}