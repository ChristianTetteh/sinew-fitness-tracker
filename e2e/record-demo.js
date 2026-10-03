// Records a scripted walkthrough of Sinew for the demo video.
//
// Output (in OUT): frames/*.jpg from the Chrome DevTools screencast plus
// timeline.json (frame times, captions, freeze moments). e2e/video/build_video.py
// turns that into the finished video.
// Usage: node e2e/record-demo.js [outDir]   (local stack on :4175, see README)
// Two weeks of sample history are added through the API (clearly captioned as
// sample data in the video) so the chart, streak and insight have something to show.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:4175";
const OUT = process.argv[2] || "/tmp/claude-0/videos/sinew";
const EMAIL = "esi@example.com";
const PW = "correct horse battery";
const ZOOM = 1.25; // laid out like 1536x744, drawn at 1920x930
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;
const timeline = { scale: 1, frames: [], captions: [], freezes: [] };

const CURSOR = `
(() => {
  const Z = ${ZOOM};
  const zoom = () => document.documentElement && (document.documentElement.style.zoom = String(Z));
  zoom();
  const mk = () => {
    zoom();
    if (document.getElementById("__dot")) return;
    const dot = document.createElement("div");
    dot.id = "__dot";
    dot.style.cssText = "position:fixed;left:-50px;top:-50px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,255,255,.92);border:3px solid #ff5a1f;z-index:2147483647;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.35);transition:transform .12s";
    document.documentElement.append(dot);
    const pos = JSON.parse(sessionStorage.getItem("__pos") || "null");
    if (pos) { dot.style.left = pos.x / Z + "px"; dot.style.top = pos.y / Z + "px"; }
    addEventListener("mousemove", (e) => { dot.style.left = e.clientX / Z + "px"; dot.style.top = e.clientY / Z + "px"; try { sessionStorage.setItem("__pos", JSON.stringify({ x: e.clientX, y: e.clientY })); } catch {} }, true);
    addEventListener("mousedown", () => (dot.style.transform = "scale(.65)"), true);
    addEventListener("mouseup", () => (dot.style.transform = "scale(1)"), true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", mk); else mk();
})();`;

// Optional: serve the page's Google Fonts from local @fontsource packages in
// FONTS_DIR (for machines that can't reach fonts.googleapis.com).
async function localGoogleFonts(ctx) {
  const dir = process.env.FONTS_DIR;
  if (!dir) return;
  const pkg = (name) => path.join(dir, fs.readdirSync(dir).find((x) => x.startsWith(name) && !x.endsWith(".tgz")), "package", "files");
  const files = { "bebas.woff2": path.join(pkg("fontsource-bebas-neue"), "bebas-neue-latin-400-normal.woff2") };
  for (const w of [400, 500, 600, 700]) files[`inter-${w}.woff2`] = path.join(pkg("fontsource-inter"), `inter-latin-${w}-normal.woff2`);
  const css = [
    "@font-face{font-family:'Bebas Neue';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/local/bebas.woff2) format('woff2')}",
    ...[400, 500, 600, 700].map((w) => `@font-face{font-family:'Inter';font-style:normal;font-weight:${w};src:url(https://fonts.gstatic.com/local/inter-${w}.woff2) format('woff2')}`),
  ].join("\n");
  await ctx.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: css }));
  await ctx.route("https://fonts.gstatic.com/local/*", (r) =>
    r.fulfill({ contentType: "font/woff2", body: fs.readFileSync(files[r.request().url().split("/").pop()]), headers: { "access-control-allow-origin": "*" } }));
}

const cap = (text) => timeline.captions.push({ t: now(), text });

async function moveTo(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
  await sleep(250);
}
async function pointAt(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width - 3, box.y + box.height + 3, { steps: 22 });
  await sleep(250);
}
async function click(page, locator) { await moveTo(page, locator); await locator.click(); }
async function type(page, locator, text) { await moveTo(page, locator); await locator.click(); await locator.pressSequentially(text, { delay: 70 }); }
async function scrollTo(page, locator, block = "center") {
  await locator.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
  await sleep(900);
}

let freezeN = 0;
async function freeze(page, locator, title, body) {
  await sleep(700);
  const b = await locator.boundingBox();
  const shot = path.join(OUT, `freeze${++freezeN}.png`);
  const t = now();
  await page.screenshot({ path: shot });
  timeline.freezes.push({ t, shot, title, body, box: [b.x, b.y, b.width, b.height] });
  await sleep(500);
}

