// /admin 블로그 글 미리보기: 오른쪽 화면 맨 위에 SEO · GEO 점검표 + 검색 결과/공유 미리보기를 띄운다.
// Rules: seo-core.js (the same file the build uses). Uses Decap's global CMS, h, createClass.
import { auditPost, score, seoTitle, seoDescription, postPath } from "./seo-core.js";

const ctx = { site: null, categories: [], authors: [] };
const load = (u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const ready = Promise.all([load("/admin/data/site.json"), load("/admin/data/categories.json"), load("/admin/data/authors.json")])
  .then(([site, cats, authors]) => {
    ctx.site = site;
    ctx.categories = (cats && cats.items) || [];
    ctx.authors = (authors && authors.items) || [];
  });

const ICON = { pass: "✓", warn: "!", fail: "✕", info: "i" };
const LABEL = { pass: "통과", warn: "주의", fail: "미흡", info: "참고" };

const css = `
.seo{font:14px/1.55 Pretendard,system-ui,sans-serif;color:#1d1d1f;background:#f5f5f7;border-radius:16px;padding:18px;margin:0 0 32px}
.seo h2{margin:0;font:700 17px/1.3 Pretendard,system-ui,sans-serif}
.seo__top{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.seo__score{flex:none;display:grid;place-items:center;width:64px;height:64px;border-radius:50%;font:800 20px/1 Pretendard,system-ui,sans-serif;color:#fff}
.seo__sub{margin:2px 0 0;color:#6e6e73;font-size:13px}
.seo__counts{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.seo__counts span{font-size:12px;font-weight:600;padding:2px 8px;border-radius:99px;background:#fff}
.seo__group{background:#fff;border-radius:12px;padding:4px 12px;margin-top:10px}
.seo__group h3{margin:10px 0 4px;font:700 13px/1.3 Pretendard,system-ui,sans-serif;color:#6e6e73}
.seo__row{display:grid;grid-template-columns:22px 1fr;gap:8px;padding:8px 0;border-top:1px solid #f0f0f0}
.seo__row:first-of-type{border-top:0}
.seo__i{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;font:700 11px/1 system-ui;color:#fff;margin-top:1px}
.seo__i.pass{background:#1a7f37}.seo__i.warn{background:#bf8700}.seo__i.fail{background:#cf222e}.seo__i.info{background:#8c8c8c}
.seo__l{font-weight:600}.seo__d{display:block;color:#6e6e73;font-size:12.5px;word-break:break-all}
.seo__row.fail .seo__l{color:#cf222e}
.seo__cards{display:grid;gap:10px;margin-top:10px}
.seo__card{background:#fff;border-radius:12px;padding:14px}
.seo__card h3{margin:0 0 8px;font:700 13px/1.3 Pretendard,system-ui,sans-serif;color:#6e6e73}
.serp{max-width:600px;font-family:Arial,sans-serif}
.serp__url{font-size:12px;color:#202124;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.serp__t{font-size:20px;line-height:1.3;color:#1a0dab;margin:4px 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:580px}
.serp__d{font-size:14px;line-height:1.58;color:#4d5156;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.og{max-width:420px;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden}
.og__img{aspect-ratio:1200/630;background:#16254d center/cover no-repeat}
.og__b{padding:10px 12px}.og__t{font-weight:700;font-size:14px;margin:0 0 2px}.og__d{font-size:12.5px;color:#6e6e73;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.og__u{font-size:12px;color:#8c8c8c;margin-top:4px}
.seo__links{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.seo__links a{font-size:12.5px;font-weight:600;color:#0066cc;background:#fff;border-radius:99px;padding:5px 10px;text-decoration:none}
/* LAB NOTE thumbnail — same layout as lib/thumbs.js (1200×630), scaled with container units */
.lab{container-type:inline-size;position:relative;aspect-ratio:1200/630;overflow:hidden;border:1px solid #e7e4de;border-radius:12px;font-family:Pretendard,system-ui,sans-serif;color:#1f1f1f;
  background-color:#fbfaf7;background-image:linear-gradient(#ebe8e2 1px,transparent 1px),linear-gradient(90deg,#ebe8e2 1px,transparent 1px);background-size:5cqw 5cqw}
.lab img.lab__custom{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lab__in{position:absolute;left:6.67cqw;right:6.67cqw;top:7.2cqw}
.lab__no{margin:0;font-weight:500;font-size:2.17cqw;letter-spacing:.42cqw;color:#3aa3ad}
.lab__en{margin:5.4cqw 0 0;font-weight:300;font-size:5.1cqw;line-height:1.15;white-space:nowrap;overflow:hidden}
.lab__ko{margin:2.4cqw 0 0;font-weight:700;font-size:5.3cqw;line-height:1.15;white-space:nowrap;overflow:hidden}
.lab__bar{width:10cqw;height:.34cqw;background:#5fc0c8;margin-top:2.9cqw}
.lab__sub{margin:3.4cqw 0 0;font-size:2.67cqw;color:#6b6b6b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lab__logo{position:absolute;right:6.67cqw;bottom:5.8cqw;width:14.2cqw}
.lab-note{margin:0 0 6px;font:12px/1.5 Pretendard,system-ui,sans-serif;color:#7a7a7a}
.og .lab{border:0;border-radius:0}
`;

// Live copy of the build-time thumbnail, so editors see it while typing.
function LabThumb({ d, getAsset, no }) {
  if (d.thumb_image) {
    return h("div", { className: "lab" }, h("img", { className: "lab__custom", src: String(getAsset(d.thumb_image) || d.thumb_image), alt: "" }));
  }
  return h("div", { className: "lab" },
    h("div", { className: "lab__in" },
      h("p", { className: "lab__no" }, no),
      d.thumb_en ? h("p", { className: "lab__en" }, d.thumb_en) : null,
      h("p", { className: "lab__ko", style: d.thumb_en ? null : { marginTop: "4cqw" } }, d.thumb_ko || d.keyword || d.title || "썸네일 한글 큰 제목"),
      h("div", { className: "lab__bar" }),
      d.thumb_sub ? h("p", { className: "lab__sub" }, d.thumb_sub) : null),
    h("img", { className: "lab__logo", src: "/assets/logo-full.png", alt: "" }));
}
const labText = (d) => (d.lab_no ? `LAB NOTE ${String(d.lab_no).padStart(3, "0")}` : "LAB NOTE (번호 자동)");

function Checklist({ d, getAsset }) {
  const s = ctx.site ? { ...ctx.site.seo, url: String(ctx.site.url).replace(/\/$/, "") } : { url: "", title_suffix: "", og_image: "/assets/og-default.png" };
  const res = auditPost(d, {
    siteUrl: s.url, suffix: s.title_suffix, defaultOg: s.og_image, thinMin: s.thin_min_chars || 800,
    authors: ctx.authors, categories: ctx.categories,
  });
  const sc = score(res);
  const cnt = res.reduce((c, x) => ((c[x.status] = (c[x.status] || 0) + 1), c), {});
  const color = sc >= 85 ? "#1a7f37" : sc >= 60 ? "#bf8700" : "#cf222e";
  const groups = [...new Set(res.map((x) => x.group))];
  const url = s.url + postPath(d);
  const enc = encodeURIComponent(url);

  return h("section", { className: "seo" },
    h("div", { className: "seo__top" },
      h("div", { className: "seo__score", style: { background: color } }, sc),
      h("div", null,
        h("h2", null, "SEO · AEO · GEO 점검표"),
        h("p", { className: "seo__sub" }, "쓰는 동안 실시간으로 바뀌어요. 빨간 항목부터 고쳐 주세요."),
        h("div", { className: "seo__counts" }, ...["pass", "warn", "fail"].map((k) => h("span", { key: k }, `${LABEL[k]} ${cnt[k] || 0}`))))),
    h("div", { className: "seo__cards" },
      h("div", { className: "seo__card" },
        h("h3", null, "구글 · 네이버 검색 결과 미리보기"),
        h("div", { className: "serp" },
          h("div", { className: "serp__url" }, url.replace(/^https:\/\//, "").replace(/\//g, " › ").replace(/ › $/, "")),
          h("div", { className: "serp__t" }, seoTitle(d, s.title_suffix)),
          h("div", { className: "serp__d" }, seoDescription(d)))),
      h("div", { className: "seo__card" },
        h("h3", null, "카카오톡 · SNS 공유 미리보기"),
        h("div", { className: "og" },
          h(LabThumb, { d, getAsset, no: labText(d) }),
          h("div", { className: "og__b" },
            h("p", { className: "og__t" }, d.title || "제목"),
            h("p", { className: "og__d" }, seoDescription(d)),
            h("div", { className: "og__u" }, s.url.replace(/^https:\/\//, "")))))),
    ...groups.map((g) => h("div", { className: "seo__group", key: g },
      h("h3", null, g),
      ...res.filter((x) => x.group === g).map((x, i) => h("div", { className: `seo__row ${x.status}`, key: i },
        h("span", { className: `seo__i ${x.status}`, title: LABEL[x.status] }, ICON[x.status]),
        h("div", null, h("span", { className: "seo__l" }, x.label), h("span", { className: "seo__d" }, x.detail)))))),
    h("div", { className: "seo__links" },
      h("a", { href: `https://search.google.com/test/rich-results?url=${enc}`, target: "_blank" }, "Rich Results Test"),
      h("a", { href: `https://validator.schema.org/#url=${enc}`, target: "_blank" }, "Schema Validator"),
      h("a", { href: `https://pagespeed.web.dev/analysis?url=${enc}&form_factor=mobile`, target: "_blank" }, "PageSpeed (모바일)"),
      h("a", { href: "/admin/seo-report.html", target: "_blank" }, "사이트 전체 리포트")));
}

const dot = (v) => { if (!v) return ""; const x = new Date(v); return isNaN(x) ? String(v) : `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`; };

// Same structure and classes as src/_includes/layouts/post.njk, so the preview looks like the live post.
const PostPreview = createClass({
  componentDidMount() { ready.then(() => this.forceUpdate()); },
  render() {
    const { entry, widgetFor, getAsset } = this.props;
    const raw = entry.get("data");
    const d = raw && raw.toJS ? raw.toJS() : {};
    d.slug = d.slug || entry.get("slug") || "";
    const author = ctx.authors.find((a) => a.id === d.author);
    const cat = ctx.categories.find((c) => c.id === d.category);
    const row = (k, v) => (v ? h("div", null, h("dt", null, k), h("dd", null, v)) : null);
    return h("div", null,
      h(Checklist, { d, getAsset }),
      h("p", { className: "lab-note" }, "▼ 실제 글 화면 미리보기"),
      h("article", { className: "post" },
        h("header", { className: "post__head wrap wrap--post", style: { paddingTop: 0 } },
          h("nav", { className: "crumbs" }, "홈 › ", cat ? cat.name : "카테고리 없음"),
          h("p", { className: "post__no" }, labText(d)),
          h("h1", { className: "post__title" }, d.title || "제목"),
          h("dl", { className: "record" },
            row("작성", author ? `${author.name}${author.role ? " · " + author.role : ""}` : "작성자를 골라 주세요"),
            row("발행", dot(d.date)),
            row("수정", dot(d.updated)),
            row("분류", cat && cat.name),
            (d.tags || []).length ? h("div", { className: "record__tags" }, h("dt", null, "태그"), h("dd", null, ...(d.tags || []).map((t, i) => h("a", { key: i }, "#" + t)))) : null)),
        h("figure", { className: "post__cover wrap wrap--wide" }, h(LabThumb, { d, getAsset, no: labText(d) })),
        h("div", { className: "wrap wrap--post" },
          d.summary ? h("section", { className: "post__summary" }, h("p", { className: "post__summary-label" }, "SUMMARY · 핵심 요약"), widgetFor("summary")) : null,
          h("div", { className: "prose" }, widgetFor("body")))));
  },
});

// 툴바 + → '자주 묻는 질문': inserts "### 질문?" + answer — the exact shape the FAQ cards and FAQPage data expect.
CMS.registerEditorComponent({
  id: "faq",
  label: "자주 묻는 질문 (Q&A)",
  fields: [
    { name: "q", label: "질문 (물음표로 끝내기)", widget: "string" },
    { name: "a", label: "답변", widget: "text" },
  ],
  pattern: /^### ([^\n]+?[?？])\n\n([^\n#][^\n]*)$/m,
  fromBlock: (m) => ({ q: m[1], a: m[2] }),
  toBlock: ({ q = "", a = "" }) => {
    const qq = q.trim().replace(/[?？]?$/, "?");
    return `### ${qq}\n\n${a.trim().replace(/\s*\n\s*/g, " ")}`;
  },
  toPreview: ({ q = "", a = "" }) => `<h3>${q}</h3><p>${a}</p>`,
});

CMS.registerPreviewStyle(css, { raw: true });
CMS.registerPreviewTemplate("posts", PostPreview);
