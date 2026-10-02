/**
 * Static export: `npm run build` writes a plain website to ./out that any free static host can serve
 * (GitHub Pages, Cloudflare Pages, Netlify…). Everything runs in the browser; the token never leaves it.
 * For GitHub Pages under /ronnekoll-admin set NEXT_PUBLIC_BASE_PATH=/ronnekoll-admin when building.
 * @type {import('next').NextConfig}
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
};
export default nextConfig;
