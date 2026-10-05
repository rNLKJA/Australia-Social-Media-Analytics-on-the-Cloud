/**
 * Helpers for the guided tour: an on-screen caption banner and cursor
 * highlight (injected into the page, so they appear in the recording),
 * human-paced pointer movement, and a cue log that becomes the WebVTT
 * captions of each video.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Browser, BrowserContext, Locator, Page } from "@playwright/test";

import { MOCK_LABEL, type Walkthrough } from "../src/lib/showcase";

/** Raw tour output (screenshots, webm, cue files); post-processed by scripts/showcase-media.mjs. */
export const RAW_DIR = path.resolve(import.meta.dirname, "..", ".showcase");
export const SHOT_DIR = path.join(RAW_DIR, "screens");
export const VIDEO_DIR = path.join(RAW_DIR, "video");

/** SHOWCASE_FAST=1 runs the journeys as quick end-to-end tests: no pauses, no video. */
export const FAST = process.env.SHOWCASE_FAST === "1";
export const RECORD = !FAST && process.env.SHOWCASE_RECORD !== "0";
const PACE = FAST ? 0 : Number(process.env.SHOWCASE_PACE ?? 1);

export const VIDEO_SIZE = { width: 1280, height: 800 } as const;
/** Between the sticky site header and the caption banner. */
const SAFE_AREA = { top: 72, bottom: VIDEO_SIZE.height - 112 } as const;

export function ensureDirs() {
  for (const dir of [RAW_DIR, SHOT_DIR, VIDEO_DIR]) mkdirSync(dir, { recursive: true });
}

/** A context for one recorded journey (light theme, 1280 × 800). */
export async function recordingContext(browser: Browser): Promise<BrowserContext> {
  ensureDirs();
  const context = await browser.newContext({
    viewport: VIDEO_SIZE,
    deviceScaleFactor: 1,
    colorScheme: "light",
    ...(RECORD ? { recordVideo: { dir: path.join(VIDEO_DIR, "tmp"), size: VIDEO_SIZE } } : {}),
  });
  await context.addInitScript(overlayInit, { mockLabel: MOCK_LABEL });
  return context;
}

/**
 * Where the caption banner sits: centred, or in the right-hand column (for
 * pages with a sticky left sidebar whose controls sit near the bottom edge).
 */
export type CaptionAlign = "center" | "right";

interface CaptionState {
  step: number;
  total: number;
  text: string;
  mock: boolean;
  align: CaptionAlign;
}

/**
 * Runs in the page (as an init script, so it survives navigations). Mounts a
 * shadow-DOM overlay with a cursor dot that follows real mouse events and a
 * fixed caption banner at the bottom of the viewport.
 */
