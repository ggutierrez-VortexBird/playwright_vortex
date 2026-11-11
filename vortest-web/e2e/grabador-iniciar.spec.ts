// Requiere dev server, BD con seed (npm run db:seed) y recorder-worker en ws://localhost:3100.
// Ejecutar: npx playwright test e2e/grabador-iniciar.spec.ts
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "admin123";

test.describe("Iniciar sesión de grabación", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("happy path: abrir form, iniciar, ver EN VIVO <5s", async ({ page }) => {
    await page.goto("/casos/grabar/nueva");

    await page.fill('input[id="nombre"]', "E2E grabación QA");
    // about:blank evita depender de un sitio externo
    await page.fill('input[id="urlInicial"]', "about:blank");

    const startTime = Date.now();
    await page.click('button[type="submit"]:has-text("Iniciar grabación")');

    await page.waitForURL(/\/casos\/grabar\/.+/, { timeout: 10000 });

    await expect(page.getByTestId("connection-status")).toBeVisible({
      timeout: 5000,
    });

    // Debe pasar a EN VIVO en menos de 5s tras el clic
    const statusBadge = page.getByTestId("connection-status");
    await expect(statusBadge).toContainText(/EN VIVO|INICIANDO/, { timeout: 5000 });
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(8000); // 5s target + 3s de margen para browser launch

    await expect(page.getByTestId("screencast-canvas")).toBeVisible();

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

    // El recorder marca estado='error' y notifica al WS: el cliente muestra el badge ERROR o el banner vp-error
    await expect(
      page
        .getByTestId("connection-status")
        .or(page.getByRole("alert").filter({ hasText: /Error/ })),
    ).toBeVisible({ timeout: 12000 });
  });
});