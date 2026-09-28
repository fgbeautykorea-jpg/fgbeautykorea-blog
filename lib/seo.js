// Build-side SEO: <head> meta/OG tags, the JSON-LD @graph, related posts, redirects.
// What a good post looks like is defined in src/admin/seo-core.js (shared with the /admin live checker).
import fs from "node:fs";
import path from "node:path";
import Image from "@11ty/eleventy-img";
import { seoTitle, seoDescription, effectiveRobots, extractFaq, extractHowTo, plainText, words, LIMITS } from "../src/admin/seo-core.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const oneLine = (s) => String(s ?? "").replace(/\s*\r?\n\s*/g, " ").trim();
const iso = (d) => (d ? (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10) : undefined);

// Post Markdown body (front matter removed), cached per file.
const bodyCache = new Map();
export function readBody(inputPath) {
  if (!inputPath) return "";
  const file = path.resolve(inputPath);
  let stat;
  try { stat = fs.statSync(file); } catch { return ""; }
  const hit = bodyCache.get(file);
  if (hit && hit.mtime === stat.mtimeMs) return hit.body;
  const body = fs.readFileSync(file, "utf8").replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  bodyCache.set(file, { mtime: stat.mtimeMs, body });
  return body;
}

export const postData = (item) => ({ ...item.data, body: readBody(item.inputPath) });
const thinMin = (site) => site.seo.thin_min_chars ?? LIMITS.thinMin;
export const isIndexable = (item, site) => !/noindex/.test(effectiveRobots(postData(item), thinMin(site)));
export const findById = (list, id) => ((list && list.items) || []).find((x) => x.id === id);
const base = (site) => String(site.url).replace(/\/$/, "");

// Share image: uploaded thumbnails are resized to a 1200px JPEG (what Kakao/Facebook/Naver expect).
export async function ogImage(src, site) {
  const fallback = { url: base(site) + site.seo.og_image, width: 1200, height: 630 };
  if (!src) return fallback;
  if (/^https?:\/\//.test(src)) return { url: src };
  try {
    const meta = await Image(path.join("src", src.replace(/^\//, "")), {
      widths: [1200], formats: ["jpeg"], outputDir: "_site/img/og/", urlPath: "/img/og/", sharpJpegOptions: { quality: 82 },
    });
    const m = meta.jpeg[meta.jpeg.length - 1];
    return { url: base(site) + m.url, width: m.width, height: m.height };
  } catch {
    return { url: base(site) + src };
  }
}

// Everything that describes one page for search engines / AI, computed from the page data.
export async function pageSeo(ctx) {
  const site = ctx.site;
  const url = base(site) + ctx.page.url;
  if (ctx.isPost) {
    const d = { ...ctx, body: readBody(ctx.page.inputPath) };
    return {
      kind: "post", url, d,
      title: seoTitle(d, site.seo.title_suffix),
      desc: oneLine(seoDescription(d)),
      robots: effectiveRobots(d, thinMin(site)),
      image: await ogImage(ctx.thumb_image, site),
      imageAlt: ctx.thumb_alt || ctx.title,
    };
  }
  // Category / author pages without posts, and every tag page, are thin → noindex (links still followed).
  const posts = (ctx.collections && ctx.collections.posts) || [];
  const kind = ctx.pageKind || "page";
  const empty =
    (kind === "category" && !posts.some((p) => p.data.category === ctx.cat.id)) ||
    (kind === "author" && !posts.some((p) => p.data.author === ctx.author.id));
  return {
    kind, url,
    title: ctx.title || site.home_title,
    desc: oneLine(ctx.description || site.description),
    robots: ctx.robots || (empty || kind === "tag" ? "noindex, follow" : "index, follow"),
    image: await ogImage(null, site),
    imageAlt: site.name,
  };
}

export function headTags(p, ctx) {
  const { site } = ctx;
  const t = [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.desc)}">`,
    `<meta name="robots" content="${esc(p.robots)}, max-image-preview:large">`,
  ];
  if (!/noindex/.test(p.robots)) t.push(`<link rel="canonical" href="${esc(p.url)}">`);
  if (site.seo.naver_verification) t.push(`<meta name="naver-site-verification" content="${esc(site.seo.naver_verification)}">`);
  if (site.seo.google_verification) t.push(`<meta name="google-site-verification" content="${esc(site.seo.google_verification)}">`);
  t.push(
    `<meta property="og:type" content="${p.kind === "post" ? "article" : "website"}">`,
    `<meta property="og:site_name" content="${esc(site.name)}">`,
    `<meta property="og:locale" content="ko_KR">`,
    `<meta property="og:title" content="${esc(p.kind === "post" ? p.d.title : p.title)}">`,
    `<meta property="og:description" content="${esc(p.desc)}">`,
    `<meta property="og:url" content="${esc(p.url)}">`,
    `<meta property="og:image" content="${esc(p.image.url)}">`,
  );
  if (p.image.width) t.push(`<meta property="og:image:width" content="${p.image.width}"><meta property="og:image:height" content="${p.image.height}">`);
  t.push(`<meta property="og:image:alt" content="${esc(p.imageAlt)}">`, `<meta name="twitter:card" content="summary_large_image">`);
  if (p.kind === "post") {
    t.push(`<meta property="article:published_time" content="${iso(p.d.date)}">`);
    if (p.d.updated) t.push(`<meta property="article:modified_time" content="${iso(p.d.updated)}">`);
    const a = findById(ctx.authors, p.d.author);
    if (a) t.push(`<meta name="author" content="${esc(a.name)}">`);
    const c = findById(ctx.categories, p.d.category);
    if (c) t.push(`<meta property="article:section" content="${esc(c.name)}">`);
    for (const tag of p.d.tags || []) t.push(`<meta property="article:tag" content="${esc(tag)}">`);
  }
  t.push(`<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="${base(site)}/feed.xml">`);
  t.push(jsonLd(p, ctx));
  return t.join("\n");
}

