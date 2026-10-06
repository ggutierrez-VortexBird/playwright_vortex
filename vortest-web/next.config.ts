import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        // SEG-11: apply security headers to all routes
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Report-only CSP: allows unsafe-inline/eval for Monaco editor and dev tools.
          // Switch to enforced CSP once the deploy environment is known.
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "frame-ancestors 'none'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "connect-src 'self' ws: wss:",
              // Sin `report-uri`: no existe ningún endpoint que reciba los
              // reportes (apuntaba a /api/csp-violation, que devolvía 401 desde
              // que /api/* exige sesión y llenaba la consola de errores). En
              // modo report-only las violaciones igual se ven en DevTools.
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
