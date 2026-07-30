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
      : ["Light", "Svetli", "Svetlo"];
  for (const label of labels) {
    const radio = page.getByRole("radio", { name: label });
    if ((await radio.count()) > 0) {
      await radio.click();
      break;
    }
  }
  await page.waitForTimeout(200);
}

async function assertNoOverflow(page, check, name) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  check(name, !overflow);
}

/**
 * Canonical hierarchy (§2.5):
 * h1 module title → tab nav → h2 active section → optional section action → filters/content.
 */
async function assertTabbedHierarchy(page, check, {
  label,
  moduleTitle,
  sectionTitle,
  actionName,
  activeTabName,
}) {
  const h1 = page.getByRole("heading", { level: 1, name: moduleTitle });
  check(`${label}: module h1`, (await h1.count()) === 1);

  const tabs = page.getByRole("navigation", {
    name: /Vacation workspace|Navigacija radnog prostora|page navigation|Navigacija stranice/i,
  });
  check(`${label}: tab navigation present`, (await tabs.count()) >= 1);

  const section = page.getByRole("heading", { level: 2, name: sectionTitle });
  check(`${label}: section h2 below tabs`, (await section.count()) >= 1);

  const order = await page.evaluate(() => {
    const h1El = document.querySelector("h1");
    const nav =
      document.querySelector('nav[aria-label*="workspace" i]') ||
      document.querySelector('nav[aria-label*="radnog prostora" i]');
    const h2El = document.querySelector("main h2");
    if (!h1El || !nav || !h2El) return null;
    const pos = (el) => el.getBoundingClientRect().top;
    return { h1: pos(h1El), nav: pos(nav), h2: pos(h2El) };
  });
  check(
    `${label}: vertical order h1 → tabs → h2`,
    Boolean(order) && order.h1 < order.nav && order.nav < order.h2,
    order ? JSON.stringify(order) : "missing elements",
  );

  if (activeTabName) {
    const active = page
      .locator('nav[aria-label*="workspace" i], nav[aria-label*="radnog prostora" i]')
      .getByRole("link", { name: activeTabName });
    check(`${label}: active tab link`, (await active.count()) >= 1);
  }

  if (actionName) {
    const action = page.getByRole("link", { name: actionName }).or(
      page.getByRole("button", { name: actionName }),
    );
    check(`${label}: section action present`, (await action.count()) >= 1);

    const ownership = await page.evaluate((name) => {
      const h1El = document.querySelector("header h1, h1");
      const h2El = document.querySelector("main h2");
      const candidates = [
        ...document.querySelectorAll("a, button"),
      ].filter((el) => (el.textContent || "").trim() === name);
      if (!h1El || !h2El || candidates.length === 0) {
        return { ok: false, reason: "missing" };
      }
      const actionEl = candidates[0];
      const h1Bottom = h1El.getBoundingClientRect().bottom;
      const h2Top = h2El.getBoundingClientRect().top;
      const actionTop = actionEl.getBoundingClientRect().top;
      // Action must sit at/below the section header, never in the module header band.
      const inModuleHeader = actionTop < h1Bottom + 8;
      const nearSection = actionTop >= h2Top - 48;
      return { ok: !inModuleHeader && nearSection, inModuleHeader, nearSection, actionTop, h1Bottom, h2Top };
    }, actionName);
    check(
      `${label}: action belongs to section header`,
      ownership.ok,
      JSON.stringify(ownership),
    );
  }
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

  // English / light / desktop
  await setLocale(page, portal, "en");
  await setAppearance(page, portal, "light");

  await page.goto(`${portal}/vacation/requests`, { waitUntil: "networkidle" });
  await assertTabbedHierarchy(page, check, {
    label: "My Requests (en)",
    moduleTitle: "Vacation",
    sectionTitle: "My requests",
    actionName: "New request",
    activeTabName: "Requests",
  });
  await assertNoOverflow(page, check, "My Requests (en): no overflow");

  await page.goto(`${portal}/vacation/leave-types`, { waitUntil: "networkidle" });
  await assertTabbedHierarchy(page, check, {
    label: "Leave Types (en)",
    moduleTitle: "Vacation",
    sectionTitle: "Leave types",
    actionName: "New leave type",
    activeTabName: "Leave types",
  });
  check(
    "Leave Types (en): Refresh in section",
    (await page.getByRole("button", { name: /Refresh|Refreshing/i }).count()) >= 1,
  );
  await assertNoOverflow(page, check, "Leave Types (en): no overflow");

  await page.goto(`${portal}/vacation/admin/requests`, { waitUntil: "networkidle" });
  await assertTabbedHierarchy(page, check, {
    label: "Request Admin (en)",
    moduleTitle: "Vacation",
    sectionTitle: "Vacation request administration",
    actionName: "Record absence",
    activeTabName: "Request administration",
  });
  // Filters sit below the section header.
  const filterOrder = await page.evaluate(() => {
    const h2 = document.querySelector("main h2");
    const form = document.querySelector("main form");
    if (!h2 || !form) return null;
    return {
      h2: h2.getBoundingClientRect().top,
      form: form.getBoundingClientRect().top,
    };
  });
  check(
    "Request Admin (en): filters below section header",
    Boolean(filterOrder) && filterOrder.h2 < filterOrder.form,
    filterOrder ? JSON.stringify(filterOrder) : "missing",
  );
  await assertNoOverflow(page, check, "Request Admin (en): no overflow");

  await page.goto(`${portal}/vacation/admin/leave-balances`, {
    waitUntil: "networkidle",
  });
  await assertTabbedHierarchy(page, check, {
    label: "Leave Balances (en)",
    moduleTitle: "Vacation",
    sectionTitle: "Leave Balance administration",
    activeTabName: "Leave balances",
  });
  await assertNoOverflow(page, check, "Leave Balances (en): no overflow");

  await page.goto(`${portal}/vacation/admin/policies`, { waitUntil: "networkidle" });
  await assertTabbedHierarchy(page, check, {
    label: "Leave Policies (en)",
    moduleTitle: "Vacation",
    sectionTitle: "Annual leave entitlement",
    actionName: "New entitlement",
    activeTabName: "Annual leave entitlements",
  });
  await assertNoOverflow(page, check, "Leave Policies (en): no overflow");

  // Serbian Latin + dark
  await setLocale(page, portal, "sr-Latn");
  await setAppearance(page, portal, "dark");
  check(
    "dark theme applied",
    (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark",
  );

  await page.goto(`${portal}/vacation/requests`, { waitUntil: "networkidle" });
  await assertTabbedHierarchy(page, check, {
    label: "My Requests (sr)",
    moduleTitle: "Odmori",
    sectionTitle: "Moji zahtevi",
    actionName: "Novi zahtev",
    activeTabName: "Zahtevi",
  });

  await page.goto(`${portal}/vacation/leave-types`, { waitUntil: "networkidle" });
  await assertTabbedHierarchy(page, check, {
    label: "Leave Types (sr)",
    moduleTitle: "Odmori",
    sectionTitle: "Vrste odsustava",
    actionName: "Nova vrsta",
    activeTabName: "Vrste odsustava",
  });
  check(
    "Leave Types (sr): Osveži in section",
    (await page.getByRole("button", { name: /Osveži|Osvežavanje/i }).count()) >= 1,
  );

  await page.goto(`${portal}/vacation/admin/requests`, { waitUntil: "networkidle" });
  await assertTabbedHierarchy(page, check, {
    label: "Request Admin (sr)",
    moduleTitle: "Odmori",
    sectionTitle: "Administracija zahteva za odsustvo",
    actionName: "Evidentiraj odsustvo",
  });

  await page.goto(`${portal}/vacation/admin/leave-balances`, {
    waitUntil: "networkidle",
  });
  await assertTabbedHierarchy(page, check, {
    label: "Leave Balances (sr)",
    moduleTitle: "Odmori",
    sectionTitle: "Administracija stanja odsustva",
  });

  await page.goto(`${portal}/vacation/admin/policies`, { waitUntil: "networkidle" });
  await assertTabbedHierarchy(page, check, {
    label: "Leave Policies (sr)",
    moduleTitle: "Odmori",
    sectionTitle: "Godišnje pravo na odmor",
    actionName: "Novo pravo",
  });

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${portal}/vacation/leave-types`, { waitUntil: "networkidle" });
  await assertTabbedHierarchy(page, check, {
    label: "Leave Types (mobile)",
    moduleTitle: "Odmori",
    sectionTitle: "Vrste odsustava",
    actionName: "Nova vrsta",
  });
  await assertNoOverflow(page, check, "Leave Types (mobile): no overflow");

  const stacking = await page.evaluate(() => {
    const h2 = document.querySelector("main h2");
    const action = [...document.querySelectorAll("main a, main button")].find(
      (el) => (el.textContent || "").includes("Nova vrsta"),
    );
    if (!h2 || !action) return null;
    return {
      h2Bottom: h2.getBoundingClientRect().bottom,
      actionTop: action.getBoundingClientRect().top,
    };
  });
  check(
    "Leave Types (mobile): actions wrap below title",
    Boolean(stacking) && stacking.actionTop >= stacking.h2Bottom - 4,
    stacking ? JSON.stringify(stacking) : "missing",
  );

  // Visible keyboard focus on a section action
  await page.getByRole("button", { name: "Nova vrsta" }).focus();
  const focusVisible = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    const style = getComputedStyle(el);
    return (
      style.outlineWidth !== "0px" ||
      style.boxShadow !== "none" ||
      el.className.includes("focus")
    );
  });
  check("visible keyboard focus on section action", focusVisible);

  const relevantConsole = consoleErrors.filter(
    (text) =>
      !/Download the React DevTools/i.test(text) &&
      !/\[Fast Refresh\]/i.test(text) &&
      !/favicon/i.test(text) &&
      !/401/.test(text) &&
      !/Failed to load resource/i.test(text),
  );
  check(
    "clean relevant console",
    relevantConsole.length === 0,
    relevantConsole.slice(0, 5).join(" | "),
  );

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
    for (const f of failed) console.error(`FAILED: ${f.name} ${f.detail}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
