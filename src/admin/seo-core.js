// SEO / AEO / GEO rules for blog posts, shared by the Eleventy build (lib/seo.js, audit report) and
// the live checker in the /admin editor (seo-preview.js). Works on the raw Markdown an editor writes,
// so the admin can score a draft before it is saved. Keep this file dependency-free (runs in the browser).
// Checklist source: 블로그_SEO_GEO_기술스펙.md (sections 1–8).

export const LIMITS = {
  title: [50, 60], titleSoft: [30, 70], // <title> characters
  desc: [120, 150], descSoft: [80, 170], // meta description characters
  answer: [40, 60], answerSoft: [25, 80], // words (어절) in the answer paragraph that opens each H2 section
  sectionMax: 1500, // characters in one H2 section before suggesting a split
  thinMin: 800, // characters of body text below which a post is thin content (auto noindex)
};

export const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended",
];

export const ROBOTS = ["", "index, follow", "noindex, follow", "noindex, nofollow"]; // "" = 자동

const len = (s) => Array.from(String(s ?? "").trim()).length;
export const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean).length;

// Markdown lines outside ``` code fences.
function lines(md) {
  let fence = false;
  return String(md ?? "").split(/\r?\n/).filter((l) => {
    if (/^\s*```/.test(l)) { fence = !fence; return false; }
    return !fence;
  });
}

export function plainText(md) {
  return String(md ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*(#{1,6}|[-*+]|\d+[.)]|>)\s*/gm, "")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/[*_`~]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export const bodyChars = (md) => plainText(md).replace(/\s+/g, "").length;

export function headings(md) {
  return lines(md)
    .map((l) => l.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/))
    .filter(Boolean)
    .map((m) => ({ level: m[1].length, text: plainText(m[2]) }));
}

// H2 sections: [{ title, body }] (text before the first H2 has title "").
export function sections(md) {
  const out = [{ title: "", body: [] }];
  for (const l of lines(md)) {
    const m = l.match(/^##\s+(.+)/);
    if (m) out.push({ title: plainText(m[1]), body: [] });
    else out[out.length - 1].body.push(l);
  }
  return out.map((s) => ({ title: s.title, body: s.body.join("\n") })).filter((s) => s.title || s.body.trim());
}

const blocks = (md) => String(md ?? "").split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean);
const isProse = (b) => !/^(#|!\[|\||```|[-*+]\s|\d+[.)]\s|>|<)/.test(b);

// First prose paragraph of an H2 section (null when the section opens with a list, table or H3).
export function answerBlock(sectionBody) {
  const b = blocks(sectionBody)[0];
  return b && isProse(b) ? plainText(b) : null;
}

export const firstParagraph = (md) => plainText(blocks(md).find(isProse) || "");

export function images(md) {
  const out = [];
  for (const m of String(md ?? "").matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push({ alt: m[1].trim(), src: m[2] });
  for (const m of String(md ?? "").matchAll(/<img\b[^>]*>/gi)) {
    const alt = m[0].match(/\balt\s*=\s*"([^"]*)"/i);
    const src = m[0].match(/\bsrc\s*=\s*"([^"]*)"/i);
    out.push({ alt: alt ? alt[1].trim() : "", src: src ? src[1] : "" });
  }
  return out;
}

export function links(md) {
  return [...String(md ?? "").matchAll(/(?<!!)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?/g)].map((m) => ({ text: m[1], href: m[2] }));
}

const QUESTION = /([?？]|까|나요|가요|죠|을까요|ㄹ까요)\s*$/;
export const isQuestion = (s) => QUESTION.test(String(s ?? "").trim());

// "### 질문?" headings and the text under them (until the next heading) → FAQPage entries.
export function extractFaq(md) {
  const out = [];
  let cur = null;
  for (const l of lines(md)) {
    const h = l.match(/^(#{1,6})\s+(.+)/);
    if (h) {
      if (cur) out.push(cur);
      const q = plainText(h[2]);
      cur = h[1].length === 3 && isQuestion(q) ? { q, a: [] } : null;
    } else if (cur) cur.a.push(l);
  }
  if (cur) out.push(cur);
  return out.map((f) => ({ q: f.q, a: plainText(f.a.join("\n")).replace(/\s*\n\s*/g, " ") })).filter((f) => f.a);
}

// An H2 like "…하는 방법 / 순서 / 단계 / 절차" followed by a numbered list → HowTo steps.
export const HOWTO_RE = /(방법|순서|단계|절차|하는 법|따라\s?하기|how\s?to)/i;
export function extractHowTo(md) {
  for (const s of sections(md)) {
    if (!HOWTO_RE.test(s.title)) continue;
    const steps = s.body.split(/\r?\n/).map((l) => l.match(/^\s*\d+[.)]\s+(.+)/)).filter(Boolean).map((m) => plainText(m[1]));
    if (steps.length >= 2) return { name: s.title, steps };
  }
  return null;
}

export function seoTitle(d, suffix = "") {
  return String(d.seo_title || "").trim() || `${String(d.title || "").trim()}${suffix}`;
}

export function seoDescription(d) {
  const s = String(d.description || d.excerpt || "").trim() || plainText(d.summary || "") || firstParagraph(d.body || "");
  return s.replace(/\s*\r?\n\s*/g, " ").slice(0, 300);
}

// "" (자동) → noindex for thin content, otherwise index. An explicit choice always wins.
export function effectiveRobots(d, thinMin = LIMITS.thinMin) {
  const r = String(d.robots || "").trim();
  if (r) return r;
  return bodyChars(d.body) < thinMin ? "noindex, follow" : "index, follow";
}

export const postPath = (d) => `/blog/${d.category || "insight"}/${d.slug || "주소"}/`;

const range = (n, [a, b], [sa, sb]) => (n >= a && n <= b ? "pass" : n >= sa && n <= sb ? "warn" : "fail");

// data = post front matter + body (Markdown). Returns [{ group, label, status, detail }].
// status: pass | warn | fail | info (info = not scored).
export function auditPost(data, opts = {}) {
  const { siteUrl = "", suffix = "", defaultOg = "", thinMin = LIMITS.thinMin, authors = [], categories = [] } = opts;
  const d = data || {};
  const body = String(d.body || "");
  const r = [];
  const add = (group, label, status, detail) => r.push({ group, label, status, detail });
  const kw = String(d.keyword || "").trim();
  const title = seoTitle(d, suffix);
  const desc = seoDescription(d);
  const hs = headings(body);
  const secs = sections(body).filter((s) => s.title);
  const imgs = images(body);
  const chars = bodyChars(body);
  const robots = effectiveRobots(d, thinMin);
  const noindex = /noindex/.test(robots);
  const url = siteUrl + postPath(d);

  // 1. 크롤링 / 인덱싱
  const G1 = "1. 크롤링 · 인덱싱";
  add(G1, "검색 노출 (noindex / nofollow)", noindex ? "warn" : "pass",
    noindex
      ? d.robots ? `"${robots}"로 직접 지정 — 검색·사이트맵·RSS·llms.txt에서 빠져요` : `본문이 ${chars}자라 얇은 콘텐츠로 자동 noindex (기준 ${thinMin}자)`
      : `${robots}${d.robots ? "" : " (자동)"}`);
  add(G1, "Canonical 태그", "pass", `자기 참조 자동: ${url}`);
  add(G1, "사이트맵 · RSS · llms.txt 등록", noindex ? "info" : "pass", noindex ? "noindex라 등록하지 않아요" : "발행하면 /sitemap.xml · /feed.xml · /llms.txt에 자동 추가");

  // 2. 메타 태그 / HTML 구조
  const G2 = "2. 메타 태그 · HTML 구조";
  const tl = len(title);
  add(G2, `<title> ${LIMITS.title.join("~")}자`, range(tl, LIMITS.title, LIMITS.titleSoft),
    `현재 ${tl}자 · "${title}"${d.seo_title ? "" : " (검색 결과 제목이 비어 글 제목 + 브랜드 사용 중)"}`);
  if (!kw) add(G2, "메인 키워드 앞쪽 배치", "warn", "'메인 키워드'를 입력하면 위치를 확인해요");
  else {
    const i = title.indexOf(kw);
    const front = i >= 0 && i <= Math.max(10, tl / 3);
    add(G2, "메인 키워드 앞쪽 배치", i < 0 ? "fail" : front ? "pass" : "warn",
      i < 0 ? `제목에 "${kw}"가 없어요` : front ? `"${kw}" — ${i + 1}번째 글자부터` : `"${kw}"를 더 앞으로 (${i + 1}번째 글자)`);
  }
  const dl = len(desc);
  add(G2, `<meta description> ${LIMITS.desc.join("~")}자`, range(dl, LIMITS.desc, LIMITS.descSoft),
    `현재 ${dl}자${d.description ? "" : " (검색 결과 설명이 비어 목록 요약/첫 문단 사용 중)"}${kw && !desc.includes(kw) ? ` · "${kw}"를 넣어 보세요` : ""}`);
  const h1s = hs.filter((h) => h.level === 1);
  add(G2, "H1은 페이지당 1개", h1s.length ? "fail" : "pass",
    h1s.length ? `본문에 H1(# )이 ${h1s.length}개 — 글 제목이 이미 H1이에요. ## 로 바꾸세요` : "글 제목만 H1");
  const skips = [];
  let prev = 1;
  for (const h of hs.filter((h) => h.level > 1)) {
    if (h.level > prev + 1) skips.push(`"${h.text}" (H${prev} 다음 H${h.level})`);
    prev = h.level;
  }
  add(G2, "H2 / H3 위계", skips.length || secs.length < 2 ? "fail" : "pass",
    skips.length ? `단계 건너뜀: ${skips.join(", ")}` : secs.length < 2 ? `H2 ${secs.length}개 — 주제별로 ## 소제목을 2개 이상` : `H2 ${secs.length}개 · 순서 정상`);
  const long = secs.filter((s) => bodyChars(s.body) > LIMITS.sectionMax);
  add(G2, "한 섹션 = 한 주제", long.length ? "warn" : "pass",
    long.length ? `너무 긴 섹션: ${long.map((s) => `"${s.title}"`).join(", ")} — 소제목을 나눠 보세요` : "섹션 길이 적절");
  const noAlt = imgs.filter((i) => !i.alt).length + (d.thumb_image && !String(d.thumb_alt || "").trim() ? 1 : 0);
  const imgTotal = imgs.length + (d.thumb_image ? 1 : 0);
  add(G2, "이미지 alt 전부 작성", !imgTotal ? "info" : noAlt ? "fail" : "pass",
    !imgTotal ? "이미지 없음" : noAlt ? `${imgTotal}개 중 ${noAlt}개에 설명(alt)이 없어요 (썸네일 포함)` : `${imgTotal}개 모두 작성`);
  add(G2, "OG 태그 (title · description · image · url)", d.thumb_image ? "pass" : "warn",
    d.thumb_image ? "자동 · 공유 이미지 = 썸네일" : `썸네일이 없어 기본 이미지(${defaultOg || "로고"})로 공유돼요`);

  // 3. 구조화 데이터
  const G3 = "3. 구조화 데이터 (JSON-LD)";
  const author = authors.find((a) => a.id === d.author);
  add(G3, "BlogPosting + author(Person)", !author ? "fail" : author.type === "team" ? "warn" : "pass",
    !author ? "작성자를 고르세요 — author가 없으면 E-E-A-T 감점"
      : author.type === "team" ? `${author.name} (팀 명의 · Organization) — 스펙 권장은 실제 사람(Person). 연구원 이름을 쓰면 신뢰 신호가 더 강해져요`
      : `작성자 ${author.name}${author.role ? ` (${author.role})` : ""} · 작성자 페이지 /author/${author.id}/`);
  add(G3, "Organization", "pass", "사이트 전체 동일 엔티티(@id) · 회사 정보에서 자동");
  const cat = categories.find((c) => c.id === d.category);
  add(G3, "BreadcrumbList", cat ? "pass" : "fail", cat ? `홈 › 블로그 › ${cat.name} › 글` : "카테고리를 고르세요");
  const faq = extractFaq(body);
  add(G3, "FAQPage", faq.length ? "pass" : "warn",
    faq.length ? `질문 ${faq.length}개 인식: ${faq.map((f) => f.q).slice(0, 2).join(" / ")}${faq.length > 2 ? " …" : ""}` : "### 질문? (H3, 물음표로 끝) + 답변으로 쓰면 자동 적용");
  const howto = extractHowTo(body);
  add(G3, "HowTo", howto ? "pass" : "info",
    howto ? `"${howto.name}" ${howto.steps.length}단계 인식` : "절차형 글이면 '~하는 방법/순서' 소제목 아래 번호 목록(1. 2. 3.)으로");

  // 4. 사이트 성능
  const G4 = "4. 사이트 성능 (Core Web Vitals)";
  const ext = imgs.filter((i) => /^https?:\/\//.test(i.src));
  add(G4, "이미지 WebP + lazy loading", ext.length ? "warn" : "pass",
    ext.length ? `외부 주소 이미지 ${ext.length}개는 변환되지 않아요 — + 버튼으로 직접 올리세요` : "올린 이미지는 WebP 480/960/1600 · lazy · 가로세로 크기 지정(CLS 방지) 자동");
  add(G4, "LCP < 2.5s · INP < 200ms · CLS < 0.1", "info", "정적 HTML · JS 없음(글 페이지) — 발행 후 PageSpeed 모바일로 실측");

  // 5. 보안 / 접근성
  const G5 = "5. 보안 · 접근성";
  const ls = links(body);
  const http = ls.filter((l) => /^http:\/\//i.test(l.href));
  add(G5, "HTTPS 링크", http.length ? "warn" : "pass", http.length ? `http:// 링크 ${http.length}개: ${http.map((l) => l.href).join(", ")}` : "사이트 전체 HTTPS");
  const oldStyle = ls.filter((l) => /^\/blog\/[^/]+\.html$/.test(l.href));
  add(G5, "깨진 링크 X", oldStyle.length ? "warn" : "pass",
    oldStyle.length ? `옛 주소 형식(301로 넘어감): ${oldStyle.map((l) => l.href).join(", ")} — /blog/카테고리/주소/ 로 바꾸세요` : "발행 후 빌드 리포트에서 사이트 전체 링크 점검");
  add(G5, "얇은 콘텐츠 기준", chars >= thinMin ? "pass" : "fail", `본문 ${chars}자 (기준 ${thinMin}자 이상 · 미달 시 자동 noindex)`);
  add(G5, "SSG 정적 렌더링", "pass", "본문이 HTML에 그대로 — AI 크롤러가 JS 없이 읽어요");

  // 6. 콘텐츠 레벨 GEO
  const G6 = "6. 콘텐츠 GEO";
  const ans = secs.filter((s) => !isFaqSection(s)).map((s) => ({ t: s.title, a: answerBlock(s.body) }));
  const ansWords = ans.map((x) => ({ ...x, w: x.a ? words(x.a) : 0 }));
  const good = ansWords.filter((x) => x.w >= LIMITS.answer[0] && x.w <= LIMITS.answer[1]).length;
  const soft = ansWords.filter((x) => x.w >= LIMITS.answerSoft[0] && x.w <= LIMITS.answerSoft[1]).length;
  add(G6, `섹션 도입 요약 답변 ${LIMITS.answer.join("~")}단어`,
    !ansWords.length ? "fail" : good / ansWords.length >= 0.7 ? "pass" : soft / ansWords.length >= 0.5 ? "warn" : "fail",
    ansWords.length ? ansWords.map((x) => `${x.t.slice(0, 14)}${x.t.length > 14 ? "…" : ""} ${x.a ? `${x.w}단어` : "도입 문단 없음"}`).join(" · ") : "H2 섹션이 없어요");
  const q = secs.filter((s) => isQuestion(s.title)).length;
  add(G6, "Q&A 포맷 (질문형 소제목)", !secs.length ? "fail" : q / secs.length >= 0.7 ? "pass" : q ? "warn" : "fail",
    `H2 ${secs.length}개 중 질문형 ${q}개`);
  const struct = [/^\s*\|.+\|/m.test(body) && "표", /^\s*([-*+]|\d+[.)])\s/m.test(body) && "리스트", /^\s*>/m.test(body) && "인용/정의 박스"].filter(Boolean);
  add(G6, "표 · 리스트 · 정의 박스", struct.length >= 2 ? "pass" : struct.length ? "warn" : "fail", struct.length ? struct.join(" · ") : "표나 리스트를 넣어 발췌하기 쉽게");
  add(G6, "저자 · 발행일 · 수정일 표기", author && d.date ? "pass" : "fail",
    `${author ? author.name : "작성자 없음"} · 발행 ${fmtDate(d.date) || "없음"}${d.updated ? ` · 수정 ${fmtDate(d.updated)}` : " · 고치면 '수정일'을 넣으세요"}`);
  add(G6, "엔티티 일관성", "pass", "회사명·대표자·주소는 '회사 정보' 한 곳에서만 가져와요");

  // 7. 콘텐츠 아키텍처
  const G7 = "7. 내부 링크 구조";
  add(G7, "카테고리 (필러 + 클러스터)", cat ? "pass" : "fail",
    cat ? `${cat.name}${cat.pillar === d.slug ? " · 이 글이 필러 글" : cat.pillar ? " · 필러 글로 자동 연결" : " · 필러 글 미지정 (카테고리 설정)"}` : "카테고리를 고르세요");
  const internal = ls.filter((l) => l.href.startsWith("/") || (siteUrl && l.href.startsWith(siteUrl)));
  const rel = (d.related || []).length;
  add(G7, "관련 글 내부 링크", internal.length || rel ? "pass" : "warn",
    `본문 내부 링크 ${internal.length}개 · 직접 연결 관련 글 ${rel}개 · 같은 카테고리/태그 글은 자동 추천`);
  add(G7, "URL 구조", /^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug || "") && len(d.slug) <= 60 ? "pass" : "fail", url);

  return r;
}

export const isFaqSection = (s) => /^\s*###\s/.test(s.body.trim()) || /자주\s?묻|FAQ/i.test(s.title);

function fmtDate(v) {
  if (!v) return "";
  const x = v instanceof Date ? v : new Date(v);
  return isNaN(x) ? String(v) : x.toISOString().slice(0, 10);
}

export function score(results) {
  const scored = results.filter((x) => x.status !== "info");
  const pts = scored.reduce((s, x) => s + (x.status === "pass" ? 1 : x.status === "warn" ? 0.5 : 0), 0);
  return scored.length ? Math.round((pts / scored.length) * 100) : 100;
}
