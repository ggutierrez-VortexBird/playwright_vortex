import type { NextConfig } from "next";

const esProduccion = process.env.NODE_ENV === "production";

// CSP aplicada (no sólo reporte). Orígenes externos: Monaco desde jsDelivr y la fuente de íconos de Google Fonts.
// 'unsafe-inline' y 'unsafe-eval' siguen porque Next (scripts en línea, recarga en desarrollo) y Monaco los necesitan sin nonce.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' ws: wss: https://cdn.jsdelivr.net",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: CSP },
          ...(esProduccion ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
      {
        // El visor de trazas muestra las capturas en iframes propios: necesita poder enmarcarse a sí mismo.
        source: "/trace-viewer/:ruta*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: `${CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'")}; frame-src 'self' blob: data:` },
        ],
      },
    ];
  },
};

export default nextConfig;
