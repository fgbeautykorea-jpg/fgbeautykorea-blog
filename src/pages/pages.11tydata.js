// Pages written in 관리자 › 페이지 are published at /<file-name>/ (e.g. /about/, /privacy/)
export default {
  layout: "layouts/page.njk",
  permalink: (data) => `/${data.page.fileSlug}/index.html`,
};
