/**
 * The guided tour, as an end-to-end test.
 *
 *   pnpm showcase                                   # production, records media
 *   BASE_URL=http://localhost:3000 pnpm showcase    # a local `pnpm build` first
 *   pnpm showcase:test                              # journeys only: no pauses, no video
 *
 * Each journey checks what it shows (the recovered 2023 numbers, the live
 * correlation, the bootstrap interval, Moran's I at both thresholds, the
 * mocked answer passing the site's own validator and citation check, the
 * audit-log record and the same rows in the open records), so a broken
 * feature fails the tour instead of producing a misleading video. Inputs are
 * fixed: the statistics use the site's own seed 57 (2,000 bootstrap resamples,
 * 999 permutations), and the AI step always asks the same example question.
 *
 * No real API key is used: the AI steps type a placeholder, and every request
 * to a provider is answered in the browser by e2e/mock-ai.ts.
 */
import path from "node:path";

import { type Browser, type BrowserContext, type Locator, type Page, expect, test } from "@playwright/test";

import {
  MOCK_LABEL,
  MOCK_PREFIX,
  SCREENSHOTS,
  TOUR_QUESTION,
  WALKTHROUGHS,
  type WalkthroughId,
} from "../src/lib/showcase";
import { MOCK_SQL, PLACEHOLDER_KEY, mockAiProviders } from "./mock-ai";
import { FAST, SHOT_DIR, Tour, ensureDirs, finishRecording, recordingContext } from "./showcase-helpers";

const walkthrough = (id: WalkthroughId) => WALKTHROUGHS.find((w) => w.id === id)!;

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

/** Wait for a MapLibre map inside `region` to draw, plus a moment for basemap tiles. */
async function mapReady(page: Page, region: Locator) {
  await expect(region.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(FAST ? 200 : 1200);
}

/**
 * Viewport screenshot to .showcase/screens/<id>.png, optionally with `align`
 * scrolled to `offset` px from the top (applied twice, after layout settles).
 */
async function shot(page: Page, id: string, align?: { target: Locator; offset: number }) {
  if (!SCREENSHOTS.some((s) => s.id === id)) throw new Error(`Unknown screenshot ${id}`);
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  for (let i = 0; i < 2; i++) {
    if (align) {
      await align.target.evaluate((el, offset) => {
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "instant" });
      }, align.offset);
    }
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: path.join(SHOT_DIR, `${id}.png`) });
}

/** A visible "mocked" label pinned to the page, for screenshots of mocked AI output. */
async function pinMockLabel(page: Page) {
  await page.evaluate((label) => {
    const el = document.createElement("div");
    el.textContent = label;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;right:24px;bottom:24px;z-index:2147483647;padding:8px 14px;border-radius:12px;" +
      "background:#fff3d6;color:#5a3b00;border:2px dashed #b07a00;font:700 15px/1.2 ui-sans-serif,system-ui,sans-serif;" +
      "text-transform:uppercase;letter-spacing:.04em;box-shadow:0 8px 24px rgba(0,0,0,.18)";
    document.body.appendChild(el);
  }, MOCK_LABEL);
}

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const heading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true });
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });
const threshold = (page: Page, n: number) =>
  page.getByRole("button", { name: `At least ${n} tweet${n === 1 ? "" : "s"}`, exact: true });

// ------------------------------------------------------------------ landing

const STORY_STEPS = [
  "Harvest",
  "Score and store",
  "Summarise with MapReduce",
  "Serve and compare",
  "Automate",
];

const storyCard = (page: Page, i: number) => page.locator(`li[data-step="${i}"]`);

async function expectStoryStep(page: Page, i: number) {
  await expect(page.getByText(`Step ${i + 1} of 5: ${STORY_STEPS[i]}`, { exact: true })).toBeVisible();
}

// ------------------------------------------------------------------ income

