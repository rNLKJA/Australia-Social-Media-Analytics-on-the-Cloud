/**
 * Turn the raw tour output in web/.showcase/ into the committed media:
 *
 *   docs/showcase/NN-*.png          screenshots for the README (optimised, < 600 KB each)
 *   docs/showcase/<walkthrough>.gif README GIFs (960 px, 10 fps, waits and scrolls cut, < 8 MB)
 *   web/public/showcase/<walkthrough>.mp4        H.264, CRF 28, faststart (< 8 MB)
 *   web/public/showcase/<walkthrough>.vtt        captions from the on-screen steps
 *   web/public/showcase/<walkthrough>-poster.webp
 *   web/public/showcase/screens/NN-*.webp        screenshot copies for the /tour lightbox
 *
 * Images use sharp (no pngquant needed); video uses the ffmpeg on PATH.
 *   node scripts/showcase-media.mjs     (or: pnpm showcase --media-only)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const web = path.resolve(import.meta.dirname, "..");
const raw = path.join(web, ".showcase");
const docsOut = path.resolve(web, "..", "docs", "showcase");
const publicOut = path.join(web, "public", "showcase");
const screensOut = path.join(publicOut, "screens");
const tmp = path.join(raw, "tmp");

const KB = 1024;
const MB = 1024 * KB;
const PNG_LIMIT = 600 * KB;
const VIDEO_LIMIT = 8 * MB;

/** Poster frame: this step's caption, plus a delay (seconds) for the UI to settle. */
const POSTER = {
  "the-story": { step: 8, after: 2.2 },
  "income-vs-sentiment": { step: 3, after: 2.6 },
  "ask-the-data": { step: 7, after: 1.6 },
};

for (const dir of [docsOut, publicOut, screensOut, tmp]) mkdirSync(dir, { recursive: true });

const size = (file) => statSync(file).size;
const fmt = (bytes) => (bytes >= MB ? `${(bytes / MB).toFixed(2)} MB` : `${Math.round(bytes / KB)} KB`);
const report = [];

function ffmpeg(args) {
  const res = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    stdio: "inherit",
  });
  if (res.status !== 0) throw new Error(`ffmpeg failed: ffmpeg ${args.join(" ")}`);
}

function probeDuration(file) {
  const res = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" },
  );
  return Number.parseFloat(res.stdout.trim());
}

// ---------------------------------------------------------------- screenshots

async function screenshots() {
  const dir = path.join(raw, "screens");
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort()) {
    const id = path.basename(file, ".png");
    const src = path.join(dir, file);
    const meta = await sharp(src).metadata();
    const isMobile = id.includes("mobile");
    // Mobile shots are taken at 2x (780 × 1688) and downscaled to 1.5x.
    const width = isMobile ? Math.round((meta.width * 3) / 4) : meta.width;
    const base = () => sharp(src).resize({ width, kernel: "lanczos3" });

    const png = path.join(docsOut, `${id}.png`);
    await base().png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true }).toFile(png);
    if (size(png) > PNG_LIMIT) {
      // Palette PNG (libimagequant, bundled with sharp): UI screenshots survive 256 colours well.
      await base().png({ palette: true, quality: 92, colours: 256, effort: 10, dither: 0.6 }).toFile(png);
    }
    if (size(png) > PNG_LIMIT) {
      await base().png({ palette: true, quality: 80, colours: 160, effort: 10, dither: 0.8 }).toFile(png);
    }
    const webp = path.join(screensOut, `${id}.webp`);
    await base().webp({ quality: 82, effort: 6, smartSubsample: true }).toFile(webp);
    report.push([path.relative(path.resolve(web, ".."), png), size(png)]);
    report.push([path.relative(path.resolve(web, ".."), webp), size(webp)]);
  }
}

// --------------------------------------------------------------------- videos

