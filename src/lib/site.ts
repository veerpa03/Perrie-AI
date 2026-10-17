/**
 * The site's public, absolute base URL (no trailing slash) — for metadata,
 * robots.txt, sitemap.xml and canonical/OG tags. Same PUBLIC_BASE_URL the
 * voice backend uses (see src/server/env.ts): one public URL serves the
 * marketing site and live calls alike. Falls back to a clearly-fake
 * placeholder when unset, so it's obvious to replace rather than silently
 * wrong.
 */
export function siteUrl(): string {
  const raw = process.env.PUBLIC_BASE_URL?.trim();
  return (raw || "https://replace-with-your-production-domain.example").replace(/\/+$/, "");
}
