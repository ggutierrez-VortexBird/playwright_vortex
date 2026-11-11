"use client";

/** Misma pantalla del grabador en estado "sin iniciar": al pulsar "Iniciar grabación" crea la sesión real y pasa a vivo sin navegar. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GrabadorTopbar } from "./grabador-topbar";
import { BrowserChrome } from "./browser-chrome";
import { RecordingInstructions } from "./recording-instructions";
import { RecordingGuide } from "./recording-guide";
import { GrabadorClient } from "./grabador-client";
import type { GrabacionDraft } from "@/lib/grabador/draft";

export interface PrepararGrabacionClientProps {
  draft: GrabacionDraft;
}

interface LiveSession {
  sessionId: string;
  wsUrl: string;
  startedAt: string;
}

export function PrepararGrabacionClient({ draft }: PrepararGrabacionClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveSession | null>(null);

  async function handleIniciar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/grabador/sesiones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proyectoId: draft.proyectoId,
          nombre: draft.nombre,
          urlInicial: draft.urlInicial,
          ambiente: draft.ambiente,
          credencialId: draft.credencialId || null,
          parentCaseId: draft.parentCaseId || null,
          navegador: draft.navegador,
        }),
      });

      if (res.status === 201) {
        const data = await res.json();
        setLive({
          sessionId: data.sessionId,
          wsUrl: data.wsUrl,
          startedAt: new Date().toISOString(),
        });
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.message ?? errBody.error ?? "No se pudo iniciar la grabación");
        setLoading(false);
      }
    } catch {
      setError("Error de conexión. Vuelve a intentarlo.");
      setLoading(false);
    }
  }

  // Con la sesión creada es la misma pantalla, ahora en vivo.
  if (live) {
    return (
      <GrabadorClient
        wsUrl={live.wsUrl}
        urlInicial={draft.urlInicial}
        sesionId={live.sessionId}
        startedAt={live.startedAt}
        titulo={draft.nombre}
      />
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6">
        <GrabadorTopbar
          variant="idle"
          titulo={draft.nombre}
          connState="closed"
          stopping={false}
          onDetener={() => {}}
          onDescartar={() => router.push("/casos")}
          onIniciar={handleIniciar}
          iniciando={loading}
        />
        <BrowserChrome pageUrl={draft.urlInicial} onNavigate={() => {}} disabled soloLectura />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <RecordingInstructions
            idle
            urlInicial={draft.urlInicial}
            pasosCount={0}
            assertionCount={0}
            bytes={0}
            connState="closed"
            errorMsg={error}
          />
        </div>
        <div className="lg:col-span-4">
          <RecordingGuide connState="closed" />
        </div>
      </div>
    </section>
  );
}
