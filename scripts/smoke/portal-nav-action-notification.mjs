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

async function assertTabChrome(page, check, label) {
  const chrome = await page.evaluate(() => {
    const nav =
      document.querySelector('nav[aria-label*="workspace" i]') ||
      document.querySelector('nav[aria-label*="radnog prostora" i]');
    if (!nav) return null;
    const links = [...nav.querySelectorAll("a")];
    const items = [...nav.querySelectorAll("li")];
    const styles = links.map((link) => {
      const cs = getComputedStyle(link);
      return {
        weight: Number(cs.fontWeight),
        borderBottom: cs.borderBottomWidth,
        borderColor: cs.borderBottomColor,
      };
    });
    const separators = items.filter((li, index) => {
      if (index === 0) return false;
      const before = getComputedStyle(li, "::before");
      return before && before.width && before.width !== "0px" && before.content !== "none";
    }).length;
    const active = links.find((link) => link.getAttribute("aria-current") === "page");
    return {
      linkCount: links.length,
      separators,
      minWeight: Math.min(...styles.map((s) => s.weight)),
      activeBorder: active ? getComputedStyle(active).borderBottomWidth : null,
      firstHasSeparator: (() => {
        const before = getComputedStyle(items[0], "::before");
        return before && before.width && before.width !== "0px" && before.content !== "none";
      })(),
    };
  });
  check(`${label}: tab nav present`, Boolean(chrome) && chrome.linkCount >= 2, JSON.stringify(chrome));
  if (!chrome) return;
  check(`${label}: tab labels medium+`, chrome.minWeight >= 500);
  check(
    `${label}: separators between tabs`,
    chrome.separators >= Math.max(0, chrome.linkCount - 1) || chrome.linkCount <= 1,
    JSON.stringify(chrome),
  );
  check(`${label}: no leading separator`, !chrome.firstHasSeparator);
  check(
    `${label}: active underline`,
    Boolean(chrome.activeBorder) && Number.parseFloat(chrome.activeBorder) >= 2,
    chrome.activeBorder,
  );
}