// Two weeks of plausible history before today, a little better this week.
async function seedHistory() {
  const api = `${BASE}/api`;
  const login = await fetch(`${api}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PW }) });
  const { token } = await login.json();
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const plan = {
    walk: [8200, 9100, 7600, 10400, 8800, 9500, 7900, 6500, 7200, 8100, 6900, 7400, 8000],
    water: [2100, 2300, 1900, 2400, 2200, 2000, 2250, 1700, 1800, 1650, 1900, 1750, 1600],
    sleep: [7.5, 8, 7, 7.5, 8.5, 7, 7.5, 6.5, 7, 7.5, 6, 7, 7],
  };
  for (const [type, values] of Object.entries(plan)) {
    for (let i = 0; i < values.length; i++) {
      const r = await fetch(`${api}/logs`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ type, value: values[i], logged_at: day(i + 1) }) });
      if (!r.ok) throw new Error(`seed failed: ${r.status} ${await r.text()}`);
    }
  }
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "frames"), { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 930 }, colorScheme: "light" });
  await ctx.addInitScript(CURSOR);
  await localGoogleFonts(ctx);
  const page = await ctx.newPage();

  const cdp = await ctx.newCDPSession(page);
  let n = 0;
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = path.join(OUT, "frames", `${String(++n).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    timeline.frames.push({ file, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });

  await page.goto("about:blank");
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 930 });
  timeline.start = now();
  await page.goto(`${BASE}/signup`);
  cap("Sinew: a simple daily tracker for steps, water and sleep");
  await page.getByLabel("Name").waitFor({ timeout: 15000 });
  await sleep(800);

  // 1. Sign up
  cap("Create an account in seconds");
  await type(page, page.getByLabel("Name"), "Esi Owusu");
  await type(page, page.getByLabel("Email"), EMAIL);
  await type(page, page.getByLabel("Password"), PW);
  await sleep(300);
  await click(page, page.getByRole("button", { name: "Create account" }));
  await page.getByRole("heading", { name: /Hi, Esi/ }).waitFor();
  await sleep(1800);

  // 2. Sample history
  cap("Fast-forward two weeks (sample entries added for this demo)");
  await seedHistory();
  await sleep(1200);
  await page.reload();
  await page.getByRole("heading", { name: /Hi, Esi/ }).waitFor();
  await page.locator(".insight-text").waitFor();
  await sleep(1200);
  const hero = page.locator("section.hero-card");
  await pointAt(page, page.locator(".streak-chip"));
  await freeze(page, page.locator(".hero-foot"), "Insights from your own history",
    "Sinew compares this week's daily averages with last week's and points out the biggest change, next to your streak.");

  // 3. Log today
  cap("Log steps, water and sleep in a couple of taps");
  const form = page.locator("form.quick-log");
  const amount = form.locator("input[type=number]");
  await click(page, form.getByRole("button", { name: "Steps", exact: true }));
  await type(page, amount, "6400");
  await click(page, form.getByRole("button", { name: "Log steps" }));
  await sleep(1300);
  await click(page, form.getByRole("button", { name: "Water", exact: true }));
  await type(page, amount, "1500");
  await click(page, form.getByRole("button", { name: "Log water" }));
  await sleep(1300);
  await click(page, form.getByRole("button", { name: "Sleep", exact: true }));
  await type(page, amount, "7.5");
  await click(page, form.getByRole("button", { name: "Log sleep" }));
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(900);
  await pointAt(page, page.locator(".score-ring-value"));
  await freeze(page, hero, "Today's effort score",
    "The ring shows how much of today's goals Esi has completed. It's a progress score, not a health measure.");

  // 4. The daily cap
  cap("Typo? Sinew catches impossible totals");
  await scrollTo(page, form);
  await type(page, amount, "20");
  await click(page, form.getByRole("button", { name: "Log sleep" }));
  const err = form.locator(".quick-log-error");
  await err.waitFor();
  await pointAt(page, err);
  await freeze(page, form, "Checked on the server",
    "Every entry is checked, and so is the day's running total. Even two entries sent at the same moment can't push sleep past 24 hours.");
  await amount.fill("");

  // 5. Today's cards and the week
  cap("Today against your goals, and the week at a glance");
  const cards = page.locator(".stat-grid");
  await scrollTo(page, cards);
  await sleep(1200);
  const chart = page.locator("section.chart-section");
  await scrollTo(page, chart);
  await click(page, chart.getByRole("button", { name: "Water", exact: true }));
  await sleep(1400);
  await pointAt(page, chart.getByRole("button", { name: "Water", exact: true }));
  await freeze(page, chart, "Your week at a glance",
    "The last seven days for each metric, one bar per day, so trends are easy to spot. Switch between steps, water and sleep.");
  await click(page, chart.getByRole("button", { name: "Sleep", exact: true }));
  await sleep(1500);

  // 6. Edit an entry
  cap("Fix a mistake by editing or removing an entry");
  const recent = page.locator("section.recent-section");
  await scrollTo(page, recent, "start");
  const edit = recent.getByRole("button", { name: /^Edit .*Sleep/i }).first();
  await click(page, edit);
  const editInput = recent.locator("input.recent-edit-input");
  await editInput.waitFor();
  await click(page, editInput);
  await editInput.press("Control+A");
  await editInput.pressSequentially("8", { delay: 90 });
  await click(page, recent.getByRole("button", { name: /^Save/ }));
  await sleep(1600);

  // 7. Goals
  cap("Set your own daily goals");
  await click(page, page.getByRole("link", { name: "Goals" }).first());
  await page.getByRole("heading", { name: "Goals" }).waitFor();
  await sleep(800);
  const water = page.getByLabel(/Daily water/);
  await click(page, water);
  await water.press("Control+A");
  await water.pressSequentially("2500", { delay: 90 });
  await pointAt(page, page.getByRole("button", { name: "Save goals" }));
  await freeze(page, page.locator("form").first(), "Your goals, your score",
    "Goals drive the score, the cards and the chart. Each account is private: every query is limited to the signed-in user's own data.");
  await click(page, page.getByRole("button", { name: "Save goals" }));
  await sleep(1400);

  // 8. Theme
  cap("Light and dark themes");
  await click(page, page.getByRole("link", { name: "Dashboard" }).first());
  await page.getByRole("heading", { name: /Hi, Esi/ }).waitFor();
  await sleep(900);
  const themeBtn = page.locator("button.rail-theme");
  await click(page, themeBtn);
  await sleep(2600);

  timeline.end = now();
  await cdp.send("Page.stopScreencast");
  await sleep(300);
  fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(timeline, null, 1));
  await browser.close();
  console.log(`saved ${timeline.frames.length} frames, ${timeline.freezes.length} freezes, ${(timeline.end - timeline.start).toFixed(1)}s`);
})().catch(async (e) => { console.error(e); process.exit(1); });
