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

async function fillPortalDate(page, id, day, month, year) {
  await page.locator(`input[aria-label="${id} day"]`).fill(day);
  await page.locator(`input[aria-label="${id} month"]`).fill(month);
  await page.locator(`input[aria-label="${id} year"]`).fill(year);
}

async function setLocale(page, portal, value) {
  await page.goto(`${portal}/settings`, { waitUntil: "networkidle" });
  if (value === "en") {
    await page.getByRole("radio", { name: "English" }).click();
  } else {
    await page.getByRole("radio", { name: /Serbian|Srpski/ }).click();
  }
  await page.waitForTimeout(250);
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
  await page.waitForTimeout(250);
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const env = loadEnv(path.join(root, ".env"));
  const portal = `http://localhost:${env.DEV_PORTAL_PORT || "3100"}`;
  const password = env.ADMIN_INITIAL_PASSWORD;
  if (!password) throw new Error("ADMIN_INITIAL_PASSWORD missing");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
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

  // Reference surface already on PortalDateInput.
  await setLocale(page, portal, "en");
  await setAppearance(page, portal, "light");
  await page.goto(`${portal}/vacation/admin/policies`, { waitUntil: "networkidle" });
  check(
    "policies page has no native date input",
    (await page.locator('input[type="date"]').count()) === 0,
  );
  check(
    "policies page exposes PortalDateInput segments",
    (await page.locator('input[aria-label="policy-expiration day"]').count()) === 1,
  );
  await fillPortalDate(page, "policy-expiration", "15", "03", "2026");
  check(
    "policies PortalDateInput accepts day→month→year keyboard entry",
    (await page.locator('input[aria-label="policy-expiration day"]').inputValue()) === "15" &&
      (await page.locator('input[aria-label="policy-expiration month"]').inputValue()) === "03" &&
      (await page.locator('input[aria-label="policy-expiration year"]').inputValue()) === "2026",
  );
  await page.getByRole("button", { name: /Open calendar|Otvori kalendar/i }).first().click();
  check(
    "policies calendar dialog opens",
    (await page.getByRole("dialog").count()) >= 1,
  );
  await page.keyboard.press("Escape");

  // Administrative absence record form.
  await page.goto(`${portal}/vacation/admin/requests/record`, {
    waitUntil: "networkidle",
  });
  check(
    "record form has no native date input",
    (await page.locator('input[type="date"]').count()) === 0,
  );
  check(
    "record form uses two PortalDateInput controls",
    (await page.locator('input[aria-label="record-date-from day"]').count()) === 1 &&
      (await page.locator('input[aria-label="record-date-to day"]').count()) === 1,
  );

  const employeeSelect = page.locator("#record-employee");
  const leaveTypeSelect = page.locator("#record-leave-type");
  const employeeOptions = await employeeSelect.locator("option").allTextContents();
  const leaveTypeOptions = await leaveTypeSelect.locator("option").allTextContents();
  check("record form loaded employees", employeeOptions.length > 1, String(employeeOptions.length));
  check("record form loaded leave types", leaveTypeOptions.length > 1, String(leaveTypeOptions.length));

  if (employeeOptions.length > 1) {
    await employeeSelect.selectOption({ index: 1 });
  }
  if (leaveTypeOptions.length > 1) {
    await leaveTypeSelect.selectOption({ index: 1 });
  }

  // Pick a weekday range likely to yield working days (Mon–Wed of a fixed week).
  await fillPortalDate(page, "record-date-from", "06", "07", "2026");
  await fillPortalDate(page, "record-date-to", "08", "07", "2026");
  await page.waitForTimeout(800);
  const workingDaysText = (await page.locator("#record-working-days").innerText()).trim();
  check(
    "working days recalculate after PortalDateInput range",
    /^\d+(\.\d+)?$/.test(workingDaysText) && Number(workingDaysText) > 0,
    workingDaysText,
  );

  await page.getByRole("button", { name: /Open calendar|Otvori kalendar/i }).first().click();
  const dialog = page.getByRole("dialog").first();
  check("record calendar opens", (await dialog.count()) === 1);
  const dayButton = dialog.locator("button").filter({ hasText: /^10$/ }).first();
  if ((await dayButton.count()) === 1) {
    await dayButton.click();
    check(
      "record calendar selection updates ISO-backed day segment",
      (await page.locator('input[aria-label="record-date-from day"]').inputValue()) === "10",
    );
  } else {
    check("record calendar selection updates ISO-backed day segment", false, "day 10 not visible");
  }

  // Serbian Latin labels.
  await setLocale(page, portal, "sr-Latn");
  await page.goto(`${portal}/vacation/admin/requests/record`, {
    waitUntil: "networkidle",
  });
  check(
    "Serbian Latin record title",
    (await page.getByRole("heading", { name: /Evidentiraj odsustvo/i }).count()) >= 1,
  );
  check(
    "Serbian Latin date hint present",
    (await page.getByText(/dd\.MM\.yyyy/i).count()) >= 1,
  );

  // Dark mode + English.
  await setLocale(page, portal, "en");
  await setAppearance(page, portal, "dark");
  await page.goto(`${portal}/vacation/admin/requests/record`, {
    waitUntil: "networkidle",
  });
  const darkTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  check("dark appearance applied", darkTheme === "dark", darkTheme || "");
  check(
    "record form still has PortalDateInput in dark mode",
    (await page.locator('input[aria-label="record-date-from day"]').count()) === 1,
  );

  // Mobile viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${portal}/vacation/admin/requests/record`, {
    waitUntil: "networkidle",
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  check("mobile record form has no document horizontal overflow", !overflow);
  await page.locator('input[aria-label="record-date-from day"]').focus();
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    const style = getComputedStyle(el);
    return Boolean(style.outlineStyle !== "none" || style.boxShadow !== "none" || el.matches(":focus-visible"));
  });
  check("keyboard focus visible on date segment", focused);

  // Leave balances mechanical migration check.
  await page.setViewportSize({ width: 1280, height: 900 });
  await setAppearance(page, portal, "light");
  await page.goto(`${portal}/vacation/admin/leave-balances`, {
    waitUntil: "networkidle",
  });
  // Effective date PortalDateInput appears after load; assert no native date anywhere.
  check(
    "leave balances has no native date input",
    (await page.locator('input[type="date"]').count()) === 0,
  );

  const relevantConsole = consoleErrors.filter(
    (text) =>
      !/favicon/i.test(text) &&
      !/401/.test(text) &&
      !/Failed to load resource/i.test(text),
  );
  check(
    "clean relevant browser console",
    relevantConsole.length === 0,
    relevantConsole.slice(0, 5).join(" | "),
  );

  await browser.close();
  const failed = results.filter((item) => !item.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
