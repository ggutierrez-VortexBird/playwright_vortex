import { test, expect } from "@playwright/test";

test.describe("HU-2.1 Crear espacio de empresa", () => {
  test.beforeEach(async ({ page }) => {
    // Login as superadmin before each test
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@admin.com");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    // Navigate to espacios page
    await page.click('a[href="/espacios"]');
    await page.waitForURL("/espacios");
  });

  test("should create a new espacio", async ({ page }) => {
    // Click create button
    await page.click("button:has-text('+ Crear espacio')");

    // Fill in the form
    await page.fill('input[id="nombre"]', "Acme Corp Test");

    // Select a color (first swatch)
    await page.click('button[aria-label*="Seleccionar color"]');

    // Submit
    await page.click('button[type="submit"]:has-text("Crear espacio")');

    // Wait for success and reload
    await page.waitForTimeout(500);
    await page.reload();

    // Verify the espacio appears in the list
    await expect(page.locator("text=Acme Corp Test")).toBeVisible();
  });

  test("should edit an existing espacio", async ({ page }) => {
    // First create an espacio
    await page.click("button:has-text('+ Crear espacio')");
    await page.fill('input[id="nombre"]', "Espacio para editar");
    await page.click('button[aria-label*="Seleccionar color"]');
    await page.click('button[type="submit"]:has-text("Crear espacio")');
    await page.waitForTimeout(500);
    await page.reload();

    // Click edit on the espacio
    await page.click('button:has-text("Editar")');

    // Change the name
    await page.fill('input[id="nombre"]', "Espacio editado");
    await page.click('button[type="submit"]:has-text("Guardar cambios")');

    // Wait for reload
    await page.waitForTimeout(500);
    await page.reload();

    // Verify the updated name appears
    await expect(page.locator("text=Espacio editado")).toBeVisible();
  });

  test("should delete an espacio", async ({ page }) => {
    // First create an espacio
    await page.click("button:has-text('+ Crear espacio')");
    await page.fill('input[id="nombre"]', "Espacio para eliminar");
    await page.click('button[aria-label*="Seleccionar color"]');
    await page.click('button[type="submit"]:has-text("Crear espacio")');
    await page.waitForTimeout(500);
    await page.reload();

    // Click delete (and confirm)
    page.on("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("Eliminar")');

    // Wait for reload
    await page.waitForTimeout(500);
    await page.reload();

    // Verify the espacio no longer appears
    await expect(page.locator("text=Espacio para eliminar")).not.toBeVisible();
  });

  test("should show validation error when creating without nombre", async ({ page }) => {
    // Click create button
    await page.click("button:has-text('+ Crear espacio')");

    // Try to submit without filling nombre
    await page.click('button[aria-label*="Seleccionar color"]');
    await page.click('button[type="submit"]:has-text("Crear espacio")');

    // Check for validation error (native HTML validation)
    const input = page.locator('input[id="nombre"]');
    await expect(input).toHaveAttribute("required", "");
  });

  test("should cancel edit mode", async ({ page }) => {
    // First create an espacio
    await page.click("button:has-text('+ Crear espacio')");
    await page.fill('input[id="nombre"]', "Espacio para cancelar");
    await page.click('button[aria-label*="Seleccionar color"]');
    await page.click('button[type="submit"]:has-text("Crear espacio")');
    await page.waitForTimeout(500);
    await page.reload();

    // Click edit
    await page.click('button:has-text("Editar")');

    // Click cancel
    await page.click('button:has-text("Cancelar")');

    // Verify form is hidden and list is shown
    await expect(page.locator("text=Espacio para cancelar")).toBeVisible();
    await expect(page.locator('input[id="nombre"]')).not.toBeVisible();
  });
});