function person(a, ctx) {
  const b = base(ctx.site);
  // A team byline (e.g. "콘텐츠팀") is an Organization that belongs to the publisher, not a Person.
  if (a.type === "team") {
    return {
      "@type": "Organization",
      "@id": `${b}/author/${a.id}/#team`,
      name: a.name,
      url: `${b}/author/${a.id}/`,
      ...(a.role && { description: a.role }),
      parentOrganization: { "@id": `${b}/#organization` },
    };
  }
  return {
    "@type": "Person",
    "@id": `${b}/author/${a.id}/#person`,
    name: a.name,
    url: `${b}/author/${a.id}/`,
    ...(a.role && { jobTitle: a.role }),
    ...(a.bio && { description: oneLine(a.bio) }),
    ...(a.photo && { image: b + a.photo }),
    worksFor: { "@id": `${b}/#organization` },
    ...((a.same_as || []).length && { sameAs: a.same_as }),
  };
}

// The one brand entity, identical on every page (same @id) — fed only from site.publisher.
export function organization(site) {
  const b = base(site);
  const o = site.publisher;
  return {
    "@type": "Organization",
    "@id": `${b}/#organization`,
    name: o.name,
    ...(o.legal_name && o.legal_name !== o.name && { legalName: o.legal_name }),
    ...((o.alternate_names || []).length && { alternateName: o.alternate_names }),
    url: o.homepage || `${b}/`,
    logo: { "@type": "ImageObject", url: b + site.logo },
    ...(o.email && { email: o.email }),
    ...(o.address && { address: { "@type": "PostalAddress", streetAddress: o.address, addressCountry: "KR" } }),
    ...(o.ceo && { founder: { "@type": "Person", name: o.ceo } }),
    ...(o.founded && { foundingDate: o.founded }),
    ...(o.bizno && { taxID: o.bizno }),
    ...((o.same_as || []).length && { sameAs: o.same_as }),
  };
}

const crumbs = (list) => ({
  "@type": "BreadcrumbList",
  itemListElement: list.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
});

