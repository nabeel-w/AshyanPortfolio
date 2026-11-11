import { brandFromUrl, BrandIcon } from "@/components/icons/brand-icons";
import { cn } from "@/lib/utils";

/** Brand glyph for a profile URL (Instagram, Vimeo, YouTube, LinkedIn, IMDb, Behance…); a ↗ otherwise. */
export function SocialIcon({ href, className }: { href: string; className?: string }) {
  const brand = brandFromUrl(href);
  if (!brand) return <span aria-hidden className={cn("inline-block text-center leading-none", className)}>↗</span>;
  return <BrandIcon brand={brand} className={cn("size-3.5 shrink-0", className)} />;
}
