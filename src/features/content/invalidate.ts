import "server-only";
import { updateTag } from "next/cache";
import { tags } from "./tags";

/**
 * Call from admin Server Actions after a successful write. `updateTag` expires the entry
 * immediately so the admin sees their change on the next request (read-your-writes).
 */
export const invalidate = {
  site: () => updateTag(tags.site),
  page: (slug: string) => updateTag(tags.page(slug)),
  projects: (slug?: string) => {
    updateTag(tags.projects);
    if (slug) updateTag(tags.project(slug));
  },
  clients: () => updateTag(tags.clients),
  assets: () => updateTag(tags.assets),
};
