#!/usr/bin/env node
/**
 * Brand kit generator. Node 22+ built-ins only (no npm dependencies).
 *
 * Produces, under apps/web/public/brand/:
 *   png/<name>.png                     one transparent PNG per SVG in apps/web/public/brand/
 *   kalea-brand-guidelines-<loc>.pdf   the built /brand/ page printed to A4, per locale
 *   kalea-brand-kit.zip                logos and elements (SVG + PNG), tokens.json, the PDFs, README.txt
 * and apps/web/src/components/brand/kit-manifest.json with the byte sizes the page shows.
 *
 * Usage (from the repo root):
 *   pnpm --filter @kalea/web build   # the PDFs are printed from apps/web/dist
 *   pnpm brand:kit                   # or: node scripts/brand-kit.mjs [--build]
 *   pnpm --filter @kalea/web build   # again, so dist serves the new files and sizes
 *
 * Rendering uses a local Chrome or Edge in headless mode over the DevTools protocol, and a tiny
 * node:http static server for apps/web/dist, so the user's dev server is not needed.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "apps", "web");
const DIST = join(WEB, "dist");
const OUT = join(WEB, "public", "brand");
const PNG_DIR = join(OUT, "png");
const MANIFEST = join(WEB, "src", "components", "brand", "kit-manifest.json");
const LOCALES = [
  { code: "en", path: "/brand/" },
  { code: "es", path: "/es/brand/" },
  { code: "pt-br", path: "/pt-br/brand/" },
];
/** Long side of every PNG, in pixels. Square sources (mark, icon, favicon, tile) come out 1024 × 1024. */
const PNG_SIZE = 1024;
const ZIP_NAME = "kalea-brand-kit.zip";
const pdfName = (code) => `kalea-brand-guidelines-${code}.pdf`;

