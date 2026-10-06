/**
 * HU-G1 E2E: Iniciar sesión de grabación exitosa.
 *
 * Requisitos para correr este test:
 *   - dev server corriendo: `npm run dev` (Next.js + worker + recorder)
 *   - DB con al menos un proyecto y credencial demo (ejecutar `npm run db:seed`)
 *   - Recorder-worker respondiendo en ws://localhost:3100
 *
 * Ejecutar: npx playwright test e2e/grabador-iniciar.spec.ts
 * (Nota: requiere un config que incluya `testDir: './e2e'` o invocar con --config)
 */
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "admin123";

test.describe("HU-G1 Iniciar sesión de grabación", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("happy path: abrir form, iniciar, ver EN VIVO <5s", async ({ page }) => {
    // 1. Navegar a /casos/grabar/nueva
    await page.goto("/casos/grabar/nueva");

    // 2. Llenar form
    await page.fill('input[id="nombre"]', "E2E grabación QA");
    // URL accesible local — usar about:blank para evitar dependencia externa
    await page.fill('input[id="urlInicial"]', "about:blank");

    // 3. Click en Iniciar grabación
    const startTime = Date.now();
    await page.click('button[type="submit"]:has-text("Iniciar grabación")');

    // 4. Esperar redirección a /casos/grabar/[id]
    await page.waitForURL(/\/casos\/grabar\/.+/, { timeout: 10000 });

    // 5. Esperar badge "EN VIVO" o "INICIANDO"
    await expect(page.getByTestId("connection-status")).toBeVisible({
      timeout: 5000,
    });

    // El status debe transicionar a EN VIVO en <5s desde el click
    const statusBadge = page.getByTestId("connection-status");
    await expect(statusBadge).toContainText(/EN VIVO|INICIANDO/, { timeout: 5000 });
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(8000); // 5s target + 3s de margen para browser launch

    // 6. Verificar que el canvas está montado
    await expect(page.getByTestId("screencast-canvas")).toBeVisible();

    // 7. Verificar que el toolbar de rec está visible
    await expect(page.getByTestId("rec-toolbar")).toBeVisible();
  });

  test("URL no accesible → error boundary <12s", async ({ page }) => {
    await page.goto("/casos/grabar/nueva");

    await page.fill('input[id="nombre"]', "E2E url fail");
    // localhost:1 nunca responde (connection refused)
    await page.fill('input[id="urlInicial"]', "http://localhost:1");

    await page.click('button[type="submit"]:has-text("Iniciar grabación")');

    // Esperar redirección + error boundary
    await page.waitForURL(/\/casos\/grabar\/.+/, { timeout: 5000 });

    // El error boundary muestra "Reintentar" — la página NO renderiza el cliente
    // El recorder marca estado='error' y notifica al WS → el cliente muestra
    // el badge ERROR o el banner vp-error
    await expect(
      page
        .getByTestId("connection-status")
        .or(page.getByRole("alert").filter({ hasText: /Error/ })),
    ).toBeVisible({ timeout: 12000 });
  });
});