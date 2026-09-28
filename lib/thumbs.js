// "LAB NOTE" thumbnails, drawn at build time for every post that has no uploaded 대표 이미지.
// Text comes from the admin fields (연구일지 번호 · 썸네일 영문/한글/한 줄). Fonts ship in node_modules
// (pretendard) so Netlify's servers — which have no Korean fonts — draw the same image as this PC.
// Output: _site/img/thumbs/<slug>.webp (cards, cover) and .jpg (Kakao/SNS share image), 1200×630.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

const FONT_DIR = "node_modules/pretendard/dist/public/static";
const FONTS = ["Pretendard-Light.otf", "Pretendard-Regular.otf", "Pretendard-Medium.otf", "Pretendard-Bold.otf"].map((f) => path.join(FONT_DIR, f));
const W = 1200, H = 630;
const BG = "#fbfaf7", INK = "#1f1f1f", TEAL = "#5fc0c8", TEAL_INK = "#3aa3ad", GREY = "#6b6b6b", GRID = "#ebe8e2";
const VERSION = "1"; // bump to force every thumbnail to be redrawn after a design change

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const width = (s, size, ratio) => Array.from(String(s)).reduce((w, ch) => w + (/[ㄱ-힝]/.test(ch) ? 1 : ratio) * size, 0);
const fit = (s, max, maxW, ratio) => { let size = max; while (size > 28 && width(s, size, ratio) > maxW) size -= 2; return size; };
const cut = (s, n) => (Array.from(String(s)).length > n ? Array.from(String(s)).slice(0, n - 1).join("") + "…" : String(s));

export const labLabel = (n) => (n ? `LAB NOTE ${String(n).padStart(3, "0")}` : "LAB NOTE");

// Lab numbers: the admin's 연구일지 번호, or — when empty — the post's place in publishing order.
export function labNumbers(posts) {
  const byDate = [...posts].sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.slug).localeCompare(b.slug));
  const map = new Map();
  byDate.forEach((p, i) => map.set(p.slug, Number(p.lab_no) || i + 1));
  return map;
}

export function thumbSvg({ no, en, ko, sub }, logoDataUri) {
  const koSize = fit(ko, 64, 1040, 0.62);
  const enSize = en ? fit(en, 62, 1040, 0.52) : 0;
  const top = en ? 240 : 250;
  const grid = [
    ...Array.from({ length: 21 }, (_, i) => `<line x1="${60 * i}" y1="0" x2="${60 * i}" y2="${H}"/>`),
    ...Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${60 * i}" x2="${W}" y2="${60 * i}"/>`),
  ].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g stroke="${GRID}" stroke-width="1">${grid}</g>
  <text x="80" y="118" font-family="Pretendard" font-weight="500" font-size="26" letter-spacing="5" fill="${TEAL_INK}">${esc(labLabel(no))}</text>
  ${en ? `<text x="80" y="${top}" font-family="Pretendard" font-weight="300" font-size="${enSize}" fill="${INK}">${esc(en)}</text>` : ""}
  <text x="80" y="${top + (en ? 100 : 40)}" font-family="Pretendard" font-weight="700" font-size="${koSize}" fill="${INK}">${esc(ko)}</text>
  <rect x="80" y="${top + (en ? 142 : 82)}" width="120" height="4" fill="${TEAL}"/>
  ${sub ? `<text x="80" y="${top + (en ? 200 : 140)}" font-family="Pretendard" font-weight="400" font-size="32" fill="${GREY}">${esc(cut(sub, 34))}</text>` : ""}
  ${logoDataUri ? `<image x="${W - 80 - 170}" y="${H - 70 - 130}" width="170" height="130" preserveAspectRatio="xMaxYMax meet" xlink:href="${logoDataUri}"/>` : ""}
</svg>`;
}

// Called from eleventy.config.js (eleventy.before). Only redraws thumbnails whose text changed.
export async function buildThumbs({ postsDir = "src/posts", outDir = "_site/img/thumbs", logo = "src/assets/logo-full.png" } = {}) {
  if (!fs.existsSync(FONTS[0])) { console.warn("[썸네일] 글꼴이 없어 건너뜀 (npm install 필요)"); return; }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(".cache", "thumbs"), { recursive: true });
  const logoUri = fs.existsSync(logo) ? `data:image/png;base64,${fs.readFileSync(logo).toString("base64")}` : "";
  const posts = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md")).map((f) => {
    const { data } = matter(fs.readFileSync(path.join(postsDir, f), "utf8"));
    return { ...data, slug: f.replace(/\.md$/, "") };
  });
  const nums = labNumbers(posts);
  let made = 0;
  for (const p of posts) {
    if (p.thumb_image) continue;
    const spec = { no: nums.get(p.slug), en: String(p.thumb_en || "").trim(), ko: String(p.thumb_ko || p.keyword || p.title || "").trim(), sub: String(p.thumb_sub || "").trim() };
    const hash = crypto.createHash("md5").update(VERSION + JSON.stringify(spec) + logoUri.length).digest("hex").slice(0, 10);
    const stamp = path.join(".cache", "thumbs", `${p.slug}.hash`); // local only, never published
    if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === hash && fs.existsSync(path.join(outDir, `${p.slug}.jpg`))) continue;
    const png = new Resvg(thumbSvg(spec, logoUri), {
      fitTo: { mode: "width", value: W },
      font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Pretendard" },
    }).render().asPng();
    await sharp(png).webp({ quality: 88 }).toFile(path.join(outDir, `${p.slug}.webp`));
    await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(outDir, `${p.slug}.jpg`));
    fs.writeFileSync(stamp, hash);
    made++;
  }
  if (made) console.log(`[썸네일] ${made}개 새로 그림 → /img/thumbs/`);
}
