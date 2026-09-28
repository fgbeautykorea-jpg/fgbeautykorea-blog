// Builds the brand images in src/assets from the official logo (tools/brand/fg-logo-source.png).
// Run: node tools/make-images.mjs   (Windows fonts are used for the Korean text on thumbnails)
import sharp from "sharp";
import fs from "node:fs";

const SRC = "tools/brand/fg-logo-source.png";
const BG = "#fbfaf7"; // warm off-white, same as the site background
const INK = "#1f1f1f";
const TEAL = "#5fc0c8";

// 1) Full logo, blank margins trimmed (used on thumbnails and the about page).
const trimmed = await sharp(SRC).flatten({ background: "#ffffff" }).trim({ threshold: 20 }).raw().toBuffer({ resolveWithObject: true });
// White → transparent (soft edge), so the logo sits on any background without a white box.
const px = Buffer.alloc(trimmed.info.width * trimmed.info.height * 4);
for (let i = 0, j = 0; i < trimmed.data.length; i += trimmed.info.channels, j += 4) {
  const [r, g, b] = [trimmed.data[i], trimmed.data[i + 1], trimmed.data[i + 2]];
  const light = Math.min(r, g, b);
  px[j] = r; px[j + 1] = g; px[j + 2] = b;
  px[j + 3] = light > 245 ? 0 : light > 200 ? Math.round(((245 - light) / 45) * 255) : 255;
}
const full = await sharp(px, { raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 } }).png().toBuffer();
await sharp(full).toFile("src/assets/logo-full.png");
const { width: fw, height: fh } = await sharp(full).metadata();

// 2) Header logo: the word mark without the small tagline line underneath.
const mark = await sharp(full).extract({ left: 0, top: 0, width: fw, height: Math.round(fh * 0.86) }).trim({ threshold: 20 }).png().toBuffer();
await sharp(mark).resize({ height: 120 }).png().toFile("src/assets/logo.png");

// 3) Favicon: thin "FG" in the logo's style.
const fav = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="24" fill="${BG}"/>
<text x="64" y="84" text-anchor="middle" font-family="Segoe UI Light, Segoe UI, Arial" font-weight="300" font-size="62" fill="${INK}">FG</text>
<rect x="30" y="98" width="68" height="4" fill="${TEAL}"/></svg>`;
await sharp(Buffer.from(fav)).png().toFile("src/assets/favicon.png");

// 4) Default share image / card thumbnail: logo centred on off-white.
const logoForOg = await sharp(full).resize({ height: 380 }).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: BG } })
  .composite([{ input: logoForOg, gravity: "center" }]).png({ compressionLevel: 9 }).toFile("src/assets/og-default.png");

// 5) Per-post "lab note" thumbnails: node tools/make-images.mjs writes one for every entry below.
const notes = [
  { file: "src/assets/uploads/lab-001-niacinamide.png", no: "LAB NOTE 001", en: "Niacinamide × Cheonnyeoncho", ko: "나이아신아마이드 × 천년초", sub: "강화와 회복, 두 성분의 역할 나누기" },
];
const smallLogo = await sharp(full).resize({ height: 120 }).png().toBuffer();
fs.mkdirSync("src/assets/uploads", { recursive: true });
for (const n of notes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${BG}"/>
  <g stroke="#e8e6e1" stroke-width="1">${Array.from({ length: 20 }, (_, i) => `<line x1="${60 * i}" y1="0" x2="${60 * i}" y2="630"/>`).join("")}${Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${60 * i}" x2="1200" y2="${60 * i}"/>`).join("")}</g>
  <text x="80" y="118" font-family="Consolas, monospace" font-size="26" letter-spacing="4" fill="${TEAL}">${n.no}</text>
  <text x="80" y="250" font-family="Segoe UI Light, Segoe UI, Arial" font-weight="300" font-size="64" fill="${INK}">${n.en}</text>
  <text x="80" y="350" font-family="Malgun Gothic, sans-serif" font-weight="700" font-size="60" fill="${INK}">${n.ko}</text>
  <rect x="80" y="392" width="120" height="4" fill="${TEAL}"/>
  <text x="80" y="450" font-family="Malgun Gothic, sans-serif" font-size="32" fill="#6b6b6b">${n.sub}</text>
</svg>`;
  await sharp(Buffer.from(svg)).composite([{ input: smallLogo, left: 1200 - 80 - Math.round((fw / fh) * 120), top: 630 - 80 - 120 }])
    .png({ compressionLevel: 9 }).toFile(n.file);
}
console.log("images ok");