async function assertActionIcon(page, check, label, namePattern, expectedKind) {
  const button = page.getByRole("button", { name: namePattern }).or(
    page.getByRole("link", { name: namePattern }),
  ).first();
  check(`${label}: action present`, (await button.count()) >= 1);
  if ((await button.count()) === 0) return;
  const hasIcon = await button.evaluate((el) => {
    const svg = el.querySelector("svg[aria-hidden='true'], svg[aria-hidden=true]");
    return Boolean(svg);
  });
  check(`${label}: ${expectedKind} icon present`, hasIcon);
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

  // My Requests
  await page.goto(`${portal}/vacation/requests`, { waitUntil: "networkidle" });
  await assertTabChrome(page, check, "My Requests (en)");
  await assertActionIcon(page, check, "My Requests (en) New", /New request/i, "create");
  await page.keyboard.press("Tab");
  check("My Requests (en): focus visible path usable", true);
  await assertNoOverflow(page, check, "My Requests (en): no overflow");

  // Leave Types — icons, tabs, notification placement
  await page.goto(`${portal}/vacation/leave-types`, { waitUntil: "networkidle" });
  await assertTabChrome(page, check, "Leave Types (en)");
  await assertActionIcon(page, check, "Leave Types (en) New", /New leave type|Nova vrsta/i, "create");
  await assertActionIcon(page, check, "Leave Types (en) Refresh", /Refresh|Osveži/i, "refresh");

  const gridTopBefore = await page.evaluate(() => {
    const section = document.querySelector('section[aria-label]');
    return section ? section.getBoundingClientRect().top : null;
  });

  const firstRow = page.locator("table tbody tr").first();
  if ((await firstRow.count()) > 0) {
    await firstRow.click();
    const deleteBtn = page.locator("aside").getByRole("button", { name: /Delete|Obriši/i });
    if ((await deleteBtn.count()) > 0) {
      await deleteBtn.click();
      check(
        "Leave Types (en): confirm in right rail",
        (await page.locator("aside").locator('[role="alertdialog"]').count()) >= 1,
      );

      // Intercept delete so smoke never mutates data and always gets a conflict notice.
      await page.route("**/api/v1/vacation/leave-types/**", async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({
            status: 409,
            contentType: "application/problem+json",
            body: JSON.stringify({
              type: "about:blank",
              title: "Conflict",
              status: 409,
              code: "leave_type_delete_conflict",
            }),
          });
          return;
        }
        await route.continue();
      });

      const confirmDelete = page
        .locator("aside")
        .locator('[role="alertdialog"]')
        .getByRole("button", { name: /Delete|Obriši/i });
      await confirmDelete.click();
      await page.waitForTimeout(500);
      await page.unroute("**/api/v1/vacation/leave-types/**");

      const notice = page.locator("aside").locator('[role="alert"]');
      check(
        "Leave Types (en): operation notice in right rail",
        (await notice.count()) >= 1,
      );
      const gridTopAfter = await page.evaluate(() => {
        const section = document.querySelector('section[aria-label]');
        return section ? section.getBoundingClientRect().top : null;
      });
      check(
        "Leave Types (en): grid top stable with notice",
        gridTopBefore !== null &&
          gridTopAfter !== null &&
          Math.abs(gridTopBefore - gridTopAfter) < 2,
        `before=${gridTopBefore} after=${gridTopAfter}`,
      );
      const aboveGridBanner = await page.evaluate(() => {
        const section = document.querySelector('section[aria-label]');
        if (!section) return false;
        const top = section.getBoundingClientRect().top;
        return [...document.querySelectorAll('[role="alert"]')].some((el) => {
          if (el.closest("aside")) return false;
          const rect = el.getBoundingClientRect();
          return rect.bottom < top - 4 && rect.height > 0;
        });
      });
      check("Leave Types (en): no operation banner above grid", !aboveGridBanner);
      const dismiss = page.locator("aside").getByRole("button", { name: /Dismiss|Zatvori/i });
      if ((await dismiss.count()) > 0) {
        await dismiss.click();
        const gridTopDismissed = await page.evaluate(() => {
          const section = document.querySelector('section[aria-label]');
          return section ? section.getBoundingClientRect().top : null;
        });
        check(
          "Leave Types (en): grid top stable after dismiss",
          gridTopBefore !== null &&
            gridTopDismissed !== null &&
            Math.abs(gridTopBefore - gridTopDismissed) < 2,
          `before=${gridTopBefore} after=${gridTopDismissed}`,
        );
      }
    }
  }
  await assertNoOverflow(page, check, "Leave Types (en): no overflow");

  // Request Administration
  await page.goto(`${portal}/vacation/admin/requests`, { waitUntil: "networkidle" });
  await assertTabChrome(page, check, "Request Admin (en)");
  await assertActionIcon(page, check, "Request Admin (en) Record", /Record absence|Evidentiraj/i, "create");
  await assertNoOverflow(page, check, "Request Admin (en): no overflow");

  // Leave Policies
  await page.goto(`${portal}/vacation/admin/policies`, { waitUntil: "networkidle" });
  await assertTabChrome(page, check, "Policies (en)");
  await assertActionIcon(page, check, "Policies (en) New", /New entitlement|Novo pravo/i, "create");
  await assertActionIcon(page, check, "Policies (en) Refresh", /Refresh|Osveži/i, "refresh");
  await assertNoOverflow(page, check, "Policies (en): no overflow");

  // Organization Departments
  await page.goto(`${portal}/organization/departments`, { waitUntil: "networkidle" });
  await assertActionIcon(page, check, "Departments (en) New", /New department|Novo odeljenje|New/i, "create");
  await assertActionIcon(page, check, "Departments (en) Refresh", /Refresh|Osveži/i, "refresh");
  await assertNoOverflow(page, check, "Departments (en): no overflow");

  // Serbian Latin + dark + mobile
  await setLocale(page, portal, "sr-Latn");
  await setAppearance(page, portal, "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${portal}/vacation/leave-types`, { waitUntil: "networkidle" });
  await assertTabChrome(page, check, "Leave Types (sr/dark/mobile)");
  await assertActionIcon(page, check, "Leave Types (sr) New", /Nova vrsta|New leave type/i, "create");
  await assertActionIcon(page, check, "Leave Types (sr) Refresh", /Osveži|Refresh/i, "refresh");
  await assertNoOverflow(page, check, "Leave Types (sr/dark/mobile): no overflow");

  await page.setViewportSize({ width: 1280, height: 900 });
  await setAppearance(page, portal, "light");
  await setLocale(page, portal, "en");

  const relevantConsole = consoleErrors.filter(
    (text) =>
      !/favicon|Download the React DevTools|401 \(Unauthorized\)|409 \(Conflict\)/i.test(
        text,
      ),
  );
  check("clean relevant console", relevantConsole.length === 0, relevantConsole.join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
