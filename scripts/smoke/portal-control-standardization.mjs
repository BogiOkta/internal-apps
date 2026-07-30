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

async function setLocale(page, portal, value) {
  await page.goto(`${portal}/settings`, { waitUntil: "networkidle" });
  if (value === "en") await page.getByRole("radio", { name: "English" }).click();
  else await page.getByRole("radio", { name: /Serbian|Srpski/ }).click();
  await page.waitForTimeout(200);
}

async function setAppearance(page, portal, value) {
  await page.goto(`${portal}/settings`, { waitUntil: "networkidle" });
  const labels =
    value === "dark"
      ? ["Dark", "Tamni", "Tamno"]
      : value === "light"
        ? ["Light", "Svetli", "Svetlo"]
        : ["System", "Sistemski", "Sistem"];
  for (const label of labels) {
    const radio = page.getByRole("radio", { name: label });
    if ((await radio.count()) > 0) {
      await radio.click();
      break;
    }
  }
  await page.waitForTimeout(200);
}

async function assertNoNativeDate(page, check, name) {
  check(name, (await page.locator('input[type="date"]').count()) === 0);
}

async function assertNoOverflow(page, check, name) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  check(name, !overflow);
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const env = loadEnv(path.join(root, ".env"));
  const portal = `http://localhost:${env.DEV_PORTAL_PORT || "3100"}`;
  const password = env.ADMIN_INITIAL_PASSWORD;
  if (!password) throw new Error("ADMIN_INITIAL_PASSWORD missing");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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

  await setLocale(page, portal, "en");
  await setAppearance(page, portal, "light");

  // Settings
  await page.goto(`${portal}/settings`, { waitUntil: "networkidle" });
  check("settings heading", (await page.getByRole("heading", { name: "Settings", level: 1 }).count()) === 1);
  check("settings language radios", (await page.getByRole("radio", { name: "English" }).count()) === 1);
  check("settings appearance radios", (await page.getByRole("radio", { name: "Light" }).count()) === 1);

  // Administrative absence
  await page.goto(`${portal}/vacation/admin/requests/record`, { waitUntil: "networkidle" });
  await assertNoNativeDate(page, check, "record form has no native date");
  check(
    "record form PortalDateInput",
    (await page.locator('input[aria-label="record-date-from day"]').count()) === 1,
  );
  await page.locator('input[aria-label="record-date-from day"]').fill("06");
  await page.locator('input[aria-label="record-date-from month"]').fill("07");
  await page.locator('input[aria-label="record-date-from year"]').fill("2026");
  await page.locator('input[aria-label="record-date-to day"]').fill("08");
  await page.locator('input[aria-label="record-date-to month"]').fill("07");
  await page.locator('input[aria-label="record-date-to year"]').fill("2026");
  await page.waitForTimeout(700);
  const workingDays = (await page.locator("#record-working-days").innerText()).trim();
  check("record working days recalculate", /^\d+(\.\d+)?$/.test(workingDays) && Number(workingDays) > 0, workingDays);

  // Employees (PortalDateInput reference + ConfirmDialog path available)
  await page.goto(`${portal}/organization/employees`, { waitUntil: "networkidle" });
  await assertNoNativeDate(page, check, "employees has no native date");
  check("employees grid pagination", (await page.getByText(/Rows per page|Redova po stranici/i).count()) >= 1);
  const newEmployee = page.getByRole("button", { name: /New|Novi|Nova/i }).first();
  if ((await newEmployee.count()) > 0) {
    await newEmployee.click();
    await page.waitForTimeout(300);
    check(
      "employee form PortalDateInput",
      (await page.locator('input[aria-label="employee-employment-start-date day"]').count()) === 1,
    );
  } else {
    check("employee form PortalDateInput", false, "new button missing");
  }

  // Departments
  await page.goto(`${portal}/organization/departments`, { waitUntil: "networkidle" });
  check("departments heading", (await page.locator("h1").first().innerText()).length > 0);
  check("departments uses shared grid chrome", (await page.locator("table").count()) >= 1);

  // Business Calendar
  await page.goto(`${portal}/business-calendar/admin/non-working-days`, { waitUntil: "networkidle" });
  await assertNoNativeDate(page, check, "business calendar has no native date");
  check(
    "business calendar PortalDateInput",
    (await page.locator('input[aria-label="non-working-date day"]').count()) === 1,
  );
  const deleteButtons = page.getByRole("button", { name: /Delete|Obriši/i });
  if ((await deleteButtons.count()) > 0) {
    await deleteButtons.first().click();
    check(
      "business calendar ConfirmDialog opens",
      (await page.getByRole("alertdialog").count()) >= 1,
    );
    await page.getByRole("button", { name: /Cancel|Otkaži|Odustani/i }).first().click();
  } else {
    check("business calendar ConfirmDialog opens", true, "no rows to delete; skipped");
  }

  // Leave Policies
  await page.goto(`${portal}/vacation/admin/policies`, { waitUntil: "networkidle" });
  await assertNoNativeDate(page, check, "policies has no native date");
  check(
    "policies PortalDateInput",
    (await page.locator('input[aria-label="policy-expiration day"]').count()) === 1,
  );

  // Leave Balances
  await page.goto(`${portal}/vacation/admin/leave-balances`, { waitUntil: "networkidle" });
  await assertNoNativeDate(page, check, "leave balances has no native date");

  // Vacation request list
  await page.goto(`${portal}/vacation/admin/requests`, { waitUntil: "networkidle" });
  check("admin request list heading", (await page.locator("h1").first().innerText()).length > 0);
  check(
    "admin request list uses shared control classes (no native date)",
    (await page.locator('input[type="date"]').count()) === 0,
  );

  // Dark + Serbian + mobile matrix on record form
  await setLocale(page, portal, "sr-Latn");
  await setAppearance(page, portal, "dark");
  await page.waitForTimeout(300);
  check(
    "dark theme applied",
    (await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      appearance: document.documentElement.dataset.appearance,
    }))).theme === "dark",
    await page.evaluate(() => `${document.documentElement.dataset.theme}/${document.documentElement.dataset.appearance}`),
  );
  await page.goto(`${portal}/vacation/admin/requests/record`, { waitUntil: "networkidle" });
  check(
    "Serbian Latin record title",
    (await page.getByRole("heading", { name: /Evidentiraj odsustvo/i }).count()) >= 1,
  );
  check(
    "dark theme survives navigation",
    (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${portal}/vacation/admin/requests/record`, { waitUntil: "networkidle" });
  await assertNoOverflow(page, check, "mobile record no document overflow");
  await page.locator('input[aria-label="record-date-from day"]').focus();
  check(
    "visible focus on date segment",
    await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.outlineStyle !== "none" || style.boxShadow !== "none" || el.matches(":focus-visible");
    }),
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await setAppearance(page, portal, "light");
  await setLocale(page, portal, "en");

  const relevantConsole = consoleErrors.filter(
    (text) => !/favicon/i.test(text) && !/401/.test(text) && !/Failed to load resource/i.test(text),
  );
  check("clean relevant browser console", relevantConsole.length === 0, relevantConsole.slice(0, 5).join(" | "));

  await browser.close();
  const failed = results.filter((item) => !item.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
