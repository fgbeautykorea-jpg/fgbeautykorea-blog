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
`;

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
  const thumb = d.thumb_image ? String(getAsset(d.thumb_image) || d.thumb_image) : s.og_image;
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
          h("div", { className: "og__img", style: { backgroundImage: `url("${thumb}")` } }),
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

const PostPreview = createClass({
  componentDidMount() { ready.then(() => this.forceUpdate()); },
  render() {
    const { entry, widgetFor, getAsset } = this.props;
    const raw = entry.get("data");
    const d = raw && raw.toJS ? raw.toJS() : {};
    d.slug = d.slug || entry.get("slug") || "";
    const author = ctx.authors.find((a) => a.id === d.author);
    const cat = ctx.categories.find((c) => c.id === d.category);
    return h("div", null,
      h(Checklist, { d, getAsset }),
      h("main", { className: "post" },
        h("article", { className: "post__inner" },
          h("nav", { className: "crumbs" }, "홈", cat ? ` › ${cat.name}` : ""),
          cat ? h("span", { className: "post__cat" }, cat.name) : null,
          h("h1", { className: "post__title" }, d.title || "제목"),
          h("p", { className: "post__meta" }, h("strong", null, author ? author.name : "작성자 없음"), author && author.role ? ` · ${author.role}` : ""),
          d.summary ? h("div", { className: "post__summary" }, widgetFor("summary")) : null,
          h("div", { className: "post__body" }, widgetFor("body")))));
  },
});

CMS.registerPreviewStyle(css, { raw: true });
CMS.registerPreviewTemplate("posts", PostPreview);
