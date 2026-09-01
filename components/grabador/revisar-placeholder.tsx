"use client";

/**
 * Revisar placeholder — página intermedia entre "Detener y revisar" y la
 * pantalla de revisión completa que llega en HU-G8.
 *
 * Cuando el usuario hace clic en "Detener y revisar", el cliente PATCH
 * estado='detenida' y redirige a `/casos/grabar/{sesionId}/revisar`. Esa
 * ruta existe y muestra este placeholder que confirma el stop, resume los
 * pasos grabados, y deja al usuario en `/casos`.
 *
 * Por qué no la pantalla completa de revisión: HU-G8 todavía no está
 * implementada. Este placeholder cumple dos funciones:
 *   1. UX: el usuario ve feedback inmediato de que la grabación se detuvo
 *      (badge, contador, "Volver" button).
 *   2. Contract: el redirect desde el topbar funciona end-to-end ya.
 *
 * Visual fidelity: el mockup de revisión (fase2/mockups/revisar-test.html)
 * tiene una card centrada con icono `videocam` filled, título "Sesión
 * detenida" y un botón de retorno. Acá replicamos eso con clases M3 del
 * design system del repo.
 */

import { useRouter } from "next/navigation";

interface RevisarPlaceholderProps {
  sesionId: string;
  /** Cantidad de pasos grabados (mostrado en el subtítulo). */
  pasosCount: number;
}

export function RevisarPlaceholder({ sesionId, pasosCount }: RevisarPlaceholderProps) {
  const router = useRouter();
  const sesionShort = sesionId.slice(0, 4).toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>Revisión de grabación</h2>
        <span className="sub">SES-{sesionShort}</span>
        <span className="spacer" />
      </div>

      <div className="w-full flex justify-center py-8">
        <div
          className="max-w-2xl w-full bg-surface-container-lowest rounded-xl border border-outline-variant p-8 mt-12 text-center"
          data-testid="revisar-placeholder"
        >
          <span
            className="material-symbols-outlined inline-block text-primary"
            style={{
              fontSize: "64px",
              fontVariationSettings: "'FILL' 1, 'wght' 600",
              color: "#fea619", // secondary-container M3 token
            }}
            aria-hidden="true"
            data-testid="revisar-icon"
          >
            videocam
          </span>
          <h3 className="font-headline text-headline-lg font-semibold text-on-surface mt-4">
            Sesión detenida
          </h3>
          <p className="font-body text-body-lg text-on-surface-variant mt-2">
            Sesión SES-{sesionShort} — {pasosCount}{" "}
            {pasosCount === 1 ? "paso grabado" : "pasos grabados"}
          </p>
          <p className="font-body text-body-md text-on-surface-variant mt-4 italic">
            La pantalla completa de revisión llega en HU-G8.
          </p>
          <div className="flex justify-center gap-3 mt-8">
            <button
              type="button"
              onClick={() => router.push("/casos")}
              className="px-5 py-2.5 bg-secondary-container text-on-secondary-container rounded font-label text-label-sm font-medium hover:bg-secondary-fixed transition-colors shadow-sm"
              data-testid="revisar-volver"
            >
              Volver a /casos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
