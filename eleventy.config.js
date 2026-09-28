import markdownIt from "markdown-it";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { pageSeo, headTags, relatedPosts, redirectLines, isIndexable, readBody, findById, toc, oneLine } from "./lib/seo.js";
import { runAudit } from "./lib/audit.js";
import { buildThumbs, labNumbers, labLabel } from "./lib/thumbs.js";
import { seoDescription, plainText } from "./src/admin/seo-core.js";

// One sentence per line in the editor; a blank line starts a new paragraph.
const md = markdownIt({ html: true, breaks: true, linkify: true });
// Tables scroll sideways on phones instead of widening the page.
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
md.renderer.rules.table_close = () => "</table></div>\n";
// H2/H3 get stable ids so the table of contents, AI answers and shared links can point at a section.
const slugify = (s) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").slice(0, 60);
md.core.ruler.push("heading_ids", (state) => {
  const used = new Set();
  state.tokens.forEach((t, i) => {
    if (t.type !== "heading_open" || !["h2", "h3"].includes(t.tag)) return;
    let id = slugify(state.tokens[i + 1].content) || "section";
    for (let n = 2; used.has(id); n++) id = `${id.replace(/-\d+$/, "")}-${n}`;
    used.add(id);
    t.attrSet("id", id);
  });
});

export default function (eleventyConfig) {
  eleventyConfig.setLibrary("md", md);

  // Every <img> → WebP 480/960/1600 with width/height (no layout shift) and lazy loading.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp"],
    widths: [480, 960, 1600],
    failOnError: false,
    sharpWebpOptions: { quality: 80 },
    htmlOptions: { imgAttributes: { loading: "lazy", decoding: "async", sizes: "(max-width: 768px) 100vw, 760px" } },
  });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("src/styles.css");
  eleventyConfig.addPassthroughCopy("src/admin");
  // The admin's live SEO checker reads the same settings the build uses.
  eleventyConfig.addPassthroughCopy({
    "src/_data/site.json": "admin/data/site.json",
    "src/_data/categories.json": "admin/data/categories.json",
    "src/_data/authors.json": "admin/data/authors.json",
  });
  eleventyConfig.ignores.add("src/admin/**");

  const toDate = (d) => (d instanceof Date ? d : new Date(d));
  eleventyConfig.addFilter("dateKo", (d) => { const x = toDate(d); return `${x.getFullYear()}년 ${x.getMonth() + 1}월 ${x.getDate()}일`; });
  eleventyConfig.addFilter("dateDot", (d) => { const x = toDate(d); return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`; });
  eleventyConfig.addFilter("dateIso", (d) => toDate(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("rfc822", (d) => toDate(d).toUTCString());
  eleventyConfig.addFilter("readMinutes", (inputPath) => Math.max(1, Math.round(plainText(readBody(inputPath)).replace(/\s+/g, "").length / 500)));
  eleventyConfig.addFilter("md", (s) => md.render(String(s ?? "")));
  eleventyConfig.addFilter("oneLine", oneLine);
  eleventyConfig.addFilter("firstChar", (s) => Array.from(String(s ?? "").trim())[0] || "·");
  eleventyConfig.addFilter("xml", (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]));
  // Tag page folder = the tag with spaces → "-" (browsers percent-encode the Korean in the URL).
  eleventyConfig.addFilter("tagSlug", (t) => String(t).trim().replace(/[\s/?#]+/g, "-"));

  // ───────── SEO / AEO / GEO (rules: src/admin/seo-core.js · build side: lib/seo.js)
  eleventyConfig.addAsyncFilter("seoHead", async function () {
    const ctx = { ...this.ctx, page: this.page || this.ctx.page };
    return headTags(await pageSeo(ctx), ctx);
  });
  eleventyConfig.addFilter("findById", findById);
  eleventyConfig.addFilter("related", (posts, slug, category, tags, related) => relatedPosts(posts, { slug, category, tags, related }));
  eleventyConfig.addFilter("redirectLines", redirectLines);
  eleventyConfig.addFilter("postBody", readBody);
  eleventyConfig.addFilter("postDesc", (item) => oneLine(seoDescription({ ...item.data, body: readBody(item.inputPath) })));
  eleventyConfig.addFilter("inCategory", (posts, id) => (posts || []).filter((p) => p.data.category === id));
  eleventyConfig.addFilter("byAuthor", (posts, id) => (posts || []).filter((p) => p.data.author === id));
  eleventyConfig.addFilter("byTag", (posts, tag) => (posts || []).filter((p) => (p.data.tags || []).includes(tag)));
  eleventyConfig.addFilter("bySlug", (posts, slug) => (posts || []).find((p) => p.page.fileSlug === slug));
  eleventyConfig.addFilter("toc", toc);

  // The audit runs after the build, so keep a handle on the global data and the posts.
  let g = null;
  let labs = new Map();
  eleventyConfig.addCollection("posts", (api) => {
    const posts = api.getFilteredByGlob("src/posts/*.md").sort((a, b) => b.date - a.date);
    const d = (posts[0] || api.getAll()[0] || {}).data || {};
    g = { site: d.site, authors: d.authors || {}, categories: d.categories || {}, posts };
    labs = labNumbers(posts.map((p) => ({ slug: p.page.fileSlug, date: p.date, lab_no: p.data.lab_no })));
    return posts;
  });

  // ───────── LAB NOTE thumbnails (lib/thumbs.js): drawn before each build for posts without a 대표 이미지.
  eleventyConfig.on("eleventy.before", async ({ dir }) => {
    try { await buildThumbs({ outDir: `${dir.output}/img/thumbs` }); } catch (e) { console.warn("[썸네일] 실패:", e.message); }
  });
  // "LAB NOTE 001" — the admin's 연구일지 번호, or the publishing order when it is empty.
  eleventyConfig.addFilter("labNo", (slug) => labLabel(labs.get(slug)));
  // Card/cover image: the uploaded 대표 이미지, else the generated thumbnail (already 1200×630 WebP,
  // so the <img> carries eleventy:ignore + its size and the image plugin leaves it alone).
  eleventyConfig.addFilter("thumbOf", (item) => {
    const d = item.data || item;
    const slug = item.page ? item.page.fileSlug : item.fileSlug;
    return d.thumb_image ? { src: d.thumb_image, generated: false } : { src: `/img/thumbs/${slug}.webp`, generated: true };
  });
  // Posts search engines may index (not thin, not marked noindex) → sitemap, RSS, llms.txt.
  eleventyConfig.addCollection("indexablePosts", (api) =>
    api.getFilteredByGlob("src/posts/*.md").filter((p) => isIndexable(p, p.data.site)).sort((a, b) => b.date - a.date));
  eleventyConfig.addCollection("tagList", (api) =>
    [...new Set(api.getFilteredByGlob("src/posts/*.md").flatMap((p) => p.data.tags || []))].sort());

  // After every build: checklist report at /admin/seo-report.html (never fails the build).
  eleventyConfig.on("eleventy.after", ({ dir }) => {
    try {
      if (g && g.site) runAudit({ outDir: dir.output, ...g });
    } catch (e) {
      console.warn("[SEO 점검] 리포트 생성 실패:", e.message);
    }
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: false,
  };
}