function jsonLd(p, ctx) {
  const { site } = ctx;
  const b = base(site);
  const org = organization(site);
  const graph = [
    org,
    { "@type": "WebSite", "@id": `${b}/#website`, url: `${b}/`, name: site.name, description: oneLine(site.description), inLanguage: "ko-KR", publisher: { "@id": org["@id"] } },
  ];
  const home = ["홈", `${b}/`];
  const blog = ["전체 글", `${b}/blog/`];

  if (p.kind === "blog") graph.push(crumbs([home, blog]));
  if (p.kind === "page") graph.push(crumbs([home, [ctx.title, p.url]]));
  if (p.kind === "about") {
    graph.push({ "@type": "AboutPage", "@id": p.url, url: p.url, name: ctx.title, about: { "@id": org["@id"] } });
    graph.push(crumbs([home, [ctx.heading || ctx.title, p.url]]));
  }
  if (p.kind === "category") {
    const c = ctx.cat;
    graph.push({ "@type": "CollectionPage", "@id": p.url, url: p.url, name: c.name, description: oneLine(c.desc), isPartOf: { "@id": `${b}/#website` } });
    graph.push(crumbs([home, blog, [c.name, p.url]]));
  }
  if (p.kind === "author") {
    graph.push({ "@type": "ProfilePage", "@id": p.url, url: p.url, mainEntity: person(ctx.author, ctx) });
    graph.push(crumbs([home, [ctx.author.name, p.url]]));
  }
  if (p.kind === "post") {
    const d = p.d;
    const a = findById(ctx.authors, d.author);
    const c = findById(ctx.categories, d.category);
    graph.push({
      "@type": "BlogPosting",
      "@id": `${p.url}#article`,
      headline: d.title,
      description: p.desc,
      image: p.image.url,
      datePublished: iso(d.date),
      dateModified: iso(d.updated || d.date),
      author: a ? person(a, ctx) : { "@id": org["@id"] },
      publisher: { "@type": "Organization", "@id": org["@id"], name: org.name, logo: org.logo },
      mainEntityOfPage: { "@type": "WebPage", "@id": p.url },
      inLanguage: "ko-KR",
      wordCount: words(plainText(d.body)),
      ...(c && { articleSection: c.name }),
      ...((d.keyword || (d.tags || []).length) && { keywords: [d.keyword, ...(d.tags || [])].filter(Boolean).join(", ") }),
      isPartOf: { "@id": `${b}/#website` },
    });
    graph.push(crumbs(c ? [home, [c.name, `${b}/blog/${c.id}/`], [d.title, p.url]] : [home, blog, [d.title, p.url]]));
    const faq = extractFaq(d.body);
    if (faq.length) {
      graph.push({
        "@type": "FAQPage", "@id": `${p.url}#faq`,
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      });
    }
    const howto = extractHowTo(d.body);
    if (howto) {
      graph.push({
        "@type": "HowTo", "@id": `${p.url}#howto`, name: howto.name,
        step: howto.steps.map((t, i) => ({ "@type": "HowToStep", position: i + 1, name: t.slice(0, 80), text: t })),
      });
    }
  }
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

// Up to n related posts: ones picked in the admin first, then same category, then shared tags.
export function relatedPosts(posts, cur, n = 3) {
  const others = (posts || []).filter((p) => p.page.fileSlug !== cur.slug);
  const picked = (cur.related || []).map((slug) => others.find((p) => p.page.fileSlug === slug)).filter(Boolean);
  const tags = new Set(cur.tags || []);
  const scoreOf = (p) => (p.data.category === cur.category ? 2 : 0) + (p.data.tags || []).filter((t) => tags.has(t)).length;
  const auto = others.filter((p) => !picked.includes(p) && scoreOf(p) > 0).sort((a, b) => scoreOf(b) - scoreOf(a) || b.date - a.date);
  return [...picked, ...auto].slice(0, n);
}

// Netlify _redirects: the admin's 301 list (옛 주소 → 새 주소).
export function redirectLines(site) {
  return (site.seo.redirects || []).filter((r) => r.from && r.to).map((r) => `${r.from}  ${r.to}  301`).join("\n");
}

// Table of contents from the rendered post HTML (H2 with ids).
export function toc(html) {
  return [...String(html ?? "").matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1], text: m[2].replace(/<[^>]+>/g, "") }));
}