const income = {
  map: (page: Page) =>
    page.getByRole("region", { name: "Map of Victorian SA2 regions coloured by the selected measure" }),
  scatter: (page: Page) => page.getByRole("group", { name: /^Scatter plot of \d+ SA2s/ }),
  dot: (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}: `) }),
  detail: (page: Page) => page.locator("section[aria-live='polite']"),
  readout: (page: Page) => page.getByText("Pearson r", { exact: true }).locator("xpath=ancestor::dl[1]"),
};

// ------------------------------------------------------------------ spatial

const spatial = {
  map: (page: Page) => page.getByRole("region", { name: "LISA cluster map of Victorian SA2s" }),
  readout: (page: Page) =>
    page.getByText("Global Moran's I", { exact: true }).locator("xpath=ancestor::div[@aria-live][1]"),
  legend: (page: Page) => page.getByRole("list", { name: "Map legend" }),
};

// ------------------------------------------------------------- ask the data

async function addPlaceholderKey(page: Page, type: (target: Locator, text: string) => Promise<void>) {
  const dialog = page.getByRole("dialog", { name: "AI settings" });
  await expect(dialog).toBeVisible();
  await type(dialog.getByRole("textbox", { name: "Anthropic API key" }), PLACEHOLDER_KEY);
  return dialog;
}

const askSteps = (page: Page) => page.locator("ol[aria-live='polite']");
const askStep = (page: Page, title: string) =>
  askSteps(page)
    .locator(":scope > li")
    .filter({ has: page.getByText(title, { exact: true }) });

async function expectMockedAnswer(page: Page) {
  const sql = askStep(page, "Your model writes one SQL query");
  await expect(sql.getByText("AI-generated")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#ask-sql")).toHaveValue(MOCK_SQL);
  const run = askStep(page, "This site's server checks the SQL and runs it read-only");
  await expect(run.getByText(/^Allowed and run · 5 rows/)).toBeVisible({ timeout: 30_000 });
  const explain = askStep(page, "Your model explains the rows, citing them");
  await expect(explain).toContainText(MOCK_PREFIX, { timeout: 30_000 });
  await expect(explain).toContainText("Melbourne had by far the most crime-related tweets, 4,026");
  // The site's own citation check passes on the mocked answer.
  await expect(explain.getByText(/^Cites returned rows r1, r2, r3\./)).toBeVisible();
  const results = page.getByRole("region", { name: "Query results" });
  await expect(results.getByRole("cell", { name: "Ballarat Central", exact: true })).toBeVisible();
  return { sql, run, explain, results };
}

test.beforeAll(() => ensureDirs());

test.describe("journeys (recorded)", () => {
  test("1. the story: landing page and the animated 2023 architecture", async ({ browser }) => {
    const context = await recordingContext(browser);
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("the-story"));

    await page.goto("/");
    await expect(h1(page)).toHaveText("Does the mood online match life on the ground?");
    await settle(page);
    tour.markStart();

    await tour.caption(1);
    await tour.pause(1000);
    await tour.hover(h1(page), 900);
    await tour.pause(1400);
    await tour.hover(page.getByText(/^37,823,414 tweets$/), 700);
    await tour.pause(1600);

    await tour.caption(2);
    const dots = page.getByRole("img", { name: /^Dot map of [\d,]+ Victorian suburbs/ });
    await tour.hover(dots, 800);
    await tour.pause(900);
    const box = (await dots.boundingBox())!;
    // Melbourne, then out to the regional cities.
    await tour.glide(box.x + box.width * 0.55, box.y + box.height * 0.66, 900);
    await tour.pause(1100);
    await tour.glide(box.x + box.width * 0.3, box.y + box.height * 0.55, 900);
    await tour.pause(1100);
    await tour.hover(page.getByText(/Victorian suburbs · [\d,]+ geotagged tweets/), 800);
    await tour.pause(1500);

    await tour.caption(3);
    await tour.scrollTo(heading(page, "Build a cloud that tells stories about life in Australia"), {
      offset: 110,
      ms: 1200,
    });
    await tour.pause(900);
    await tour.hover(page.getByText("tweets matched to a suburb", { exact: true }), 800);
    await tour.pause(1300);
    await tour.hover(page.getByText("the whole cloud budget", { exact: true }), 700);
    await tour.pause(1500);

    await tour.caption(4);
    await tour.scrollTo(heading(page, "From a 57 GB file to a dashboard, in five moves"), {
      offset: 90,
      ms: 1200,
    });
    await tour.pause(2200);

    // Five scroll-driven steps: each card scrolled to mid-screen activates its part of the diagram.
    for (let i = 0; i < 5; i++) {
      await tour.caption(5 + i);
      await tour.scrollTo(storyCard(page, i), { offset: 300, ms: 1300 });
      await expectStoryStep(page, i);
      await tour.pause(800);
      await tour.hover(storyCard(page, i).locator("p").last(), 700, { scroll: false });
      await tour.pause(2200);
    }

    await tour.caption(10);
    await tour.scrollTo(heading(page, "Four findings, recomputed"), { offset: 80, ms: 1300 });
    await tour.pause(800);
    await tour.hover(heading(page, "Richer areas do not tweet happier about money"), 800);
    await tour.pause(1600);
    await tour.hover(heading(page, "Crime talk is dark everywhere, not darker where crime is high"), 800);
    await tour.pause(1600);

    await tour.caption(11);
    await tour.scrollTo(heading(page, "How sure, and who checks the AI?"), { offset: 90, ms: 1300 });
    await tour.pause(800);
    await tour.hover(page.getByText("Spatial statistics, with intervals", { exact: true }), 800);
    await tour.pause(1500);
    await tour.hover(page.getByText("Ask the data, with your own key", { exact: true }), 700);
    await tour.pause(2200);

    await finishRecording(context, page, tour);
  });

  test("2. income vs sentiment: choropleth, linked scatter, Moran's I and LISA", async ({ browser }) => {
    test.setTimeout(8 * 60_000);
    const context = await recordingContext(browser);
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("income-vs-sentiment"));

    await page.goto("/income");
    await expect(h1(page)).toHaveText("Do people in richer areas tweet more happily about money?");
    await settle(page);
    tour.markStart();

    await tour.caption(1);
    await tour.pause(1000);
    await tour.hover(h1(page), 900);
    await tour.pause(1200);
    await tour.hover(page.getByText("Income vs sentiment (Pearson r)", { exact: true }), 800);
    await tour.pause(1600);

    await tour.caption(2);
    const controls = page.getByRole("group", { name: "Map metric" });
    await tour.scrollTo(controls, { offset: 108, ms: 1300 });
    await tour.idleWhile(() => mapReady(page, income.map(page)));
    const map = (await income.map(page).boundingBox())!;
    // Across Melbourne and out to the west: the tooltip follows the pointer.
    await tour.glide(map.x + map.width * 0.6, map.y + map.height * 0.68, 1000);
    await tour.pause(1300);
    await tour.glide(map.x + map.width * 0.33, map.y + map.height * 0.6, 1000);
    await tour.pause(1500);

    await tour.caption(3);
    const scatter = income.scatter(page);
    await expect(scatter).toHaveAccessibleName(/Pearson r 0\.14\./);
    await tour.hover(income.dot(page, "Geelong"), 900, { scroll: false });
    await tour.pause(1300);
    await tour.hover(income.dot(page, "Castlemaine"), 700, { scroll: false });
    await tour.pause(1300);

    await tour.caption(4);
    const mood = controls.getByRole("button", { name: "Income-tweet mood" });
    await tour.click(mood, { scroll: false });
    await expect(mood).toHaveAttribute("aria-pressed", "true");
    await tour.pause(700);
    await tour.glide(map.x + map.width * 0.6, map.y + map.height * 0.66, 900);
    await tour.pause(1500);
    await tour.glide(map.x + map.width * 0.42, map.y + map.height * 0.56, 900);
    await tour.pause(1500);

    await tour.caption(5);
    await tour.click(income.dot(page, "Ballarat"), { scroll: false, after: 1400 });
    await expect(income.detail(page).getByRole("heading", { name: "Ballarat", exact: true })).toBeVisible();
    await expect(income.detail(page)).toContainText("95% CI");
    await tour.scrollTo(income.detail(page), { offset: 330, ms: 1200 });
    await tour.pause(700);
    await tour.hover(income.detail(page).getByText("95% CI").first(), 800);
    await tour.pause(2200);
    await tour.scrollTo(controls, { offset: 108, ms: 1100 });

    await tour.caption(6);
    await tour.click(threshold(page, 10), { scroll: false, after: 600 });
    await expect(scatter).toHaveAccessibleName(/^Scatter plot of \d+ SA2s/);
    await tour.hover(income.readout(page), 700, { scroll: false });
    await tour.pause(1600);
    await tour.click(threshold(page, 30), { scroll: false, after: 600 });
    await tour.hover(income.readout(page), 700, { scroll: false });
    await tour.pause(1600);
    await tour.click(threshold(page, 1), { scroll: false, after: 500 });
    await expect(scatter).toHaveAccessibleName(/Pearson r 0\.14\./);
    await tour.pause(900);

    await tour.caption(7);
    const uncertainty = page.locator("#uncertainty");
    await tour.scrollTo(heading(page, "Income tweets, 2023 threshold"), { offset: 150, ms: 1400 });
    const first = uncertainty.locator("div.rounded-lg").filter({ hasText: "Income tweets, 2023 threshold" });
    await expect(first).toContainText("95% CI -0.06 to 0.26");
    await tour.hover(first.getByText("95% CI -0.06 to 0.26"), 800);
    await tour.pause(1800);
    await tour.hover(
      uncertainty.getByText(/^The interval for Spearman's rho runs from -0\.06 to 0\.26/),
      800,
    );
    await tour.pause(2200);

    await tour.caption(8);
    await tour.scrollToY(0, 900);
    await tour.click(nav(page).getByRole("link", { name: "Spatial stats" }), { scroll: false });
    await expect(page).toHaveURL(/\/spatial$/);
    await expect(h1(page)).toHaveText("Is the mood clustered in space, or is it noise?");
    await settle(page);
    await tour.pause(800);
    await tour.hover(h1(page), 900);
    await tour.pause(1600);

    await tour.caption(9);
    const readout = spatial.readout(page);
    await tour.scrollTo(page.getByRole("group", { name: "Area unit" }), { offset: 100, ms: 1300 });
    await expect(readout).toContainText("I = 0.022");
    await expect(readout).toContainText("permutation p = 0.24");
    await expect(readout.getByText("152", { exact: true })).toBeVisible();
    await tour.hover(readout.getByText("I = 0.022"), 800, { scroll: false });
    await tour.pause(1600);
    await tour.hover(readout.getByText(/^permutation p = 0\.24/), 700, { scroll: false });
    await tour.pause(1800);

    await tour.caption(10);
    await tour.scrollTo(spatial.map(page), { offset: 60, ms: 1200 });
    await tour.idleWhile(() => mapReady(page, spatial.map(page)));
    await tour.hover(spatial.legend(page).getByRole("listitem").first(), 800, { scroll: false });
    await tour.pause(1400);
    const lisa = (await spatial.map(page).boundingBox())!;
    await tour.glide(lisa.x + lisa.width * 0.6, lisa.y + lisa.height * 0.66, 900);
    await tour.pause(1600);

    await tour.caption(11);
    await tour.scrollTo(page.getByRole("group", { name: "Area unit" }), { offset: 100, ms: 1100 });
    await tour.click(threshold(page, 1), { scroll: false, after: 600 });
    await expect(readout).toContainText("I = 0.135");
    await expect(readout).toContainText("permutation p = 0.001");
    await tour.hover(readout.getByText("I = 0.135"), 700, { scroll: false });
    await tour.pause(2200);

    await tour.caption(12);
    await tour.click(threshold(page, 30), { scroll: false, after: 600 });
    await expect(readout).toContainText("I = 0.022");
    await tour.scrollTo(spatial.map(page), { offset: 60, ms: 1100 });
    await tour.click(
      page.getByRole("group", { name: "Map extent" }).getByRole("button", { name: "Melbourne" }),
      {
        scroll: false,
      },
    );
    await tour.pause(1800);
    const melb = (await spatial.map(page).boundingBox())!;
    await tour.glide(melb.x + melb.width * 0.5, melb.y + melb.height * 0.45, 900);
    await tour.pause(1800);

    await tour.caption(13);
    await tour.scrollTo(heading(page, "What these statistics can and cannot say"), { offset: 90, ms: 1400 });
    await tour.pause(800);
    await tour.hover(page.getByText("Ecological fallacy", { exact: true }).first(), 800);
    await tour.pause(1800);
    await tour.hover(page.getByText("Modifiable areal unit problem (MAUP)", { exact: true }).first(), 800);
    await tour.pause(1800);
    await tour.hover(page.getByText("Small areas", { exact: true }), 800);
    await tour.pause(2400);

    await finishRecording(context, page, tour);
  });

  test("3. ask the data: BYOK dialog, mocked AI response, validator, audit log, records", async ({
    browser,
  }) => {
    test.setTimeout(8 * 60_000);
    const context = await recordingContext(browser);
    const ai = await mockAiProviders(context, { latencyMs: FAST ? 150 : 1300 });
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("ask-the-data"));

    await page.goto("/ask");
    await expect(h1(page)).toHaveText("Ask the data in plain English");
    await settle(page);
    tour.markStart();

    await tour.caption(1);
    await tour.pause(1000);
    await tour.hover(h1(page), 900);
    await tour.pause(1200);
    await tour.hover(page.getByText("2. The server checks and runs it", { exact: true }), 800);
    await tour.pause(1600);

    await tour.caption(2);
    await tour.click(page.getByRole("button", { name: "Add your key", exact: true }));
    const dialog = page.getByRole("dialog", { name: "AI settings" });
    await expect(dialog).toBeVisible();
    await tour.pause(800);
    await tour.hover(dialog.getByText(/^The AI features use your own API key/), 800, { scroll: false });
    await tour.pause(2000);
    await tour.hover(dialog.getByRole("radio", { name: /^Claude Haiku 4\.5/ }), 700, { scroll: false });
    await tour.pause(1200);
    await tour.hover(dialog.getByText("Remember on this device"), 700, { scroll: false });
    await tour.pause(1400);

    await tour.caption(3);
    await addPlaceholderKey(page, (t, s) => tour.type(t, s));
    await tour.pause(900);
    await tour.click(dialog.getByRole("button", { name: "Save" }), { scroll: false });
    await expect(dialog).toBeHidden();
    await tour.pause(600);

    await tour.caption(4);
    await tour.click(page.getByRole("button", { name: TOUR_QUESTION }));
    await expect(page.getByRole("textbox", { name: "Your question" })).toHaveValue(TOUR_QUESTION);
    await tour.pause(700);
    await tour.click(page.getByRole("button", { name: "Ask", exact: true }), { after: 200 });

    await tour.caption(5);
    const sqlStep = askStep(page, "Your model writes one SQL query");
    await tour.idleWhile(() => expect(sqlStep.getByText("AI-generated")).toBeVisible({ timeout: 30_000 }));
    const { run, explain, results } = await tour.idleWhile(() => expectMockedAnswer(page));
    await tour.scrollTo(sqlStep, { offset: 84, ms: 1100 });
    await tour.hover(sqlStep.getByText("AI-generated"), 700);
    await tour.pause(1400);
    await tour.hover(page.locator("#ask-sql"), 800);
    await tour.pause(2000);

    await tour.caption(6);
    await tour.hover(run.getByText(/^Allowed and run · 5 rows/), 800);
    await tour.pause(1400);
    await tour.hover(
      run.getByText(
        /^One SELECT on twitter_sal_sentiment, regions_sal|^One SELECT on regions_sal, twitter_sal_sentiment/,
      ),
      700,
    );
    await tour.pause(1800);

    await tour.caption(7);
    await tour.scrollTo(explain, { offset: 120, ms: 1000 });
    await tour.hover(explain.getByText(MOCK_PREFIX, { exact: false }).first(), 800);
    await tour.pause(1600);
    await tour.hover(explain.getByRole("button", { name: "Show row 1" }), 700);
    await tour.pause(900);
    await tour.hover(explain.getByText(/^Cites returned rows r1, r2, r3\./), 700);
    await tour.pause(1800);

    await tour.caption(8);
    await tour.scrollTo(results, { offset: 100, ms: 1100 });
    await tour.hover(results.getByRole("cell", { name: "Melbourne", exact: true }), 800);
    await tour.pause(1400);
    await tour.hover(results.getByText("Automatic chart", { exact: true }), 800);
    await tour.pause(2000);

    await tour.caption(9);
    const accept = page.getByRole("button", { name: "Accept" });
    await tour.click(accept);
    await expect(accept).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/\(this browser only\): accepted/)).toBeVisible();
    await tour.pause(1800);

    await tour.caption(10);
    await tour.click(page.locator("#main").getByRole("link", { name: "audit log" }).last());
    await expect(page).toHaveURL(/\/ai-log$/);
    await expect(h1(page)).toHaveText("AI audit log");
    const record = page.locator("main ol > li").filter({ hasText: TOUR_QUESTION });
    await expect(record).toBeVisible({ timeout: 15_000 });
    await expect(record.getByText("human decision: accepted")).toBeVisible();
    await tour.pause(900);
    await tour.hover(record.getByText(TOUR_QUESTION), 800);
    await tour.pause(1200);
    await tour.click(record.getByText("Details", { exact: true }));
    // A late audit-log refresh can swallow a very fast click (SHOWCASE_FAST): open it for sure.
    await expect(async () => {
      if ((await record.locator("details").getAttribute("open")) === null) {
        await record.getByText("Details", { exact: true }).click();
      }
      await expect(record.getByText(MOCK_SQL)).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.locator("main")).not.toContainText(PLACEHOLDER_KEY);
    await tour.scrollTo(record, { offset: 120, ms: 1000 });
    await tour.hover(record.getByText(/^Validator: /), 700);
    await tour.pause(1400);
    await tour.hover(page.getByRole("button", { name: "CSV" }), 800);
    await tour.pause(1600);

    await tour.caption(11);
    await tour.scrollToY(0, 800);
    await tour.click(nav(page).getByRole("link", { name: "Records" }), { scroll: false });
    await expect(page).toHaveURL(/\/records$/);
    await settle(page);
    await tour.click(page.getByRole("link", { name: "Twitter sentiment by suburb (SAL)", exact: true }));
    await expect(page).toHaveURL(/\/records\/twitter_sal_sentiment$/);
    await settle(page);
    await tour.type(page.getByRole("textbox", { name: "Search this table" }), "21640");
    await tour.click(page.getByRole("button", { name: "Search", exact: true }), { after: 0 });
    await expect(page.getByText(/^3 matching · page 1 of 1$/)).toBeVisible();
    const crimeRow = page
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: "crime", exact: true }) });
    await expect(crimeRow.getByRole("cell", { name: "4,026", exact: true })).toBeVisible();
    await tour.pause(900);
    await tour.hover(crimeRow.getByRole("cell", { name: "4,026", exact: true }), 800);
    await tour.pause(2600);

    expect(ai.calls, "one SQL call and one explanation call").toBe(2);
    expect(ai.leaks, "the placeholder key must only go to the (mocked) provider").toEqual([]);

    await finishRecording(context, page, tour);
  });
});

async function desktop(browser: Browser, colorScheme: "light" | "dark" = "light") {
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme,
  });
}

async function mobile(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });
}

test.describe("screenshots", () => {
  test("landing, light and dark", async ({ browser }) => {
    for (const scheme of ["light", "dark"] as const) {
      const context = await desktop(browser, scheme);
      const page = await context.newPage();
      await page.goto("/");
      await expect(h1(page)).toHaveText("Does the mood online match life on the ground?");
      await settle(page);
      await shot(page, `0${scheme === "light" ? 1 : 2}-landing-${scheme}`);
      await context.close();
    }
  });

  test("key features at 1440 × 900", async ({ browser }) => {
    test.setTimeout(10 * 60_000);
    const context = await desktop(browser);
    await mockAiProviders(context, { latencyMs: 0 });
    const page = await context.newPage();

    await page.goto("/");
    await settle(page);
    const story = heading(page, "From a 57 GB file to a dashboard, in five moves");
    await shot(page, "03-architecture", { target: story, offset: 100 });
    await expectStoryStep(page, 0);

    await page.goto("/twitter");
    await settle(page);
    await shot(page, "04-sentiment-map", { target: heading(page, "The suburb map"), offset: 84 });
    await mapReady(page, page.getByRole("region", { name: /^Map of Victorian suburbs coloured by/ }));
    await shot(page, "04-sentiment-map", { target: heading(page, "The suburb map"), offset: 84 });

    await page.goto("/income");
    await settle(page);
    await mapReady(page, income.map(page));
    const incomeControls = page.getByRole("group", { name: "Map metric" });
    await shot(page, "05-income-explorer", { target: incomeControls, offset: 108 });
    // A hovered dot shows its tooltip and outlines its SA2 on the map.
    await income.dot(page, "Ballarat").hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOT_DIR, "05-income-explorer.png") });
    await shot(page, "06-income-uncertainty", { target: page.locator("#uncertainty"), offset: 72 });

    await page.goto("/crime");
    await settle(page);
    const crimeControls = page.getByRole("group", { name: "Map metric" });
    await shot(page, "07-crime-explorer", { target: crimeControls, offset: 108 });
    await mapReady(page, page.getByRole("region", { name: /^Map of Victorian local government areas/ }));
    await shot(page, "07-crime-explorer", { target: crimeControls, offset: 108 });

    await page.goto("/spatial");
    await settle(page);
    await shot(page, "08-spatial-lisa", {
      target: page.getByRole("group", { name: "Area unit" }),
      offset: 100,
    });
    await mapReady(page, spatial.map(page));
    await page.getByRole("group", { name: "Map extent" }).getByRole("button", { name: "Melbourne" }).click();
    await page.waitForTimeout(1500);
    await shot(page, "08-spatial-lisa", {
      target: page.getByRole("group", { name: "Area unit" }),
      offset: 100,
    });

    await page.goto("/mastodon");
    await settle(page);
    await shot(page, "09-mastodon", { target: heading(page, "VADER only speaks English"), offset: 80 });

    await page.goto("/pipeline");
    await settle(page);
    await shot(page, "10-pipeline", { target: heading(page, "From raw text to a 1-9 score"), offset: 80 });

    await page.goto("/ask");
    await settle(page);
    await page.getByRole("button", { name: "Add your key", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "AI settings" });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, "11-ai-settings");
    await addPlaceholderKey(page, async (t, s) => t.fill(s));
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: TOUR_QUESTION }).click();
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expectMockedAnswer(page);
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText(/\(this browser only\): accepted/)).toBeVisible();
    await pinMockLabel(page);
    await shot(page, "12-ask-mocked-answer", {
      target: askStep(page, "Your model writes one SQL query"),
      offset: 76,
    });

    await page.goto("/ask/eval");
    await settle(page);
    await shot(page, "13-ask-eval", { target: heading(page, "Benchmark your model"), offset: 76 });

    await page.goto("/ai-log");
    await settle(page);
    const record = page.locator("main ol > li").filter({ hasText: TOUR_QUESTION });
    await expect(record).toBeVisible();
    await record.getByText("Details", { exact: true }).click();
    await pinMockLabel(page);
    await shot(page, "14-ai-log", { target: heading(page, "Your log"), offset: 80 });

    await page.goto("/methods");
    await settle(page);
    await shot(page, "15-methods", { target: page.locator("#evaluation"), offset: 64 });

    await page.goto("/records");
    await settle(page);
    await shot(page, "16-records");
    await context.close();
  });

  test("mobile at 390 × 844", async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const context = await mobile(browser);
    const page = await context.newPage();

    await page.goto("/");
    await settle(page);
    await shot(page, "17-mobile-landing");

    await page.goto("/income");
    await settle(page);
    await shot(page, "18-mobile-income", { target: income.scatter(page), offset: 72 });

    await page.goto("/spatial");
    await settle(page);
    await mapReady(page, spatial.map(page));
    await shot(page, "19-mobile-spatial", { target: spatial.readout(page), offset: 68 });
    await context.close();
  });
});