function overlayInit({ mockLabel }: { mockLabel: string }) {
  const HOST_ID = "__showcase-overlay";
  const w = window as unknown as {
    __showcaseCaption?: (c: CaptionState | null) => void;
  };
  const css = `
    :host { all: initial; }
    .cursor {
      position: fixed; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px;
      border-radius: 50%; background: rgba(253, 214, 99, 0.32);
      border: 2px solid rgba(190, 128, 0, 0.95);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.7), 0 2px 10px rgba(0, 0, 0, 0.25);
      transition: width .12s, height .12s, margin .12s, background .12s; opacity: 0;
    }
    .cursor.on { opacity: 1; }
    .cursor.down { width: 18px; height: 18px; margin: -9px 0 0 -9px; background: rgba(214, 150, 0, 0.6); }
    .ripple {
      position: fixed; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
      border: 2px solid rgba(196, 136, 0, 0.9); animation: ripple .6s ease-out forwards;
    }
    @keyframes ripple { to { transform: scale(3.4); opacity: 0; } }
    .caption {
      position: fixed; left: 24px; right: 24px; bottom: 16px; margin: 0 auto;
      width: fit-content; max-width: 1180px; box-sizing: border-box;
      display: flex; align-items: center; gap: 12px; padding: 10px 16px 10px 10px;
      border-radius: 16px; background: rgba(20, 31, 46, 0.95); color: #f7f4ee;
      border: 1px solid rgba(255, 255, 255, 0.14); box-shadow: 0 12px 34px rgba(0, 0, 0, 0.32);
      font: 600 17px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: 0.005em;
    }
    .caption.right { left: 456px; margin: 0 0 0 auto; }
    .text { flex: 1 1 auto; min-width: 0; }
    .caption[hidden] { display: none; }
    .step {
      flex: none; min-width: 44px; padding: 4px 9px; border-radius: 10px; text-align: center;
      background: #fde9a8; color: #1d3a5f; font: 700 14px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .mock {
      flex: none; padding: 4px 9px; border-radius: 10px; background: #fff3d6; color: #5a3b00;
      border: 1px dashed #b07a00; font: 700 12px/1.2 ui-sans-serif, system-ui, sans-serif;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .mock[hidden] { display: none; }
  `;

  let root: ShadowRoot | null = null;
  let host: HTMLElement | null = null;

  const readJson = <T>(key: string): T | null => {
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? "null") as T | null;
    } catch {
      return null;
    }
  };

  const placeCursor = (x: number, y: number) => {
    const cursor = root?.querySelector<HTMLElement>(".cursor");
    if (!cursor) return;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    cursor.classList.add("on");
  };

  const render = (c: CaptionState | null) => {
    const box = root?.querySelector<HTMLElement>(".caption");
    if (!box) return;
    if (!c) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.classList.toggle("right", c.align === "right");
    box.querySelector(".step")!.textContent = `${c.step}/${c.total}`;
    box.querySelector(".text")!.textContent = c.text;
    box.querySelector<HTMLElement>(".mock")!.hidden = !c.mock;
  };

  const mount = () => {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${css}</style><div class="cursor"></div><div class="caption" hidden><span class="step"></span><span class="text"></span><span class="mock" hidden></span></div>`;
    root.querySelector(".mock")!.textContent = mockLabel;
    document.documentElement.appendChild(host);
    const pos = readJson<{ x: number; y: number }>("__showcase_cursor");
    if (pos) placeCursor(pos.x, pos.y);
    render(readJson<CaptionState>("__showcase_caption"));
  };

  w.__showcaseCaption = (c) => {
    sessionStorage.setItem("__showcase_caption", JSON.stringify(c));
    mount();
    render(c);
  };

  window.addEventListener(
    "mousemove",
    (e) => {
      placeCursor(e.clientX, e.clientY);
      sessionStorage.setItem("__showcase_cursor", JSON.stringify({ x: e.clientX, y: e.clientY }));
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "mousedown",
    (e) => {
      root?.querySelector(".cursor")?.classList.add("down");
      const ripple = document.createElement("div");
      ripple.className = "ripple";
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      root?.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    },
    true,
  );
  window.addEventListener("mouseup", () => root?.querySelector(".cursor")?.classList.remove("down"), true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  // Hydration may replace foreign nodes; put the overlay back if it goes missing.
  setInterval(mount, 250);
}

interface Cue {
  step: number;
  text: string;
  mock: boolean;
  start: number;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Drives one journey: captions, paced pointer movement and the cue log.
 * Times are seconds since the page (and so the video) was created.
 */
export class Tour {
  private readonly t0 = Date.now();
  private readonly cues: Cue[] = [];
  private readonly idle: [number, number][] = [];
  /** Scripted scrolls; the GIF drops these frames (a cut instead of a slide). */
  private readonly motion: [number, number][] = [];
  private mouse = { x: VIDEO_SIZE.width / 2, y: VIDEO_SIZE.height / 2 };
  private trimStart = 0;

  constructor(
    readonly page: Page,
    readonly walkthrough: Walkthrough,
  ) {}

  private now() {
    return (Date.now() - this.t0) / 1000;
  }

  async pause(ms: number) {
    if (PACE > 0) await this.page.waitForTimeout(Math.round(ms * PACE));
  }

  /** Mark the start of the useful footage (after the first page has rendered). */
  markStart() {
    this.trimStart = Math.max(0, this.now() - 0.2);
  }

  /** Show step `step` (1-based) of the walkthrough in the caption banner. */
  async caption(step: number, { align = "center" }: { align?: CaptionAlign } = {}) {
    const { steps, mockedSteps = [] } = this.walkthrough;
    const text = steps[step - 1];
    if (!text) throw new Error(`No step ${step} in ${this.walkthrough.id}`);
    const mock = mockedSteps.includes(step);
    this.cues.push({ step, text, mock, start: this.now() });
    const state: CaptionState = { step, total: steps.length, text, mock, align };
    await this.page.evaluate((c) => {
      (window as unknown as { __showcaseCaption?: (c: unknown) => void }).__showcaseCaption?.(c);
    }, state);
  }

  /** Time spent waiting on the app; cut from the GIF to keep it short. */
  async idleWhile<T>(fn: () => Promise<T>): Promise<T> {
    const start = this.now();
    const result = await fn();
    this.idle.push([start, this.now()]);
    return result;
  }

  /** Glide the pointer to (x, y) with an ease-in-out path. */
  async glide(x: number, y: number, ms = 650) {
    const from = { ...this.mouse };
    if (PACE === 0) {
      await this.page.mouse.move(x, y);
    } else {
      const steps = Math.max(8, Math.round((ms * PACE) / 16));
      for (let i = 1; i <= steps; i++) {
        const t = ease(i / steps);
        await this.page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
        await this.page.waitForTimeout(Math.max(1, Math.round((ms * PACE) / steps) - 6));
      }
    }
    this.mouse = { x, y };
  }

  /** Run a scripted scroll and log its interval. */
  private async scrolling(fn: () => Promise<void>) {
    const start = this.now();
    await fn();
    const end = this.now();
    if (end - start > 0.05) this.motion.push([start, end]);
  }

  /** Smoothly scroll the window by `delta` px (clamped to the page). */
  private async scrollBy(delta: number, ms = 700) {
    await this.scrolling(() =>
      this.page.evaluate(
        async ([delta, ms]) => {
          const html = document.documentElement;
          const from = window.scrollY;
          const to = Math.min(html.scrollHeight - window.innerHeight, Math.max(0, from + delta));
          if (ms <= 0 || Math.abs(to - from) < 1) {
            window.scrollTo({ top: to, behavior: "instant" });
            return;
          }
          const startAt = performance.now();
          await new Promise<void>((resolve) => {
            const frame = (t: number) => {
              const k = Math.min(1, (t - startAt) / ms);
              const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
              window.scrollTo({ top: from + (to - from) * e, behavior: "instant" });
              if (k < 1) requestAnimationFrame(frame);
              else resolve();
            };
            requestAnimationFrame(frame);
          });
        },
        [delta, Math.round(ms * PACE)] as const,
      ),
    );
  }

  /**
   * Centre of `target`, scrolling it (smoothly) into the safe area between
   * the sticky header and the caption banner first, if needed.
   */
  private async centre(target: Locator) {
    await target.waitFor({ state: "visible" });
    let box = await target.boundingBox();
    if (!box) throw new Error(`No bounding box for ${target}`);
    const { top, bottom } = SAFE_AREA;
    if (box.y < top || box.y + box.height > bottom) {
      const mid = box.y + box.height / 2;
      await this.scrollBy(mid - (top + bottom) / 2);
      box = await target.boundingBox();
    }
    if (!box || box.y < 0 || box.y + box.height > VIDEO_SIZE.height) {
      // Clipped by an inner scroll container (or the window could not move).
      await target.scrollIntoViewIfNeeded();
      box = await target.boundingBox();
    }
    if (!box) throw new Error(`No bounding box for ${target}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  async hover(target: Locator, ms = 650, { scroll = true }: { scroll?: boolean } = {}) {
    const { x, y } = scroll ? await this.centre(target) : await this.where(target);
    await this.glide(x, y, ms);
  }

  /** Centre of `target` where it is now (for sticky elements scrolling cannot move). */
  private async where(target: Locator) {
    await target.waitFor({ state: "visible" });
    const box = await target.boundingBox();
    if (!box) throw new Error(`No bounding box for ${target}`);
    if (box.y < 0 || box.y + box.height > VIDEO_SIZE.height) {
      throw new Error(`${target} is outside the viewport (y = ${Math.round(box.y)})`);
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  /**
   * Smoothly scroll the scrollable `container` so `target` sits `offset` px
   * below the container's top edge.
   */
  async scrollInside(container: Locator, target: Locator, { offset = 0, ms = 900 } = {}) {
    const handle = await target.elementHandle();
    await this.scrolling(() =>
      container.evaluate(
        async (box, [el, offset, ms]) => {
          const from = box.scrollTop;
          const top = (el as Element).getBoundingClientRect().top - box.getBoundingClientRect().top + from;
          const to = Math.min(box.scrollHeight - box.clientHeight, Math.max(0, top - (offset as number)));
          const duration = ms as number;
          if (duration <= 0 || Math.abs(to - from) < 1) {
            box.scrollTop = to;
            return;
          }
          const startAt = performance.now();
          await new Promise<void>((resolve) => {
            const frame = (t: number) => {
              const k = Math.min(1, (t - startAt) / duration);
              const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
              box.scrollTop = from + (to - from) * e;
              if (k < 1) requestAnimationFrame(frame);
              else resolve();
            };
            requestAnimationFrame(frame);
          });
        },
        [handle, offset, Math.round(ms * PACE)] as const,
      ),
    );
    await handle?.dispose();
  }

  /** Smoothly scroll the window to `y` (clamped to the page). */
  async scrollToY(y: number, ms = 1000) {
    const delta = await this.page.evaluate((y) => y - window.scrollY, y);
    await this.scrollBy(delta, ms);
  }

  /** Hover something that may already be gone (live UI); never fails the tour. */
  async tryHover(target: Locator, ms = 650) {
    try {
      await target.waitFor({ state: "visible", timeout: 2000 });
      const box = await target.boundingBox();
      if (box) await this.glide(box.x + box.width / 2, box.y + box.height / 2, ms);
    } catch {
      // The element changed while we moved; the recording simply keeps going.
    }
  }

  async click(target: Locator, { before = 250, after = 350, scroll = true } = {}) {
    await target.waitFor({ state: "visible" });
    const { x, y } = scroll ? await this.centre(target) : await this.where(target);
    await this.glide(x, y);
    await this.pause(before);
    await this.page.mouse.down();
    await this.page.waitForTimeout(PACE > 0 ? 90 : 10);
    await this.page.mouse.up();
    await this.pause(after);
  }

  /**
   * Drag a slider thumb along its track, through each of `stops` (fractions
   * of the track width, 0 = left end), pausing briefly at each one.
   */
  async dragSlider(thumb: Locator, track: Locator, stops: readonly number[], ms = 1400) {
    const start = await this.centre(thumb);
    await this.glide(start.x, start.y);
    await this.pause(250);
    const box = await track.boundingBox();
    if (!box) throw new Error(`No bounding box for ${track}`);
    await this.page.mouse.down();
    for (const stop of stops) {
      await this.glide(box.x + box.width * stop, start.y, ms);
      await this.pause(700);
    }
    await this.page.mouse.up();
    await this.pause(300);
  }

  async type(target: Locator, text: string) {
    await this.click(target, { after: 150 });
    await target.press("ControlOrMeta+a");
    await this.page.keyboard.type(text, { delay: PACE > 0 ? 45 : 0 });
    await this.pause(300);
  }

  /** Smoothly scroll so `target` sits `offset` px below the top of the viewport. */
  async scrollTo(target: Locator, { offset = 84, ms = 1100 } = {}) {
    await target.waitFor({ state: "attached" });
    const handle = await target.elementHandle();
    await this.scrolling(() =>
      this.page.evaluate(
        async ([el, offset, ms]) => {
          const html = document.documentElement;
          const from = window.scrollY;
          const to = Math.min(
            html.scrollHeight - window.innerHeight,
            Math.max(0, (el as Element).getBoundingClientRect().top + from - (offset as number)),
          );
          const duration = ms as number;
          if (duration <= 0) {
            window.scrollTo({ top: to, behavior: "instant" });
            return;
          }
          const startAt = performance.now();
          await new Promise<void>((resolve) => {
            const frame = (t: number) => {
              const k = Math.min(1, (t - startAt) / duration);
              const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
              window.scrollTo({ top: from + (to - from) * e, behavior: "instant" });
              if (k < 1) requestAnimationFrame(frame);
              else resolve();
            };
            requestAnimationFrame(frame);
          });
        },
        [handle, offset, Math.round(ms * PACE)] as const,
      ),
    );
    await handle?.dispose();
  }

  /** Write the cue file next to the raw video (used for WebVTT, trimming and GIF cuts). */
  save() {
    if (!RECORD) return;
    const end = this.now();
    const cues = this.cues.map((c, i) => ({
      ...c,
      end: i + 1 < this.cues.length ? this.cues[i + 1].start : end,
    }));
    writeFileSync(
      path.join(VIDEO_DIR, `${this.walkthrough.id}.json`),
      `${JSON.stringify(
        {
          id: this.walkthrough.id,
          title: this.walkthrough.title,
          trimStart: this.trimStart,
          end,
          cues,
          idle: this.idle,
          motion: this.motion,
        },
        null,
        2,
      )}\n`,
    );
  }
}

/** Close the context and move its video to .showcase/video/<id>.webm. */
export async function finishRecording(context: BrowserContext, page: Page, tour: Tour) {
  const video = RECORD ? page.video() : null;
  tour.save();
  await context.close();
  if (video) await video.saveAs(path.join(VIDEO_DIR, `${tour.walkthrough.id}.webm`));
}
