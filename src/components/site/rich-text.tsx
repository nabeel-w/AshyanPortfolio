import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Tiny markup for editor-authored headlines (no HTML in the DB):
 *   *words*   → red italic serif accent
 *   **WORDS** → small sans caps (Mario Monteiro-style mixed typography)
 *   plain     → inherits (serif)
 */
export function RichText({ text, accentClassName }: { text: string; accentClassName?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**")) {
          return (
            <span
              key={i}
              className="align-middle font-sans text-[0.42em] font-medium tracking-[0.08em] uppercase not-italic"
            >
              {part.slice(2, -2)}
            </span>
          );
        }
        if (part.startsWith("*")) {
          return (
            <em key={i} className={cn("text-red italic", accentClassName)}>
              {part.slice(1, -1)}
            </em>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
