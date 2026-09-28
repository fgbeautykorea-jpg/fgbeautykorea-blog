# SEO·GEO 블로그 (단독 블로그)

`블로그_SEO_GEO_기술스펙.md` 체크리스트를 그대로 구현한 단일 기업 블로그입니다.
Eleventy가 정적 HTML을 만들고, 글은 `/admin`(Decap CMS)에서 씁니다.

## 구조
| 무엇 | 파일 |
|---|---|
| 블로그 이름·주소·운영 주체·검색엔진/AI 설정 | `src/_data/site.json` (관리자 › 설정 › 사이트 설정) |
| 카테고리(필러·클러스터) / 작성자(Person) | `src/_data/categories.json`, `src/_data/authors.json` |
| 글 (`/blog/<카테고리>/<주소>/`) | `src/posts/*.md` |
| 고정 페이지 (`/about/` 등) | `src/pages/*.md` |
| SEO 규칙 (빌드 + 관리자 실시간 점검표 공용) | `src/admin/seo-core.js`, `src/admin/seo-preview.js` |
| head 태그·JSON-LD·관련 글 / 빌드 후 점검 리포트 | `lib/seo.js`, `lib/audit.js` → `/admin/seo-report.html` |
| robots.txt · sitemap.xml · feed.xml · llms.txt · llms-full.txt · _redirects | `src/root/*.njk` |

## 명령
- `npm run build` — `_site/` 생성 + SEO 점검 리포트
- `npx decap-server` + `_site` 서빙 — 관리자 로컬 테스트

## 배포 전 바꿀 것
1. 관리자 › 설정 › 사이트 설정: 블로그 이름, **블로그 주소**, **운영 주체**(회사명·대표·설립일·주소·이메일), 네이버/구글 인증 코드
2. 관리자 › 설정 › 작성자: 실제 작성자 이름·직함·경력
3. `src/admin/config.yml`의 `backend.repo`, `site_url`
4. 샘플 글 3개는 예시입니다. 지우거나 바꿔 쓰세요.
