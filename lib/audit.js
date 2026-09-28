// After every build: check each generated HTML page against the tech-SEO checklist and write
// _site/admin/seo-report.html (open it at /admin/seo-report.html). Never fails the build.
import fs from "node:fs";
import path from "node:path";
import { auditPost, score, AI_BOTS, LIMITS } from "../src/admin/seo-core.js";
import { postData } from "./seo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const decode = (s) => String(s ?? "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (s) => decode(String(s ?? "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const len = (s) => Array.from(s).length;
const meta = (html, attr, name) => {
  const m = html.match(new RegExp(`<meta[^>]+${attr}="${name}"[^>]*>`, "i"));
  const c = m && m[0].match(/content="([^"]*)"/i);
  return c ? decode(c[1]) : null;
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "admin") walk(p, out); }
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

function exists(outDir, href) {
  const clean = href.split(/[?#]/)[0];
  if (!clean || clean === "/") return true;
  const p = path.join(outDir, decodeURIComponent(clean));
  return fs.existsSync(clean.endsWith("/") ? path.join(p, "index.html") : p) || fs.existsSync(path.join(p, "index.html"));
}

function checkPage(html, rel, outDir, redirects) {
  const r = [];
  const add = (label, status, detail) => r.push({ label, status, detail });
  const title = text((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
  const desc = meta(html, "name", "description") || "";
  const robots = meta(html, "name", "robots") || "";
  const noindex = /noindex/.test(robots);
  const tl = len(title), dl = len(desc);
  const inRange = (n, [a, b], [sa, sb]) => (n >= a && n <= b ? "pass" : n >= sa && n <= sb ? "warn" : "fail");
  // noindex pages (tags, 404, thin posts) never show in search, so their lengths are not scored.
  add("title", noindex ? "info" : inRange(tl, LIMITS.title, LIMITS.titleSoft), `${tl}자 · ${title}`);
  add("description", noindex ? "info" : inRange(dl, LIMITS.desc, LIMITS.descSoft), `${dl}자`);
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  add("H1 1개", h1 === 1 ? "pass" : "fail", `${h1}개`);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/gi)].map((m) => +m[1]);
  const skip = levels.some((l, i) => i && l > levels[i - 1] + 1);
  add("H 위계", skip ? "warn" : "pass", skip ? `건너뜀: ${levels.join("→")}` : "정상");
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const noAlt = imgs.filter((t) => !/\balt=/i.test(t)).length;
  const emptyAlt = imgs.filter((t) => /\balt=""/i.test(t)).length;
  add("img alt", noAlt ? "fail" : "pass", `${imgs.length}개 · alt 없음 ${noAlt} · 장식용(alt="") ${emptyAlt}`);
  const notOpt = imgs.filter((t) => { const s = (t.match(/\bsrc="([^"]*)"/) || [])[1] || ""; return s && !/\.(webp|avif|svg)(\?|$)/i.test(s) && !s.startsWith("data:"); });
  add("WebP/AVIF", notOpt.length ? "warn" : "pass", notOpt.length ? `${notOpt.length}개 미변환` : "전부 변환");
  const canon = (html.match(/<link rel="canonical" href="([^"]*)"/i) || [])[1];
  add("canonical", noindex ? "info" : canon ? "pass" : "fail", noindex ? "noindex 페이지" : canon || "없음");
  add("robots", noindex ? "info" : "pass", robots || "(기본)");
  const og = ["og:title", "og:description", "og:image", "og:url"].filter((k) => !meta(html, "property", k));
  add("OG 태그", og.length ? "fail" : "pass", og.length ? `없음: ${og.join(", ")}` : "4개 모두");
  const ldTypes = [];
  let ldErr = 0;
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      for (const n of j["@graph"] || [j]) ldTypes.push(n["@type"]);
    } catch { ldErr++; }
  }
  add("JSON-LD", ldErr ? "fail" : ldTypes.length ? "pass" : "fail", ldErr ? `${ldErr}개 파싱 오류` : ldTypes.join(", "));
  const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map((m) => decode(m[1]));
  const broken = [...new Set(hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//") && !exists(outDir, h) && !redirects.has(h.split(/[?#]/)[0])))];
  const http = [...new Set(hrefs.filter((h) => /^http:\/\//i.test(h)))];
  add("깨진 내부 링크", broken.length ? "fail" : "pass", broken.length ? broken.join(", ") : `${hrefs.length}개 링크 정상`);
  add("HTTPS 링크", http.length ? "warn" : "pass", http.length ? http.join(", ") : "정상");
  const bodyText = text(html.replace(/<(script|style|header|footer|nav)[\s\S]*?<\/\1>/gi, ""));
  add("SSG 본문", len(bodyText) > 200 ? "pass" : noindex ? "info" : "warn", `JS 없이 읽히는 글자 ${len(bodyText)}자`);
  return { url: "/" + rel.replace(/\\/g, "/").replace(/index\.html$/, ""), title, noindex, checks: r };
}

function siteChecks(outDir, site) {
  const r = [];
  const add = (label, status, detail) => r.push({ label, status, detail });
  const read = (f) => { try { return fs.readFileSync(path.join(outDir, f), "utf8"); } catch { return null; } };
  const robots = read("robots.txt");
  add("robots.txt", robots && !/^Disallow:\s*\/\s*$/m.test(robots.split(/User-agent:\s*\*/i)[1]?.split(/User-agent:/i)[0] || "") ? "pass" : "fail", robots ? "검색엔진 전체 허용" : "없음");
  const blocked = AI_BOTS.filter((b) => !new RegExp(`User-agent:\\s*${b}\\s*\\n(User-agent:.*\\n)*Allow:\\s*/`, "i").test(robots || ""));
  add("AI 크롤러 명시적 허용", blocked.length ? "fail" : "pass", blocked.length ? `허용 안 됨: ${blocked.join(", ")}` : AI_BOTS.join(", "));
  const llms = read("llms.txt");
  add("llms.txt", llms && llms.startsWith("# ") ? "pass" : "fail", llms ? `${llms.split("\n").length}줄` : "없음");
  const sm = read("sitemap.xml");
  add("sitemap.xml", sm ? "pass" : "fail", sm ? `URL ${(sm.match(/<loc>/g) || []).length}개` : "없음");
  const feed = read("feed.xml");
  add("RSS (feed.xml)", feed ? "pass" : "fail", feed ? `글 ${(feed.match(/<item>/g) || []).length}개` : "없음");
  add("404 페이지", read("404.html") ? "pass" : "fail", "/404.html");
  const redir = read("_redirects");
  add("301 리다이렉트", redir != null ? "pass" : "warn", redir != null ? `${redir.split("\n").filter((l) => l.trim() && !l.startsWith("#")).length}개 규칙` : "없음");
  add("네이버 서치어드바이저 인증", site.seo.naver_verification ? "pass" : "fail", site.seo.naver_verification ? "메타태그 삽입됨" : "관리자 › 사이트 설정 › 검색엔진 · AI에 인증 코드를 넣으세요");
  add("구글 서치콘솔 인증", site.seo.google_verification ? "pass" : "warn", site.seo.google_verification ? "메타태그 삽입됨" : "DNS로 인증했다면 비워도 돼요");
  const o = site.publisher || {};
  const missing = [["회사명", o.name], ["대표자", o.ceo], ["설립일", o.founded], ["주소", o.address], ["이메일", o.email]].filter(([, v]) => !v || /^(회사명|(주)회사명|대표자명)$/.test(v)).map(([k]) => k);
  add("엔티티 정보 (운영 주체)", missing.length ? "warn" : "pass", missing.length ? `미입력: ${missing.join(", ")} — 관리자 › 사이트 설정 › 운영 주체` : `${o.name} · 대표 ${o.ceo} · 설립 ${o.founded}`);
  add("사이트 주소", /example.com/.test(site.url) ? "fail" : "pass", /example.com/.test(site.url) ? "관리자 › 사이트 설정에서 실제 도메인으로 바꾸세요" : site.url);
  return r;
}

const ICON = { pass: "✅", warn: "⚠️", fail: "❌", info: "ℹ️" };

export function runAudit({ outDir = "_site", site, authors, categories, posts }) {
  const redirects = new Set();
  try {
    for (const l of fs.readFileSync(path.join(outDir, "_redirects"), "utf8").split("\n")) if (l.trim() && !l.startsWith("#")) redirects.add(l.trim().split(/\s+/)[0]);
  } catch {}
  const pages = walk(outDir).map((f) => checkPage(fs.readFileSync(f, "utf8"), path.relative(outDir, f), outDir, redirects))
    .filter((p) => p.url !== "/404.html").sort((a, b) => a.url.localeCompare(b.url));
  const sc = siteChecks(outDir, site);
  const opts = { siteUrl: site.url, suffix: site.seo.title_suffix, defaultOg: site.seo.og_image, thinMin: site.seo.thin_min_chars,
    authors: authors.items || [], categories: categories.items || [] };
  const postAudits = posts.map((p) => {
    const res = auditPost({ ...postData(p), slug: p.page.fileSlug }, opts);
    return { title: p.data.title, url: p.url, score: score(res), res };
  });

  const count = (list) => list.reduce((c, x) => ((c[x.status] = (c[x.status] || 0) + 1), c), {});
  const all = [...sc, ...pages.flatMap((p) => p.checks)];
  const tot = count(all);
  const u = site.url;
  const row = (x) => `<tr class="${x.status}"><td>${ICON[x.status]}</td><td>${esc(x.label)}</td><td>${esc(x.detail)}</td></tr>`;
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>SEO 점검 리포트</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
body{margin:0;background:#f5f5f7;color:#1d1d1f;font:15px/1.6 Pretendard,system-ui,sans-serif}
main{max-width:1080px;margin:0 auto;padding:40px 16px 80px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:40px 0 12px}h3{font-size:16px;margin:24px 0 8px}
.muted{color:#6e6e73}.card{background:#fff;border-radius:14px;padding:18px 20px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.05)}
table{width:100%;border-collapse:collapse}td{padding:7px 8px;border-top:1px solid #eee;vertical-align:top;word-break:break-all}
td:first-child{width:28px}td:nth-child(2){width:210px;font-weight:600;word-break:keep-all}
tr.fail td{background:#fff4f4}tr.warn td{background:#fffbea}
.sum{display:flex;gap:10px;flex-wrap:wrap}.sum b{font-size:22px;display:block}.sum div{background:#fff;border-radius:12px;padding:12px 18px}
.score{float:right;font-size:22px;font-weight:700}a{color:#0066cc}ol li{margin:6px 0}
details summary{cursor:pointer;font-weight:600}
</style></head><body><main>
<h1>SEO · AEO · GEO 점검 리포트</h1>
<p class="muted">빌드 시각 ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · 글을 저장하면 1~2분 뒤 자동으로 다시 만들어져요.</p>
<div class="sum"><div><b>${tot.pass || 0}</b>통과</div><div><b>${tot.warn || 0}</b>주의</div><div><b>${tot.fail || 0}</b>미흡</div><div><b>${pages.length}</b>페이지</div><div><b>${posts.length}</b>블로그 글</div></div>

<h2>8. 발행 후 검증 순서</h2>
<div class="card"><ol>
<li><a href="${u}/robots.txt" target="_blank">robots.txt</a> · <a href="${u}/llms.txt" target="_blank">llms.txt</a> · <a href="${u}/sitemap.xml" target="_blank">sitemap.xml</a> · <a href="${u}/feed.xml" target="_blank">feed.xml</a> 열리는지 확인</li>
<li><a href="https://search.google.com/test/rich-results?url=${encodeURIComponent(u + "/")}" target="_blank">Rich Results Test</a> · <a href="https://validator.schema.org/#url=${encodeURIComponent(u + "/")}" target="_blank">Schema.org Validator</a> — 각 글 링크는 아래 글별 점검에 있어요</li>
<li><a href="https://pagespeed.web.dev/analysis?url=${encodeURIComponent(u + "/")}&form_factor=mobile" target="_blank">PageSpeed Insights (모바일)</a> — LCP &lt; 2.5초 · INP &lt; 200ms · CLS &lt; 0.1</li>
<li><a href="https://searchadvisor.naver.com/" target="_blank">네이버 서치어드바이저</a> 사이트맵(${u}/sitemap.xml)·RSS(${u}/feed.xml) 제출 → 수집 요청 · <a href="https://search.google.com/search-console" target="_blank">Google Search Console</a> 사이트맵 제출</li>
<li>샘플 글 3개를 ChatGPT · Perplexity · 구글 AI 개요에 질문해 인용되는지 확인</li>
</ol></div>

<h2>사이트 전체 (1 · 5)</h2>
<div class="card"><table>${sc.map(row).join("")}</table></div>

<h2>블로그 글별 점검 (2 · 3 · 6 · 7)</h2>
${postAudits.map((p) => `<div class="card"><span class="score">${p.score}점</span><h3><a href="${esc(p.url)}" target="_blank">${esc(p.title)}</a></h3>
<p class="muted"><a href="https://search.google.com/test/rich-results?url=${encodeURIComponent(u + p.url)}" target="_blank">Rich Results Test</a> · <a href="https://validator.schema.org/#url=${encodeURIComponent(u + p.url)}" target="_blank">Schema Validator</a> · <a href="https://pagespeed.web.dev/analysis?url=${encodeURIComponent(u + p.url)}&form_factor=mobile" target="_blank">PageSpeed</a></p>
<table>${p.res.map((x) => row({ ...x, label: `${x.group.split(" ")[0]} ${x.label}` })).join("")}</table></div>`).join("")}

<h2>페이지별 HTML 점검</h2>
${pages.map((p) => { const c = count(p.checks); return `<details class="card"${c.fail ? " open" : ""}><summary>${c.fail ? "❌" : c.warn ? "⚠️" : "✅"} ${esc(p.url)} <span class="muted">${esc(p.title)}${p.noindex ? " · noindex" : ""}</span></summary><table>${p.checks.map(row).join("")}</table></details>`; }).join("")}
</main></body></html>`;
  fs.mkdirSync(path.join(outDir, "admin"), { recursive: true });
  fs.writeFileSync(path.join(outDir, "admin", "seo-report.html"), html);
  console.log(`[SEO 점검] 통과 ${tot.pass || 0} · 주의 ${tot.warn || 0} · 미흡 ${tot.fail || 0} → /admin/seo-report.html`);
  for (const x of all.filter((x) => x.status === "fail")) console.log(`  ❌ ${x.label}: ${x.detail}`);
}
