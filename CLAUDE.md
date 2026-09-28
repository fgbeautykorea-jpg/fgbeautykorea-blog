# FG BEAUTY 블로그 — notes for Claude Code

Standalone SEO/AEO/GEO blog for 주식회사 에프지뷰티코리아 (brand FG BEAUTY, "LAB NOTE / 연구일지" concept).
It is NOT the THE DOUBLE homepage (`../site`). The owner talks in Korean and is a non-developer. Reply in
Korean, in plain words, and show results as screenshots.

- Live: https://fgbeautykorea-blog.netlify.app (domain blog.fgbeautykorea.co.kr planned, not bought yet)
- Repo: `fgbeautykorea-jpg/fgbeautykorea-blog` (**public** — the Netlify free plan blocks private-repo deploys
  from "unrecognized contributors"). Every push to `main` auto-deploys in about 1 minute.
- Push with remote `https://FGBEAUTYKOREA-jpg@github.com/...`. If the credential prompt fails once, retry.
- Build locally: `export PATH="/c/Program Files/nodejs:$PATH"; npx @11ty/eleventy` → `_site/`, plus the SEO report
  at `_site/admin/seo-report.html`. Preview: `.claude/launch.json` (one level up), config "seo-blog", port 5190.
  Screenshots: headless Edge (`msedge --headless=new --screenshot`); it cannot go narrower than ~500px.

## Adding a post the owner sends (usually a .md draft + images)
1. File `src/posts/<english-slug>.md`. URL = `/blog/<category>/<slug>/`.
2. Keep the owner's body text verbatim. Allowed format changes:
   - Drop the draft's own `# H1` (the layout prints the title).
   - Rewrite H2s in question form (the owner approved this).
   - Turn FAQ "Q./A." pairs into `### 질문?` + answer paragraph (FAQPage schema + Q/A cards).
   - Remove trailing "✍️ 정리/📅 발행/시리즈" lines (the layout shows them).
   - For series, remove "(n부에서 이어집니다)" lines; `series`/`series_part` renders the series box and prev/next.
3. Front matter: `title`, `lab_no` (next number; check existing posts), `keyword`, `category`, `author: lim-doyun`
   (임도윤 연구원 — no bio, the owner asked), `date` (add a time to order same-day posts), `tags`,
   `seo_title` (50–60 characters, **no brand suffix**), `description` (120–150 characters), `excerpt`,
   `thumb_en` / `thumb_ko` / `thumb_sub` (the LAB NOTE thumbnail is drawn at build time by lib/thumbs.js), `related`.
3a. Count lengths with node: `[...s].length`.
4. Images go in `src/assets/uploads/<topic>/`. Markdown image line, then an italic caption on the **next line**
   (same paragraph → figure caption style). Alt text is required (the admin blocks empty alt).
5. Build → check the report (aim for ≥ 90 points, no ❌ except Naver verification) → screenshot → commit → push →
   confirm the live URL returns 200.

## Adding a category
Edit `src/_data/categories.json`: `id` (English slug, never change once posts exist), `name`, `desc` (120–150
characters), `seo_title` (50–60 characters), `pillar` (slug of the category's main guide post, optional). The
header menu, category page, sitemap and llms.txt update automatically. An empty category is noindex until it
has a post.

## Rules
- Company facts come only from `src/_data/site.json › publisher` (from the business registration). Do not use the
  2015 "FG BEAUTY Co., Ltd." facts found on the web — that is a different company.
- Cosmetics-law caution: flag efficacy wording that is tied to FG products; do not edit the owner's claims silently.
- Design tokens are in `src/styles.css :root` (off-white #fbfaf7, ink #1f1f1f, logo teal #5fc0c8 / text #1d7a84).
