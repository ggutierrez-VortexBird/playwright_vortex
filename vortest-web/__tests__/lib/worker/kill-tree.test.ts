import { killProcessTree } from "@/lib/worker/kill-tree";

describe("lib/worker/kill-tree", () => {
  it("retorna sin lanzar cuando pid es undefined", async () => {
    await expect(killProcessTree(undefined)).resolves.toBeUndefined();
  });

  it("retorna sin lanzar cuando pid es 0 (falsy)", async () => {
    await expect(killProcessTree(0)).resolves.toBeUndefined();
  });

  it("no lanza en Unix cuando pid no existe (ESRCH)", async () => {
    if (process.platform === "win32") {
      // En Windows se delega a taskkill — el código de error es distinto
      // y la función no lo testea aquí (no tenemos un taskkill mockeado).
      return;
    }
    // En Unix, process.kill con un PID inexistente lanza ESRCH;
    // nuestra función captura ESRCH y retorna silenciosamente.
    // Probamos con un PID muy alto improbable que exista.
    const pid = 999_999;
    await expect(killProcessTree(pid)).resolves.toBeUndefined();
  });

  it("no lanza en Unix con force=true y PID inexistente", async () => {
    if (process.platform === "win32") return;
    const pid = 999_998;
    await expect(killProcessTree(pid, true)).resolves.toBeUndefined();
  });

  it("acepta pid numérico en Windows (smoke test sin matar nada)", async () => {
    // En Windows con taskkill: smoke-test con un PID ficticio. La promesa
    // resuelve por el setTimeout(3s) interno si taskkill tarda.
    // NO usamos process.pid (sería destructivo para el worker de jest).
    if (process.platform !== "win32") return;
    const fakePid = 999_997;
    await expect(killProcessTree(fakePid, true)).resolves.toBeUndefined();
  });
});
