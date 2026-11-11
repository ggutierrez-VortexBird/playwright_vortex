// URL no accesible: el recorder marca estado='error' y el frontend lo refleja.
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "admin123";

test.describe("URL no accesible", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("URL inaccesible → error boundary con mensaje específico", async ({ page }) => {
    await page.goto("/casos/grabar/nueva");

    await page.fill('input[id="nombre"]', "URL fail");
    // DNS no resuelve (no debería haber respuesta rápida)
    await page.fill('input[id="urlInicial"]', "http://nonexistent.invalid.example");

    await page.click('button[type="submit"]:has-text("Iniciar grabación")');

    await page.waitForURL(/\/casos\/grabar\/.+/, { timeout: 5000 });

    // Indicador de error en menos de 12s (10s de timeout de page.goto + 2s de margen)
    const startTime = Date.now();
    await expect(
      page.getByRole("alert").or(page.getByTestId("connection-status")),
    ).toBeVisible({ timeout: 12000 });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(12000);

    // El status debe ser ERROR o el alert debe contener "Error"
    const errorIndicator = await Promise.race([
      page.getByTestId("connection-status").textContent(),
      page.getByRole("alert").first().textContent(),
    ]);
    expect(errorIndicator).toMatch(/ERROR|Error/);
  });
});