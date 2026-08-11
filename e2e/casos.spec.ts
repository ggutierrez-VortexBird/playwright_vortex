import { test, expect } from "@playwright/test";
import path from "path";

const TEST_SCRIPT_PATH = path.join(__dirname, "../fixtures/test-script.spec.ts");

test.describe("HU-2.3 Registrar caso de prueba con su script de Playwright", () => {
  test.beforeEach(async ({ page }) => {
    // Login as superadmin before each test
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@admin.com");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  async function createEspacioIfNeeded(page: any, nombre: string = "Espacio para casos") {
    await page.goto("/espacios");
    await page.waitForURL("/espacios");

    const exists = await page.locator(`text=${nombre}`).isVisible().catch(() => false);
    if (exists) {
      await page.click(`text=${nombre}`);
      await page.waitForURL(new RegExp(`/espacios/[^/]+/proyectos`));
      return;
    }

    await page.click("button:has-text('+ Crear espacio')");
    await page.fill('input[id="nombre"]', nombre);
    await page.click('button[aria-label*="Seleccionar color"]');
    await page.click('button[type="submit"]:has-text("Crear espacio")');
    await page.waitForTimeout(500);

    await page.click(`text=${nombre}`);
    await page.waitForURL(new RegExp(`/espacios/[^/]+/proyectos`));
  }

  async function createProyectoIfNeeded(page: any, nombre: string = "Proyecto para casos") {
    const createButton = page.locator("button:has-text('+ Crear proyecto')");
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.fill('input[id="nombre"]', nombre);
      await page.fill('input[id="ambiente"]', "QA");
      await page.click('button[type="submit"]:has-text("Crear proyecto")');
      await page.waitForTimeout(500);
      await page.reload();
    }

    // Navigate to the proyecto casos page via "Ver casos" link
    await page.click(`text=${nombre}`);
    await page.waitForURL(new RegExp(`/proyectos/[^/]+/casos`));
  }

  test("should create a new caso de prueba with file upload", async ({ page }) => {
    // Setup: ensure espacio and proyecto exist, then navigate to proyecto casos
    await createEspacioIfNeeded(page, "Espacio para crear caso");
    await createProyectoIfNeeded(page, "Proyecto para crear caso");

    // Now on /proyectos/{id}/casos
    await expect(page.locator("h1:has-text('Casos de prueba')")).toBeVisible();

    // Click create button
    await page.click("button:has-text('+ Nuevo Caso')");

    // Fill in the form
    await page.fill('input[id="codigo"]', "CP-E2E-01");
    await page.fill('input[id="nombre"]', "Caso E2E de prueba");

    // Upload script file
    await page.setInputFiles('input[type="file"]', TEST_SCRIPT_PATH);

    // Select responsable (first real option)
    await page.selectOption('select[id="responsable"]', { index: 1 });

    // Submit
    await page.click('button[type="submit"]:has-text("Crear Caso")');

    // Wait for success and reload
    await page.waitForTimeout(500);
    await page.reload();

    // Verify the caso appears in the table
    await expect(page.locator("text=CP-E2E-01")).toBeVisible();
    await expect(page.locator("text=Caso E2E de prueba")).toBeVisible();
    await expect(page.locator("text=test-script.spec.ts")).toBeVisible();
  });

  test("should show validation error when uploading invalid file type", async ({ page }) => {
    await createEspacioIfNeeded(page, "Espacio para validacion archivo");
    await createProyectoIfNeeded(page, "Proyecto para validacion archivo");

    await page.click("button:has-text('+ Nuevo Caso')");

    await page.fill('input[id="codigo"]', "CP-INVALID-01");
    await page.fill('input[id="nombre"]', "Caso con archivo inválido");

    // Try to upload a .txt file
    const invalidFile = path.join(__dirname, "../fixtures/invalid-file.txt");
    await page.setInputFiles('input[type="file"]', invalidFile);

    await page.selectOption('select[id="responsable"]', { index: 1 });
    await page.click('button[type="submit"]:has-text("Crear Caso")');

    // Should show validation error
    await expect(page.locator("text=El archivo debe ser .spec.ts o .test.ts")).toBeVisible();
  });

  test("should show validation error when creating without codigo", async ({ page }) => {
    await createEspacioIfNeeded(page, "Espacio para validacion caso");
    await createProyectoIfNeeded(page, "Proyecto para validacion caso");

    await page.click("button:has-text('+ Nuevo Caso')");

    // Try to submit without filling codigo (but fill other required fields)
    await page.fill('input[id="nombre"]', "Caso sin codigo");
    await page.setInputFiles('input[type="file"]', TEST_SCRIPT_PATH);
    await page.selectOption('select[id="responsable"]', { index: 1 });
    await page.click('button[type="submit"]:has-text("Crear Caso")');

    // Check for native HTML validation on codigo input
    const codigoInput = page.locator('input[id="codigo"]');
    await expect(codigoInput).toHaveAttribute("required", "");
  });

  test("should cancel create mode", async ({ page }) => {
    await createEspacioIfNeeded(page, "Espacio para cancelar caso");
    await createProyectoIfNeeded(page, "Proyecto para cancelar caso");

    await page.click("button:has-text('+ Nuevo Caso')");
    await expect(page.locator('input[id="codigo"]')).toBeVisible();

    await page.click('button:has-text("Cancelar")');

    // Verify form is hidden
    await expect(page.locator('input[id="codigo"]')).not.toBeVisible();
  });
});