const vttTime = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const sec = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, "0")}`;
};

function writeVtt(id, info, duration) {
  const lines = ["WEBVTT", "", `NOTE ${info.title}: captions match the on-screen steps.`, ""];
  info.cues.forEach((c, i) => {
    const start = Math.max(0, c.start - info.trimStart);
    const end = Math.min(duration, c.end - info.trimStart);
    if (end <= start) return;
    lines.push(String(i + 1));
    lines.push(`${vttTime(start)} --> ${vttTime(end)}`);
    lines.push(
      `Step ${c.step} of ${info.cues.length}. ${c.text}.${c.mock ? " (Mocked AI response for illustration.)" : ""}`,
    );
    lines.push("");
  });
  const file = path.join(publicOut, `${id}.vtt`);
  writeFileSync(file, lines.join("\n"));
  report.push([path.relative(path.resolve(web, ".."), file), size(file)]);
}

function encodeMp4(src, out, trimStart) {
  for (const crf of [28, 30, 32, 34]) {
    ffmpeg([
      "-ss",
      trimStart.toFixed(2),
      "-i",
      src,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      String(crf),
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-r",
      "25",
      out,
    ]);
    if (size(out) <= VIDEO_LIMIT) return crf;
  }
  throw new Error(`${out} is larger than 8 MB even at CRF 34`);
}

/**
 * GIF for the README: 960 px wide, 10 fps, own palette. To stay under 8 MB
 * without shrinking it, the GIF is edited rather than squeezed: waits on the
 * app are cut, scripted scrolls become cuts (the video slides, the GIF jumps),
 * frames that change almost the whole screen at once (page loads, dialogs
 * fading in) are dropped in favour of the settled frame, and it plays a
 * little faster than real time. Each attempt below trades a bit more speed
 * or colour for size; the width never changes.
 */
function encodeGif(src, out, info, duration) {
  const rel = ([a, b], padStart, padEnd) => [a - info.trimStart + padStart, b - info.trimStart + padEnd];
  const cuts = [
    ...info.idle.map((iv) => rel(iv, 0.7, -0.5)).filter(([a, b]) => b - a > 0.6),
    ...(info.motion ?? []).map((iv) => rel(iv, 0.04, 0.08)).filter(([a, b]) => b - a > 0.1),
  ].filter(([a]) => a < duration);
  const select = cuts.length
    ? `select='not(${cuts.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join("+")})',setpts=N/FRAME_RATE/TB,`
    : "";
  const attempts = [
    { fps: 10, speed: 1.25, colours: 160 },
    { fps: 10, speed: 1.25, colours: 128 },
    { fps: 10, speed: 1.4, colours: 128 },
    { fps: 10, speed: 1.4, colours: 96 },
    { fps: 10, speed: 1.5, colours: 96 },
    { fps: 10, speed: 1.6, colours: 96 },
    { fps: 10, speed: 1.6, colours: 64 },
  ];
  for (const a of attempts) {
    const filter =
      `${select}setpts=PTS/${a.speed},fps=${a.fps},scale=960:-2:flags=lanczos,` +
      `select='lt(scene,0.04)',setpts=N/${a.fps}/TB,split[s0][s1];` +
      `[s0]palettegen=max_colors=${a.colours}:stats_mode=diff[p];` +
      `[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
    ffmpeg(["-ss", info.trimStart.toFixed(2), "-i", src, "-filter_complex", filter, "-loop", "0", out]);
    if (size(out) <= VIDEO_LIMIT) return { ...a, seconds: probeDuration(out) };
  }
  throw new Error(`${out} is larger than 8 MB`);
}

async function poster(id, mp4, info) {
  const p = POSTER[id];
  const cue = info.cues.find((c) => c.step === p.step) ?? info.cues.at(-1);
  const at = Math.max(0, cue.start - info.trimStart + p.after);
  const frame = path.join(tmp, `${id}-poster.png`);
  ffmpeg(["-ss", at.toFixed(2), "-i", mp4, "-frames:v", "1", frame]);
  const out = path.join(publicOut, `${id}-poster.webp`);
  await sharp(frame).webp({ quality: 80, effort: 6 }).toFile(out);
  report.push([path.relative(path.resolve(web, ".."), out), size(out)]);
}

async function videos() {
  const dir = path.join(raw, "video");
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".webm"))
    .sort()) {
    const id = path.basename(file, ".webm");
    const src = path.join(dir, file);
    const cueFile = path.join(dir, `${id}.json`);
    if (!existsSync(cueFile)) throw new Error(`Missing ${cueFile}`);
    const info = JSON.parse(readFileSync(cueFile, "utf8"));

    const mp4 = path.join(publicOut, `${id}.mp4`);
    const crf = encodeMp4(src, mp4, info.trimStart);
    const duration = probeDuration(mp4);
    report.push([
      `${path.relative(path.resolve(web, ".."), mp4)} (${duration.toFixed(1)} s, CRF ${crf})`,
      size(mp4),
    ]);
    writeVtt(id, info, duration);
    await poster(id, mp4, info);

    const gif = path.join(docsOut, `${id}.gif`);
    const g = encodeGif(src, gif, info, duration);
    report.push([
      `${path.relative(path.resolve(web, ".."), gif)} (${g.seconds.toFixed(1)} s, ${g.fps} fps, ×${g.speed}, ${g.colours} colours)`,
      size(gif),
    ]);
  }
}

await screenshots();
await videos();
rmSync(tmp, { recursive: true, force: true });

console.log("\nShowcase media:");
for (const [name, bytes] of report) console.log(`  ${fmt(bytes).padStart(9)}  ${name}`);