const fail = (message) => {
  console.error(`brand-kit: ${message}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------------------------

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) fail("Chrome or Edge not found. Install Chrome or set CHROME_PATH to a Chromium-based browser binary.");
  return found;
}

/** Starts headless Chrome and returns a DevTools session on one blank tab. */
async function launchBrowser() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), "kalea-brand-kit-"));
  const proc = spawn(findChrome(), ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let version;
  for (let i = 0; i < 60 && !version; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch {
      await sleep(250);
    }
  }
  if (!version) fail("Chrome did not open its DevTools port.");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { r, j } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? j(new Error(`${d.error.message} (${d.error.code})`)) : r(d.result);
    } else if (d.method) listeners.forEach((l) => l(d));
  };
  const send = (method, params = {}) =>
    new Promise((r, j) => {
      const i = ++id;
      pending.set(i, { r, j });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const waitFor = (method) =>
    new Promise((r) => {
      const l = (d) => d.method === method && (listeners.delete(l), r(d.params));
      listeners.add(l);
    });
  /** Navigates and waits for load, fonts and images. */
  const open = async (url) => {
    const loaded = waitFor("Page.loadEventFired");
    await send("Page.navigate", { url });
    await loaded;
    // Lazy images below the fold never load in a headless tab, so make them eager first;
    // the timeout keeps a broken image from stalling the run.
    await send("Runtime.evaluate", {
      expression: `Promise.race([
        Promise.all([document.fonts.ready, ...[...document.images].map((i) => ((i.loading = "eager"), i.decode().catch(() => {})))]),
        new Promise((r) => setTimeout(r, 10000)),
      ])`,
      awaitPromise: true,
    });
  };
  await send("Page.enable");
  const close = () => {
    ws.close();
    proc.kill();
    // Chrome may still hold the profile for a moment; leftovers in the OS temp dir are harmless.
    setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500).unref();
  };
  return { send, open, close };
}

// ---------------------------------------------------------------------------------------------
// Static server for apps/web/dist (plus the PNG render page)
// ---------------------------------------------------------------------------------------------

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json", ".pdf": "application/pdf" };

function serveDist() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    // Blank page on the same origin, used to rasterize the SVGs.
    if (url.pathname === "/__render") {
      res.writeHead(200, { "content-type": TYPES[".html"] });
      return res.end("<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block}</style></head><body></body></html>");
    }
    // SVG sources come from public/brand so a stale dist never affects the PNGs.
    const base = url.pathname.startsWith("/__src/") ? OUT : DIST;
    const rel = decodeURIComponent(url.pathname.replace(/^\/__src/, ""));
    let file = normalize(join(base, rel));
    if (!file.startsWith(base + sep) && file !== base) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

// ---------------------------------------------------------------------------------------------
// ZIP writer
// ---------------------------------------------------------------------------------------------

/**
 * Minimal ZIP (PKWARE APPNOTE 6.3) writer: for each file a local file header (signature
 * 0x04034b50) followed by its raw DEFLATE data, then one central directory header per file
 * (0x02014b50), then the end-of-central-directory record (0x06054b50). Every entry uses method 8
 * (deflate), a CRC-32 of the uncompressed bytes and one fixed DOS timestamp, so the archive bytes
 * only change when the inputs do. Flag bit 11 marks names as UTF-8. No ZIP64: the kit is small.
 */
function zip(entries) {
  // DOS date/time for 2026-01-01 00:00:00: ((year - 1980) << 9) | (month << 5) | day, time 0.
  const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const DOS_TIME = 0;
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed: 2.0 (deflate)
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra field length
    locals.push(local, nameBuf, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    // Extra length, comment length, disk number, internal and external attributes stay 0.
    central.writeUInt32LE(offset, 42); // offset of the local header
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); // entries on this disk
  end.writeUInt16LE(entries.length, 10); // entries in total
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16); // central directory offset
  return Buffer.concat([...locals, directory, end]);
}

// ---------------------------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------------------------

/** Width and height of an SVG from its viewBox, scaled so the long side is PNG_SIZE. */
function pngSize(svg) {
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
  if (!vb || vb.length !== 4) throw new Error("SVG without a viewBox");
  const [, , w, h] = vb;
  const scale = PNG_SIZE / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function renderPngs(browser, origin, svgs) {
  mkdirSync(PNG_DIR, { recursive: true });
  await browser.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await browser.open(`${origin}/__render`);
  for (const file of svgs) {
    const { width, height } = pngSize(readFileSync(join(OUT, file), "utf8"));
    await browser.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await browser.send("Runtime.evaluate", {
      expression: `(async () => {
        document.body.innerHTML = "";
        const img = new Image(${width}, ${height});
        img.src = ${JSON.stringify(`/__src/${file}`)};
        document.body.append(img);
        await img.decode();
        await document.fonts.ready;
      })()`,
      awaitPromise: true,
    });
    const { data } = await browser.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
    writeFileSync(join(PNG_DIR, file.replace(/\.svg$/, ".png")), Buffer.from(data, "base64"));
    console.log(`  png  ${file.replace(/\.svg$/, ".png")}  ${width}×${height}`);
  }
  await browser.send("Emulation.clearDeviceMetricsOverride");
  await browser.send("Emulation.setDefaultBackgroundColorOverride", {});
}

async function printPdfs(browser, origin) {
  for (const { code, path } of LOCALES) {
    await browser.open(`${origin}${path}`);
    const { data } = await browser.send("Page.printToPDF", {
      paperWidth: 8.27, // A4 in inches
      paperHeight: 11.69,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    writeFileSync(join(OUT, pdfName(code)), Buffer.from(data, "base64"));
    console.log(`  pdf  ${pdfName(code)}`);
  }
}

function readme() {
  return [
    "Kalea brand kit",
    "===============",
    "",
    "Kalea is Basque for \"the street\". The mark is a street between two buildings whose silhouette forms a crown.",
    "",
    "Contents",
    "  logo/svg, logo/png        Lockups, marks, app icon and favicon (PNG: transparent, 1024 px long side).",
    "  elements/svg, elements/png  Street perspective, crown pattern tile and street plate.",
    "  tokens.json               Colors, fonts and radii. Take values from here, not from screenshots.",
    "  kalea-brand-guidelines-*.pdf  The full guide in English, Spanish and Brazilian Portuguese.",
    "",
    "Quick rules",
    "  - Use kalea-lockup on light backgrounds, kalea-lockup-on-dark on Ocean, Deep or dark photos.",
    "  - Clear space: half the mark height on every side. Minimum size: mark 16 px tall, lockup 80 px wide.",
    "  - Do not recolor, stretch, rotate or add effects to the logo, and do not redraw the mark.",
    "  - Apricot (#EE9E4F) is never used for text on white.",
    "",
    "Online guide: the /brand/ page on the Kalea website.",
    "Source: https://github.com/Zer0-Knowledge-Hack/KALEA/tree/main/brand",
    "Questions and co-branding: https://github.com/Zer0-Knowledge-Hack/KALEA/issues",
    "",
  ].join("\r\n");
}

function writeZip(svgs) {
  const isElement = (f) => !f.startsWith("kalea-") && f !== "favicon.svg";
  const entries = [];
  for (const group of ["logo", "elements"]) {
    const files = svgs.filter((f) => (group === "elements") === isElement(f));
    for (const f of files) entries.push({ name: `${group}/svg/${f}`, data: readFileSync(join(OUT, f)) });
    for (const f of files) {
      const png = f.replace(/\.svg$/, ".png");
      entries.push({ name: `${group}/png/${png}`, data: readFileSync(join(PNG_DIR, png)) });
    }
  }
  entries.push({ name: "tokens.json", data: readFileSync(join(ROOT, "brand", "tokens.json")) });
  for (const { code } of LOCALES) entries.push({ name: pdfName(code), data: readFileSync(join(OUT, pdfName(code))) });
  entries.push({ name: "README.txt", data: Buffer.from(readme(), "utf8") });
  writeFileSync(join(OUT, ZIP_NAME), zip(entries));
  console.log(`  zip  ${ZIP_NAME}  ${entries.length} entries`);
}

function writeManifest() {
  const files = [ZIP_NAME, ...LOCALES.map(({ code }) => pdfName(code))];
  const sizes = Object.fromEntries(files.map((f) => [f, statSync(join(OUT, f)).size]));
  writeFileSync(MANIFEST, `${JSON.stringify({ $description: "Generated by scripts/brand-kit.mjs. Byte sizes of the downloadable brand files.", sizes }, null, 2)}\n`);
  return sizes;
}

// ---------------------------------------------------------------------------------------------

if (process.argv.includes("--build")) {
  const r = spawnSync("pnpm", ["--filter", "@kalea/web", "build"], { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) fail("web build failed.");
}
if (!LOCALES.every(({ path }) => existsSync(join(DIST, path, "index.html")))) {
  fail("apps/web/dist has no brand pages. Run `pnpm --filter @kalea/web build` first, or pass --build.");
}

// Sorted so the PNG order, the ZIP order and the ZIP bytes are stable across runs.
const svgs = readdirSync(OUT).filter((f) => f.endsWith(".svg")).sort();
const { server, origin } = await serveDist();
const browser = await launchBrowser();
try {
  console.log("brand-kit: rendering");
  await renderPngs(browser, origin, svgs);
  await printPdfs(browser, origin);
  writeZip(svgs);
  const sizes = writeManifest();
  for (const [f, s] of Object.entries(sizes)) console.log(`  size ${f}  ${(s / 1024).toFixed(0)} KB`);
  console.log("brand-kit: done. Rebuild the web app so dist serves the new files.");
} finally {
  browser.close();
  server.close();
}
