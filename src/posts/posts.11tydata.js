// Every post in this folder: post layout, published at /blog/<category>/<file-name>/
export default {
  layout: "layouts/post.njk",
  isPost: true,
  permalink: (data) => `/blog/${data.category || "uncategorized"}/${data.page.fileSlug}/index.html`,
};
