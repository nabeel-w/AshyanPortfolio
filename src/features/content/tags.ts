/**
 * Cache tags for public content. Every cached query tags itself with one of these, and every
 * admin mutation invalidates the matching tag (see invalidate.ts). Keep the two in sync.
 */
export const tags = {
  site: "site",
  page: (slug: string) => `page:${slug}`,
  projects: "projects",
  project: (slug: string) => `project:${slug}`,
  clients: "clients",
  assets: "assets",
} as const;
