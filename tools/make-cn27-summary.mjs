// One-off: CN27 연구노트 3부작 요약 인포그래픽 (src/assets/uploads/cn27/fig4-summary.png).
// Values are exactly those in the research notes (2부 실측표, 3부 관찰). Run: node tools/make-cn27-summary.mjs
import fs from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const FONT_DIR = "node_modules/pretendard/dist/public/static";
const fonts = ["Light", "Regular", "Medium", "Bold"].map((w) => `${FONT_DIR}/Pretendard-${w}.otf`);
const W = 1600, H = 900, INK = "#1f1f1f", TEAL = "#5fc0c8", TEAL_INK = "#1d7a84", GREY = "#6b6b6b", LINE = "#e7e4de";

const cards = [
  { step: "01 · 접촉각", note: "1부 개념 · 2부 실측", big: "8°", vs: ["히알루론산 65°", "글리세린 60°", "일반 선인장 추출물 68°"], desc: "표면 위에 얇고 넓게 퍼짐 (젖음성 높음)" },
  { step: "02 · 표면장력", note: "2부 실측", big: "25", unit: "mN/m", vs: ["히알루론산 52~56 mN/m", "글리세린 65 mN/m", "일반 선인장 추출물 46 mN/m"], desc: "비교 원료 중 가장 낮은 값" },
  { step: "03 · 유화 안정성", note: "3부 관찰", big: "미세 분산", vs: ["히알루론산 · 글리세린 용액은", "오일이 큰 액적으로 남아 떠다님"], desc: "오일 0.5% 분산 후 광학현미경 관찰" },
];

const cw = 440, gap = 40, x0 = (W - (cw * 3 + gap * 2)) / 2, y0 = 230, ch = 540;
const card = (c, i) => {
  const x = x0 + i * (cw + gap);
  const bigSize = c.big.length > 3 ? 64 : 120;
  return `<g>
  <rect x="${x}" y="${y0}" width="${cw}" height="${ch}" rx="20" fill="#ffffff" stroke="${LINE}"/>
  <rect x="${x}" y="${y0}" width="${cw}" height="6" rx="3" fill="${TEAL}"/>
  <text x="${x + 36}" y="${y0 + 66}" font-family="Pretendard" font-weight="700" font-size="30" fill="${INK}">${c.step}</text>
  <text x="${x + 36}" y="${y0 + 104}" font-family="Pretendard" font-weight="500" font-size="22" fill="${TEAL_INK}">${c.note}</text>
  <text x="${x + 36}" y="${y0 + 250}" font-family="Pretendard" font-weight="700" font-size="${bigSize}" fill="${INK}">${c.big}${c.unit ? `<tspan font-size="40" font-weight="500" fill="${GREY}" dx="12">${c.unit}</tspan>` : ""}</text>
  <text x="${x + 36}" y="${y0 + 296}" font-family="Pretendard" font-weight="500" font-size="22" fill="${TEAL_INK}">CN27 천년초 추출액</text>
  <line x1="${x + 36}" y1="${y0 + 330}" x2="${x + cw - 36}" y2="${y0 + 330}" stroke="${LINE}" stroke-width="2"/>
  <text x="${x + 36}" y="${y0 + 370}" font-family="Pretendard" font-weight="500" font-size="19" letter-spacing="2" fill="${GREY}">비교</text>
  ${c.vs.map((v, k) => `<text x="${x + 36}" y="${y0 + 404 + k * 32}" font-family="Pretendard" font-weight="400" font-size="22" fill="${GREY}">${v}</text>`).join("")}
  <text x="${x + 36}" y="${y0 + 504}" font-family="Pretendard" font-weight="500" font-size="23" fill="${INK}">${c.desc}</text>
</g>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fbfaf7"/>
<text x="${W / 2}" y="100" text-anchor="middle" font-family="Pretendard" font-weight="500" font-size="24" letter-spacing="6" fill="${TEAL_INK}">CN27 RESEARCH NOTES · SUMMARY</text>
<text x="${W / 2}" y="170" text-anchor="middle" font-family="Pretendard" font-weight="700" font-size="52" fill="${INK}">천년초 저온감압 추출액(CN27) 3부작 요약</text>
${cards.map(card).join("\n")}
<text x="${W / 2}" y="${H - 50}" text-anchor="middle" font-family="Pretendard" font-weight="400" font-size="22" fill="${GREY}">접촉각·표면장력 측정과 광학현미경 관찰로 얻은 물성 데이터이며, 피부에서의 임상적 효능을 의미하지 않습니다.</text>
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Pretendard" } }).render().asPng();
fs.writeFileSync("src/assets/uploads/cn27/fig4-summary.png", png);
console.log("summary ok");
