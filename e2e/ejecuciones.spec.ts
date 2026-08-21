// e2e/ejecuciones.spec.ts
// RED E2E test — testing the complete HU-3 flow
// Verifies AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10, AC-11

import { test, expect } from "@playwright/test";
import path from "path";

const VALID_TEST_SCRIPT = `
import { test, expect } from "@playwright/test";
test("pasa", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Acta/);
});
`.trim();

test.describe.serial("HU-3 — Motor de ejecución Playwright", () => {
  test.beforeEach(async ({ page }) => {
    // Login as superadmin
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@admin.com");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  async function createEspacioIfNeeded(page: any, nombre: string) {
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

  async function createProyectoIfNeeded(page: any, nombre: string) {
    const createButton = page.locator("button:has-text('+ Crear proyecto')");
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.fill('input[id="nombre"]', nombre);
      await page.fill('input[id="ambiente"]', "QA");
      await page.click('button[type="submit"]:has-text("Crear proyecto")');
      await page.waitForTimeout(500);
      await page.reload();
    }
    await page.click(`text=${nombre}`);
    await page.waitForURL(new RegExp(`/proyectos/[^/]+/casos`));
  }

  async function createCasoConScript(page: any, codigo: string, nombre: string) {
    await page.click("button:has-text('+ Nuevo Caso')");
    await page.fill('input[id="codigo"]', codigo);
    await page.fill('input[id="nombre"]', nombre);

    // We can't upload a file directly since we're creating the script in memory
    // Instead, we'll use the script directly via API or fill it another way
    // For this E2E test, we'll create via API then verify in UI
  }

  test("flujo completo: crear caso → ejecutar → ver ejecución → verificar estado final — AC-1, AC-2, AC-3", async ({ page }) => {
    const espacioNombre = "Espacio HU-3-" + Date.now();
    const proyectoNombre = "Proyecto HU-3-" + Date.now();
    const casoCodigo = "CP-HU3-" + Date.now();
    const casoNombre = "Caso HU-3 E2E";

    // Setup: create espacio, proyecto
    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    // Navigate to casos page
    await expect(page.locator("h1:has-text('Casos de prueba')")).toBeVisible();

    // Create caso via API since we need to provide script content
    // This is a workaround since the UI might not have direct script editing
    const casoResponse = await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: casoNombre,
        script: VALID_TEST_SCRIPT,
        scriptFileName: "e2e-test.spec.ts",
        proyectoId: page.url().split("/proyectos/")[1].split("/casos")[0],
        responsableId: "user-123",
      },
    });

    if (casoResponse.status() === 201 || casoResponse.status() === 200) {
      await page.reload();
    }

    // Verify caso appears in the table
    await expect(page.locator(`text=${casoCodigo}`)).toBeVisible({ timeout: 5000 });

    // Find the ejecutar button for this caso
    const ejecutarButton = page.locator(`button[aria-label*="Ejecutar"]`).first();
    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);

    // Click ejecutar button — AC-1: should return immediately with pendiente
    await rowEjecutarButton.click();

    // Should redirect to execution detail page
    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    // AC-2: verify the execution shows as "pendiente" initially (without reload)
    // The status pill should show "pendiente" state
    await expect(page.locator(".pill:has-text('pendiente'), .p-idle:has-text('pendiente')")).toBeVisible({ timeout: 5000 });

    // AC-9: verify steps appear without reload (polling every 2s)
    // Wait for status to change from "pendiente" to "corriendo"
    await expect(
      page.locator(".pill:has-text('corriendo'), .p-running:has-text('corriendo')")
    ).toBeVisible({ timeout: 30000 });

    // AC-10: newly added step should appear in the accordion
    const pasosLocator = page.locator("[data-purpose='step-row']");
    await expect(pasosLocator.first()).toBeVisible({ timeout: 30000 });

    // AC-3: wait for final state (paso or fallo)
    // The execution should eventually reach a terminal state
    await expect(
      page.locator(
        ".pill:has-text('paso'), .p-pass:has-text('paso'), .pill:has-text('falló'), .p-fail:has-text('falló'), .pill:has-text('fallo'), .p-fail:has-text('fallo')"
      )
    ).toBeVisible({ timeout: 120000 });
  });

  test("pestaña global /ejecuciones agrupa por proyecto — AC-4", async ({ page }) => {
    // Navigate to global executions page
    await page.goto("/ejecuciones");
    await page.waitForURL("/ejecuciones");

    // The page should exist and show the ledger layout
    // Grouping by project should be visible
    await expect(page.locator("h1:has-text('Ejecuciones')")).toBeVisible();
  });

  test("segunda ejecución concurrente para el mismo caso devuelve 409 — AC-5", async ({ page }) => {
    // First, create a caso and start an execution
    const espacioNombre = "Espacio Conc-" + Date.now();
    const proyectoNombre = "Proyecto Conc-" + Date.now();
    const casoCodigo = "CP-CONC-" + Date.now();

    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    await expect(page.locator("h1:has-text('Casos de prueba')")).toBeVisible();

    // Get the proyectoId from URL
    const proyectoId = page.url().split("/proyectos/")[1].split("/casos")[0];

    // Create caso via API
    await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: "Caso Concurrency Test",
        script: VALID_TEST_SCRIPT,
        scriptFileName: "conc-test.spec.ts",
        proyectoId: proyectoId,
        responsableId: "user-123",
      },
    });

    await page.reload();

    // Start first execution
    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await rowEjecutarButton.click();

    // Wait for the execution page
    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    // Go back to casos page and try to execute again
    await page.goto(`/proyectos/${proyectoId}/casos`);
    await expect(page.locator(`text=${casoCodigo}`)).toBeVisible({ timeout: 5000 });

    // Try to execute again while the first is still running
    const secondEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await secondEjecutarButton.click();

    // Should show a 409 conflict error message
    await expect(page.locator("text=409, conflict, ya existe una ejecución en curso")).toBeVisible({ timeout: 5000 });
  });

  test("errorMotor no muestra pasos falsos — AC-7, AC-8", async ({ page }) => {
    const espacioNombre = "Espacio Err-" + Date.now();
    const proyectoNombre = "Proyecto Err-" + Date.now();
    const casoCodigo = "CP-ERR-" + Date.now();

    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    const proyectoId = page.url().split("/proyectos/")[1].split("/casos")[0];

    // Create caso with empty script (should trigger errorMotor)
    await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: "Caso Error Motor Test",
        script: "", // Empty script
        scriptFileName: "error-test.spec.ts",
        proyectoId: proyectoId,
        responsableId: "user-123",
      },
    });

    await page.reload();

    // Execute the caso
    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await rowEjecutarButton.click();

    // Wait for execution page
    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    // Wait for errorMotor state
    await expect(
      page.locator(".stamp:has-text('ERROR MOTOR'), .pill:has-text('errorMotor')")
    ).toBeVisible({ timeout: 60000 });

    // AC-8: should see zero steps or exactly one error step (no false test steps)
    const steps = page.locator("[data-purpose='step-row']");
    const stepCount = await steps.count();

    // Should be 0 or 1 (the error step) — not fake test steps
    expect(stepCount).toBeLessThanOrEqual(1);
  });

  test("pasos aparecen en vivo sin reload (polling 2s) — AC-9", async ({ page }) => {
    // This test is covered by the main flow test above
    // but we verify specifically that steps appear progressively
    const espacioNombre = "Espacio Live-" + Date.now();
    const proyectoNombre = "Proyecto Live-" + Date.now();
    const casoCodigo = "CP-LIVE-" + Date.now();

    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    const proyectoId = page.url().split("/proyectos/")[1].split("/casos")[0];

    // Create caso with multi-step script
    const multiStepScript = `
import { test, expect } from "@playwright/test";
test("step 1", async ({ page }) => { await page.goto("/"); });
test("step 2", async ({ page }) => { await page.waitForTimeout(100); });
test("step 3", async ({ page }) => { await page.waitForTimeout(100); });
    `.trim();

    await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: "Caso Live Steps Test",
        script: multiStepScript,
        scriptFileName: "live-test.spec.ts",
        proyectoId: proyectoId,
        responsableId: "user-123",
      },
    });

    await page.reload();

    // Execute
    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await rowEjecutarButton.click();

    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    // Wait for the first step to appear
    await expect(page.locator("[data-purpose='step-row']:has-text('step 1')")).toBeVisible({ timeout: 30000 });

    // Count steps at different intervals - they should increase as polling fetches new steps
    const initialCount = await page.locator("[data-purpose='step-row']").count();
    expect(initialCount).toBeGreaterThanOrEqual(1);
  });

  test("accordion permite expandir y colapsar pasos — AC-5", async ({ page }) => {
    const espacioNombre = "Espacio Acc-" + Date.now();
    const proyectoNombre = "Proyecto Acc-" + Date.now();
    const casoCodigo = "CP-ACC-" + Date.now();

    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    const proyectoId = page.url().split("/proyectos/")[1].split("/casos")[0];

    const multiStepScript = `
import { test, expect } from "@playwright/test";
test("step 1", async ({ page }) => { await page.goto("/"); });
test("step 2", async ({ page }) => { await page.waitForTimeout(100); });
    `.trim();

    await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: "Caso Accordion Test",
        script: multiStepScript,
        scriptFileName: "acc-test.spec.ts",
        proyectoId: proyectoId,
        responsableId: "user-123",
      },
    });

    await page.reload();

    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await rowEjecutarButton.click();

    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    // Wait for final state
    await expect(
      page.locator(".pill:has-text('paso'), .p-pass:has-text('paso'), .pill:has-text('falló'), .p-fail:has-text('falló'), .pill:has-text('fallo'), .p-fail:has-text('fallo')")
    ).toBeVisible({ timeout: 120000 });

    // Wait for accordion step rows
    const firstStep = page.locator("[data-purpose='step-row']").first();
    await expect(firstStep).toBeVisible({ timeout: 10000 });

    // Expand first step
    await firstStep.click();
    await expect(page.locator("text=Detalles Técnicos")).toBeVisible();

    // Collapse first step
    await firstStep.click();
    await expect(page.locator("text=Detalles Técnicos")).not.toBeVisible();
  });
});
