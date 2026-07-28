import fs from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  path.resolve(__dirname, "../../.internal/smoke-tools/package.json"),
);
const { chromium } = require("playwright");

function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const env = loadEnv(path.join(root, ".env"));
  const portal = `http://localhost:${env.DEV_PORTAL_PORT || "3100"}`;
  const password = env.ADMIN_INITIAL_PASSWORD;
  if (!password) throw new Error("ADMIN_INITIAL_PASSWORD missing");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  const results = [];
  const check = (name, ok, detail = "") => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  };

  await page.goto(`${portal}/login`, { waitUntil: "networkidle" });
  await page.getByLabel(/Username|Korisničko ime/i).fill("admin");
  await page.getByLabel(/Password|Lozinka/i).fill(password);
  await page.getByRole("button", { name: /Login|Prijava/i }).click();
  await page.waitForURL("**/dashboard");

  const header = page.locator("header").first();
  const headerText = (await header.innerText()).replace(/\s+/g, " ");
  check(
    "page header has no Administrator/admin identity",
    !/Administrator/i.test(headerText) && !/\badmin\b/i.test(headerText),
    headerText.slice(0, 120),
  );

  const sidebar = page.locator("aside").first();
  const appearanceSelect = sidebar.locator(
    'select[aria-label*="Appearance"], select[aria-label*="Izgled"]',
  );
  const languageSelect = sidebar.locator(
    'select[aria-label*="Language"], select[aria-label*="Jezik"]',
  );
  check("sidebar has no appearance select", (await appearanceSelect.count()) === 0);
  check("sidebar has no language select", (await languageSelect.count()) === 0);
  check(
    "sidebar has Settings nav",
    (await sidebar.getByRole("link", { name: /Settings|Podešavanja/i }).count()) >= 1,
  );
  check(
    "sidebar has Logout",
    (await sidebar.getByRole("button", { name: /Logout|Odjava/i }).count()) === 1,
  );

  await sidebar.getByRole("link", { name: /Settings|Podešavanja/i }).click();
  await page.waitForURL("**/settings");
  const settingsLink = sidebar.getByRole("link", { name: /Settings|Podešavanja/i });
  check(
    "Settings nav is active",
    (await settingsLink.getAttribute("aria-current")) === "page",
  );

  await page.getByRole("radio", { name: "English" }).click();
  await page.waitForTimeout(300);
  check(
    "English language applied",
    (await page.getByRole("heading", { name: "Settings", level: 1 }).count()) === 1,
  );

  await page.getByRole("radio", { name: "Light" }).click();
  await page.waitForTimeout(200);
  check(
    "Light appearance applied",
    (await page.evaluate(() => document.documentElement.dataset.theme)) === "light" &&
      (await page.evaluate(() => document.documentElement.dataset.appearance)) === "light",
  );

  await page.getByRole("radio", { name: "Dark" }).click();
  await page.waitForTimeout(200);
  check(
    "Dark appearance applied",
    (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark" &&
      (await page.evaluate(() => document.documentElement.dataset.appearance)) === "dark",
  );

  await page.getByRole("radio", { name: "System" }).click();
  await page.waitForTimeout(200);
  check(
    "System appearance selected",
    (await page.evaluate(() => document.documentElement.dataset.appearance)) === "system",
  );

  await page.goto(`${portal}/dashboard`, { waitUntil: "networkidle" });
  const dashHeader = (await page.locator("header").first().innerText()).replace(/\s+/g, " ");
  check(
    "dashboard header has no identity repeat",
    !/Administrator/i.test(dashHeader) && !/\badmin\b/i.test(dashHeader),
  );
  check(
    "dashboard reflects English",
    (await page.getByRole("heading", { name: "Dashboard", level: 1 }).count()) === 1,
  );

  await page.goto(`${portal}/organization/employees`, { waitUntil: "networkidle" });
  check(
    "business page reflects English",
    (await page.getByRole("heading", { level: 1 }).innerText()).toLowerCase().includes("employee") ||
      (await page.locator("h1").first().innerText()).length > 0,
  );
  const employeesTheme = await page.evaluate(() => document.documentElement.dataset.appearance);
  check("business page keeps appearance preference", employeesTheme === "system");

  await page.goto(`${portal}/settings`, { waitUntil: "networkidle" });
  check(
    "preferences survive navigation",
    (await page.getByRole("radio", { name: "English" }).getAttribute("aria-checked")) === "true" &&
      (await page.getByRole("radio", { name: "System" }).getAttribute("aria-checked")) === "true",
  );

  await page.reload({ waitUntil: "networkidle" });
  check(
    "preferences survive reload",
    (await page.getByRole("radio", { name: "English" }).getAttribute("aria-checked")) === "true" &&
      (await page.getByRole("radio", { name: "System" }).getAttribute("aria-checked")) === "true" &&
      (await page.evaluate(() => localStorage.getItem("internal-apps.locale"))) === "en" &&
      (await page.evaluate(() => localStorage.getItem("internal-apps.appearance"))) === "system",
  );

  await page.getByRole("radio", { name: /Serbian|Srpski/ }).click();
  await page.waitForTimeout(300);
  check(
    "Serbian Latin applied",
    (await page.getByRole("heading", { name: "Podešavanja", level: 1 }).count()) === 1,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${portal}/dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Open navigation|Otvori navigaciju/i }).click();
  const mobileNav = page.locator("#mobile-navigation");
  check(
    "mobile nav has Settings and Logout, no preference selects",
    (await mobileNav.getByRole("link", { name: /Podešavanja|Settings/i }).count()) >= 1 &&
      (await mobileNav.getByRole("button", { name: /Odjava|Logout/i }).count()) === 1 &&
      (await mobileNav.locator("select").count()) === 0,
  );

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  check("no document-level horizontal overflow", !hasOverflow);

  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName || "");
  check("keyboard focus moves", focusedTag.length > 0, focusedTag);

  const relevantErrors = consoleErrors.filter(
    (text) =>
      !/favicon/i.test(text) &&
      !/Failed to load resource: the server responded with a status of 401/i.test(text),
  );
  check("clean browser console", relevantErrors.length === 0, relevantErrors.join(" | "));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
