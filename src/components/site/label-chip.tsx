import Link from "next/link";
import { cn } from "@/lib/utils";

export type ChipLabel = { name: string; slug: string; count?: number };

/** Every label's public page. */
export const labelHref = (slug: string) => `/work/label/${slug}`;

/**
 * A work label as a real link (works without JS), in three looks (#28):
 *  - chip:  filter rails and the project page. Hairline box, mono caps, red dot when active, optional count.
 *  - tag:   on cards. Borderless mono caps; several sit in a row with a "·" separator.
 *  - crumb: the breadcrumb segment on project pages.
 * Every variant carries data-cta="label:<slug>" for analytics and a 44 px hit area.
 */
export function LabelChip({
  label,
  variant = "chip",
  active = false,
  href = labelHref(label.slug),
  className,
}: {
  label: ChipLabel;
  variant?: "chip" | "tag" | "crumb";
  active?: boolean;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      data-cta={`label:${label.slug}`}
      data-label-chip={label.slug}
      aria-current={active ? "page" : undefined}
      className={cn(
        "label hit-44 relative inline-flex shrink-0 items-center whitespace-nowrap transition-colors duration-300",
        variant === "chip" &&
          "h-7 gap-2.5 border px-2.5 snap-start border-foreground/20 text-muted-foreground hover:border-red hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground",
        variant === "tag" && "text-muted-foreground hover:text-foreground",
        variant === "crumb" && "text-smoke hover:text-ivory",
        className,
      )}
    >
      {variant === "chip" ? (
        // The dot follows aria-current in CSS, so the in-place filter only flips one attribute.
        <span aria-hidden className="hidden size-1.5 shrink-0 rounded-full bg-red [[aria-current=page]>&]:block" />
      ) : null}
      <span data-chip-name>{label.name}</span>
      {variant === "chip" && label.count !== undefined ? (
        <span className="text-smoke tabular-nums" aria-label={`${label.count} films`}>
          {String(label.count).padStart(2, "0")}
        </span>
      ) : null}
    </Link>
  );
}

/** Up to `max` labels as card tags with a "·" between them. */
export function LabelTags({ labels, max = 2, className }: { labels: ChipLabel[]; max?: number; className?: string }) {
  const shown = labels.slice(0, max);
  if (!shown.length) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-x-2", className)}>
      {shown.map((l, i) => (
        <span key={l.slug} className="inline-flex items-center gap-x-2">
          {i > 0 ? (
            <span aria-hidden className="label text-smoke">
              ·
            </span>
          ) : null}
          <LabelChip label={l} variant="tag" />
        </span>
      ))}
    </span>
  );
}
