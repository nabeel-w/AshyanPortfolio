"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupYouTube } from "@/features/projects/actions";
import { orientationFromUrl, parseRuntime, parseYouTubeUrl, thumbnailUrl, watchUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

export type FilmOrientation = "LANDSCAPE" | "PORTRAIT" | "SQUARE";

export type YouTubeFilmValue = {
  filmUrl: string;
  filmOrientation: FilmOrientation;
  filmAspect?: number | null;
  filmRuntime: string;
};

const ORIENTATIONS: { value: FilmOrientation; label: string; hint: string }[] = [
  { value: "LANDSCAPE", label: "Landscape", hint: "16:9 long-form" },
  { value: "PORTRAIT", label: "Portrait", hint: "9:16 reel / Short" },
  { value: "SQUARE", label: "Square", hint: "1:1" },
];

/**
 * The project's film: a YouTube link plus its shape. Orientation is prefilled from the link (a /shorts/
 * link is portrait) and can be overridden; it decides the grid tile and the project page layout.
 */
export function YouTubeFilmField({
  value,
  onChange,
  onUseTitle,
  errors = {},
}: {
  value: YouTubeFilmValue;
  onChange: (patch: Partial<YouTubeFilmValue>) => void;
  onUseTitle?: (title: string) => void;
  errors?: Record<string, string>;
}) {
  const parsed = parseYouTubeUrl(value.filmUrl);
  const invalid = Boolean(value.filmUrl.trim()) && !parsed;
  const runtimeInvalid = Boolean(value.filmRuntime.trim()) && parseRuntime(value.filmRuntime) === null;
  const [advanced, setAdvanced] = useState(Boolean(value.filmAspect));
  const [lookup, setLookup] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setUrl(filmUrl: string) {
    const next = parseYouTubeUrl(filmUrl);
    const prev = parseYouTubeUrl(value.filmUrl);
    // Only auto-switch orientation when the kind of link changes, so a manual choice sticks.
    const patch: Partial<YouTubeFilmValue> = { filmUrl };
    if (next && next.kind !== prev?.kind) patch.filmOrientation = orientationFromUrl(filmUrl) === "portrait" ? "PORTRAIT" : "LANDSCAPE";
    onChange(patch);
    setLookup(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="filmUrl" className="mb-2 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Film (YouTube link)
        </label>
        <Input
          id="filmUrl"
          value={value.filmUrl}
          inputMode="url"
          placeholder="https://youtu.be/… or https://youtube.com/shorts/…"
          aria-invalid={invalid || Boolean(errors.filmUrl)}
          aria-describedby="filmUrl-help"
          onChange={(e) => setUrl(e.target.value)}
        />
        <p id="filmUrl-help" className="mt-1.5 text-xs text-muted-foreground">
          Public or unlisted, with embedding allowed. Nothing loads from YouTube until a visitor presses play.
          YouTube may still suggest videos from the same channel at the end.
        </p>
        {invalid || errors.filmUrl ? (
          <p className="mt-1.5 text-xs text-red-bright">{errors.filmUrl ?? "That isn't a YouTube watch, youtu.be or /shorts/ link."}</p>
        ) : null}
      </div>

      {parsed ? (
        <div className="flex items-start gap-3">
          <a
            href={watchUrl(parsed.id, parsed.kind)}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "relative block shrink-0 overflow-hidden rounded-md border border-border bg-graphite hover:border-red",
              value.filmOrientation === "PORTRAIT" ? "aspect-[9/16] w-20" : value.filmOrientation === "SQUARE" ? "aspect-square w-28" : "aspect-video w-44",
            )}
            aria-label="Open on YouTube"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview from i.ytimg.com */}
            <img src={thumbnailUrl(parsed.id, "hqdefault")} alt="" className="absolute inset-0 size-full object-cover" />
          </a>
          <div className="min-w-0 space-y-2 text-xs text-muted-foreground">
            <p>
              Detected: <span className="text-ivory">{parsed.kind === "short" ? "Short → Portrait" : parsed.kind === "live" ? "Live video → Landscape" : "Video → Landscape"}</span>
              {parsed.start ? ` · starts at ${parsed.start}s` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" render={<a href={watchUrl(parsed.id, parsed.kind)} target="_blank" rel="noreferrer" />}>
                Open on YouTube ↗
              </Button>
              {onUseTitle ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await lookupYouTube(value.filmUrl);
                      if (res.ok) {
                        onUseTitle(res.title);
                        setLookup(`Title set to “${res.title}”`);
                      } else setLookup(res.error);
                    })
                  }
                >
                  {pending ? "Asking YouTube…" : "Use YouTube title"}
                </Button>
              ) : null}
            </div>
            {lookup ? <p role="status">{lookup}</p> : null}
          </div>
        </div>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Orientation</legend>
        <div className="inline-flex flex-wrap rounded-md border border-border p-0.5" role="radiogroup" aria-label="Orientation">
          {ORIENTATIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={value.filmOrientation === o.value}
              onClick={() => onChange({ filmOrientation: o.value })}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                value.filmOrientation === o.value ? "bg-graphite text-ivory" : "text-muted-foreground hover:text-ivory",
              )}
              title={o.hint}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Sets the grid tile and the project page layout. Portrait reels get a 9:16 player beside the text.</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="filmRuntime" className="mb-2 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Runtime
          </label>
          <Input
            id="filmRuntime"
            value={value.filmRuntime}
            placeholder="2:41"
            inputMode="numeric"
            aria-invalid={runtimeInvalid || Boolean(errors.filmRuntime)}
            onChange={(e) => onChange({ filmRuntime: e.target.value })}
          />
          {runtimeInvalid || errors.filmRuntime ? (
            <p className="mt-1.5 text-xs text-red-bright">{errors.filmRuntime ?? "Use minutes:seconds, e.g. 2:41"}</p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">Shown as “Play film · 2:41” and given to search engines.</p>
          )}
        </div>
        <div>
          {advanced ? (
            <>
              <label htmlFor="filmAspect" className="mb-2 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Exact aspect (width ÷ height)
              </label>
              <Input
                id="filmAspect"
                type="number"
                step="0.01"
                min={0.25}
                max={4}
                value={value.filmAspect ?? ""}
                placeholder="e.g. 2.39"
                onChange={(e) => onChange({ filmAspect: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Optional. Leave empty for 16:9 / 9:16 / 1:1.</p>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" className="mt-6" onClick={() => setAdvanced(true)}>
              Set an exact aspect…
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
