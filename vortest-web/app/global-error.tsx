"use client";

import { useEffect } from "react";

// Reemplaza al layout raíz cuando éste falla: no hay estilos ni fuentes garantizados, por eso todo va inline.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F5F8F8", color: "#152427", fontFamily: "system-ui, sans-serif" }}>
        <main role="alert" style={{ maxWidth: 440, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>vorTest no pudo cargar</h1>
          <p style={{ color: "#43575B", lineHeight: 1.5, margin: 0 }}>
            Ocurrió un error inesperado. Reintenta; si sigue pasando, comparte el código de soporte con el equipo.
          </p>
          {error.digest && <p style={{ color: "#43575B", fontSize: 14 }}>Código de soporte: <code>{error.digest}</code></p>}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 20, height: 40, padding: "0 20px", border: 0, borderRadius: 12, background: "#135C65", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
