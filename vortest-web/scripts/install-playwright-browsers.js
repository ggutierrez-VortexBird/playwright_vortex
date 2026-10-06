#!/usr/bin/env node
/**
 * Postinstall script: ensures Playwright Chromium browser is installed.
 *
 * This runs automatically after `npm install` so users don't have to manually
 * run `npx playwright install`. It is idempotent: if browsers are already
 * installed, it's a no-op (instant).
 *
 * It only installs Chromium (not Firefox/WebKit) because that's what the
 * ACTA worker uses for executing test cases. Other browsers can be installed
 * manually with `npx playwright install firefox` if needed.
 */

const { execSync } = require("node:child_process");

function isChromiumInstalled() {
  try {
    // Ask Playwright where it expects the browser binary to be
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
      // Skip dep installation on Linux (would require sudo); on Windows/macOS it just downloads
      env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_GC: "1" },
    });
    console.log("[postinstall] Chromium installed successfully.");
  } catch (err) {
    console.warn("[postinstall] Could not install Chromium automatically.");
    console.warn("[postinstall] Run `npx playwright install chromium` manually if needed.");
  }
}

if (isChromiumInstalled()) {
  // Silent: already installed, nothing to do
  process.exit(0);
}

installChromium();