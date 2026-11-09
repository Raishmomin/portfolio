// Near-duplicate generated posts are consolidated into one canonical post each
// (app/lib/blog-redirects.json, from-slug -> to-slug). 301 as the SEO rulebook
// requires; `:path*` also covers each post's opengraph-image.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the config file stays CommonJS
const blogRedirects = require("./app/lib/blog-redirects.json");

for (const [from, to] of Object.entries(blogRedirects)) {
  if (from === to || to in blogRedirects) {
    throw new Error(`blog-redirects.json: /blog/${from} -> /blog/${to} would loop or chain`);
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return Object.entries(blogRedirects).map(([from, to]) => ({
      source: `/blog/${from}/:path*`,
      destination: `/blog/${to}/:path*`,
      statusCode: 301,
    }));
  },
};

module.exports = nextConfig;
