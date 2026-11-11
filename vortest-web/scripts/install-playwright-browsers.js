#!/usr/bin/env node
// Postinstall: instala Chromium de Playwright si falta; idempotente.

const { execSync } = require("node:child_process");

function isChromiumInstalled() {
  try {
    // Pregunta a Playwright dónde espera el binario del navegador
    const result = execSync("node -e \"const {chromium}=require('@playwright/test'); console.log(chromium.executablePath());\"", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
    require("node:fs").accessSync(result);
    return true;
  } catch {
    return false;
  }
}

function installChromium() {
  console.log("[postinstall] Installing Playwright Chromium browser (one-time)...");
  try {
    execSync("npx playwright install chromium", {
      stdio: "inherit",
      // En Linux se omiten las dependencias (requerirían sudo); en Windows/macOS solo descarga
      env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_GC: "1" },
    });
    console.log("[postinstall] Chromium installed successfully.");
  } catch (err) {
    console.warn("[postinstall] Could not install Chromium automatically.");
    console.warn("[postinstall] Run `npx playwright install chromium` manually if needed.");
  }
}

if (isChromiumInstalled()) {
  // Silencioso: ya instalado, nada que hacer
  process.exit(0);
}

installChromium();