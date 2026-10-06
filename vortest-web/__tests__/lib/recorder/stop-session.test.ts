/**
 * Tests de lib/recorder/stop-session.ts.
 *
 * Cubre lo que antes no existía: cerrar la ventana del navegador tiene que
 * terminar la grabación igual que el botón Detener. Antes nadie escuchaba
 * la salida del proceso de grabación y la sesión quedaba colgada en
 * 'activa', con el .spec.ts sin persistir.
 */

import { createStopSession, type StopSessionDeps } from "@/lib/recorder/stop-session";
import type { SessionEntry, WsServerMessage } from "@/lib/recorder/types";

interface Escenario {
  deps: StopSessionDeps;
  entry: SessionEntry;
  orden: string[];
  persistido: Array<{ estado: string; specCode?: string }>;
  avisos: WsServerMessage[];
  clienteCerrado: () => boolean;
  entryVive: () => boolean;
}

function crearEscenario(
  overrides: { alive?: boolean; spec?: string | null } = {},
): Escenario {
  const orden: string[] = [];
  const persistido: Array<{ estado: string; specCode?: string }> = [];
  const avisos: WsServerMessage[] = [];
  let cerrado = false;
  let vive = true;

  let procesoVivo = overrides.alive ?? true;

  const cliente = {
    close: () => {
      cerrado = true;
    },
  };

  const entry = {
    sessionId: "ses-1",
    userId: "user-1",
    urlInicial: "https://example.com",
    handle: {
      specPath: "/tmp/grabador-ses-1.spec.ts",
      pid: 4242,
      isAlive: () => procesoVivo,
      kill: async () => {
        orden.push("kill");
        procesoVivo = false;
      },
      exitCode: async () => 0,
      ready: async () => true,
    },
    initialSpec: "",
    clients: new Set([cliente]),
    lastHeartbeatAt: Date.now(),
    createdAt: new Date(),
  } as unknown as SessionEntry;

  const deps: StopSessionDeps = {
    getEntry: () => (vive ? entry : undefined),
    removeEntry: () => {
      orden.push("removeEntry");
      vive = false;
    },
    closeWatcher: () => {
      orden.push("closeWatcher");
    },
    readSpec: async () => {
      orden.push("readSpec");
      return overrides.spec === undefined
        ? "import { test, expect } from '@playwright/test';"
        : overrides.spec;
    },
    persist: async (_id, data) => {
      orden.push("persist");
      // Se registran solo las claves realmente enviadas: que `specCode`
      // esté ausente (y no en undefined) es lo que evita pisar el script
      // ya guardado cuando el archivo no se pudo leer.
      const registro: { estado: string; specCode?: string } = {
        estado: data.estado,
      };
      if ("specCode" in data) registro.specCode = data.specCode;
      persistido.push(registro);
    },
    broadcast: (_id, msg) => {
      orden.push("broadcast");
      avisos.push(msg);
    },
  };

  return {
    deps,
    entry,
    orden,
    persistido,
    avisos,
    clienteCerrado: () => cerrado,
    entryVive: () => vive,
  };
}

describe("recorder/stop-session", () => {
  it("cerrar el navegador termina la grabación igual que Detener", async () => {
    const porCierre = crearEscenario();
    const porBoton = crearEscenario();

    await createStopSession(porCierre.deps)("ses-1", "browser_closed");
    await createStopSession(porBoton.deps)("ses-1", "user_stop");

    // Mismos efectos, en el mismo orden. Solo cambia el motivo informado.
    expect(porCierre.orden).toEqual(porBoton.orden);
    expect(porCierre.persistido).toEqual(porBoton.persistido);
    expect(porCierre.avisos).toEqual([
      { type: "sesion_detenida", reason: "browser_closed" },
    ]);
    expect(porBoton.avisos).toEqual([
      { type: "sesion_detenida", reason: "user_stop" },
    ]);
  });

  it("vuelca el runner antes de leer el script, para no perder la última acción", async () => {
    const e = crearEscenario();
    await createStopSession(e.deps)("ses-1", "user_stop");

    expect(e.orden.indexOf("kill")).toBeLessThan(e.orden.indexOf("readSpec"));
    expect(e.orden.indexOf("readSpec")).toBeLessThan(
      e.orden.indexOf("persist"),
    );
  });

  it("persiste el script final junto con el estado detenida", async () => {
    const e = crearEscenario({ spec: "import { test } from '@playwright/test';" });
    await createStopSession(e.deps)("ses-1", "browser_closed");

    expect(e.persistido).toEqual([
      {
        estado: "detenida",
        specCode: "import { test } from '@playwright/test';",
      },
    ]);
  });

  it("no pisa el script guardado si el archivo no se pudo leer", async () => {
    const e = crearEscenario({ spec: null });
    await createStopSession(e.deps)("ses-1", "user_stop");

    expect(e.persistido).toHaveLength(1);
    expect(e.persistido[0]!.estado).toBe("detenida");
    expect(e.persistido[0]).not.toHaveProperty("specCode");
  });

  it("no vuelve a matar un runner que ya salió solo", async () => {
    // Camino del cierre de ventana: el proceso ya terminó por su cuenta.
    const e = crearEscenario({ alive: false });
    await createStopSession(e.deps)("ses-1", "browser_closed");

    expect(e.orden).not.toContain("kill");
    expect(e.persistido).toHaveLength(1);
  });

  it("dos paradas seguidas no duplican escrituras ni avisos", async () => {
    // Detener y cerrar la ventana pueden ocurrir con milisegundos de
    // diferencia.
    const e = crearEscenario();
    const stop = createStopSession(e.deps);

    await Promise.all([
      stop("ses-1", "user_stop"),
      stop("ses-1", "browser_closed"),
    ]);
    await stop("ses-1", "browser_closed");

    expect(e.persistido).toHaveLength(1);
    expect(e.avisos).toHaveLength(1);
    expect(e.avisos[0]).toEqual({
      type: "sesion_detenida",
      reason: "user_stop",
    });
  });

  it("no hace nada si la sesión ya no está registrada", async () => {
    const e = crearEscenario();
    e.deps.getEntry = () => undefined;

    await createStopSession(e.deps)("ses-1", "browser_closed");

    expect(e.orden).toEqual([]);
    expect(e.persistido).toEqual([]);
  });

  it("libera la sesión y cierra los clientes conectados", async () => {
    const e = crearEscenario();
    await createStopSession(e.deps)("ses-1", "user_stop");

    expect(e.clienteCerrado()).toBe(true);
    expect(e.entryVive()).toBe(false);
    expect(e.orden).toContain("closeWatcher");
    expect(e.orden).toContain("removeEntry");
  });

  it("sigue adelante aunque falle la persistencia", async () => {
    // Perder la fila en base de datos no debe dejar el runner vivo ni la
    // sesión ocupando un cupo del registro.
    const e = crearEscenario();
    e.deps.persist = async () => {
      throw new Error("db caída");
    };

    await expect(
      createStopSession(e.deps)("ses-1", "browser_closed"),
    ).resolves.toBeUndefined();

    expect(e.orden).toContain("removeEntry");
    expect(e.entryVive()).toBe(false);
  });
});
