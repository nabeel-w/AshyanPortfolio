"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AssetSummary } from "@/features/media/summary";
import {
  pageShareCard,
  shareChecks,
  siteShareSchema,
  titleTemplateFor,
  type PageShareInput,
  type ShareImage,
  type ShareTemplate,
  type SiteShareInput,
} from "@/features/seo/share";
import { saveShareSettings } from "@/features/settings/actions";
import { cn } from "@/lib/utils";
import { MediaPicker } from "../media-picker";
import { SharePreview, type PreviewTarget } from "./share-preview";

const TEMPLATES: { value: ShareTemplate; label: string; hint: string }[] = [
  { value: "still", label: "Still + headline", hint: "Background still, ink gradient, headline" },
  { value: "type", label: "Type only (ink)", hint: "No image, the headline set large" },
  { value: "portrait", label: "Portrait split (reels)", hint: "9:16 still left, title panel right" },
];

const fieldLabel = "mb-2 block text-xs font-medium tracking-wide text-muted-foreground uppercase";

export function TemplatePicker({
  value,
  onChange,
  allowDefault,
}: {
  value: ShareTemplate | null | undefined;
  onChange: (v: ShareTemplate | null) => void;
  allowDefault?: string;
}) {
  return (
    <fieldset>
      <legend className={fieldLabel}>Template</legend>
      <div className="grid gap-1.5">
        {allowDefault ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="radio" checked={!value} onChange={() => onChange(null)} /> {allowDefault}
          </label>
        ) : null}
        {TEMPLATES.map((t) => (
          <label key={t.value} className="flex items-center gap-2 text-sm" title={t.hint}>
            <input type="radio" checked={value === t.value} onChange={() => onChange(t.value)} />
            <span className="text-ivory">{t.label}</span>
            <span className="text-xs text-muted-foreground">{t.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Pick the card's background and drag (or click) on it to set the focal point kept in frame. */
export function ShareBackgroundField({
  image,
  focal,
  onImage,
  onFocal,
  emptyLabel = "Using the home hero still",
}: {
  image: ShareImage | null | undefined;
  focal: { x: number; y: number };
  onImage: (img: ShareImage | null) => void;
  onFocal: (f: { x: number; y: number }) => void;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const setFrom = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
    onFocal({ x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) });
  };
  return (
    <div>
      <p className={fieldLabel}>Background</p>
      <div className="flex items-start gap-3">
        {image ? (
          <div
            role="slider"
            aria-label="Focal point (drag on the image)"
            aria-valuetext={`${Math.round(focal.x * 100)}% across, ${Math.round(focal.y * 100)}% down`}
            aria-valuenow={Math.round(focal.x * 100)}
            tabIndex={0}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 0.1 : 0.02;
              const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
              if (!d) return;
              e.preventDefault();
              onFocal({ x: Math.min(1, Math.max(0, focal.x + d[0]!)), y: Math.min(1, Math.max(0, focal.y + d[1]!)) });
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setFrom(e);
            }}
            onPointerMove={(e) => e.buttons === 1 && setFrom(e)}
            className="relative w-48 shrink-0 cursor-crosshair touch-none overflow-hidden rounded-md border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview, any storage host */}
            <img src={image.src} alt="" className="block h-auto w-full select-none" draggable={false} />
            <span
              aria-hidden
              className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ivory bg-red shadow"
              style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
            />
          </div>
        ) : (
          <div className="grid h-24 w-48 shrink-0 place-items-center rounded-md border border-dashed border-border px-2 text-center text-xs text-muted-foreground">
            {emptyLabel}
          </div>
        )}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
              {image ? "Replace" : "Pick image"}
            </Button>
            {image ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onImage(null)}>
                Reset
              </Button>
            ) : null}
          </div>
          {image ? (
            <p className="text-xs text-muted-foreground">
              Drag on the image to choose what stays in frame ({Math.round(focal.x * 100)}%, {Math.round(focal.y * 100)}%).
            </p>
          ) : null}
        </div>
      </div>
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind="IMAGE"
        title="Choose a share background"
        onPick={(a: AssetSummary) =>
          a.url && onImage({ id: a.id, src: a.url, width: a.width ?? undefined, height: a.height ?? undefined })
        }
      />
    </div>
  );
}

export type ShareTargetOption = {
  key: string;
  group: "Pages" | "Projects" | "Labels";
  label: string;
  target: PreviewTarget;
  path: string;
  title: string | null;
  description: string;
};

/**
 * Settings → Sharing & SEO (#33): the site card and the search/social defaults, with a live preview of
 * the card any page would get. Saving changes every affected card URL (?v=), so chat apps refetch.
 */
export function ShareSettingsForm({
  initial,
  targets,
  site,
  siteUrl,
}: {
  initial: SiteShareInput;
  targets: ShareTargetOption[];
  site: { name: string; role: string; location: string; description: string };
  siteUrl: string;
}) {
  const [value, setValue] = useState<SiteShareInput>(initial);
  const [saved, setSaved] = useState(initial);
  const [targetKey, setTargetKey] = useState(targets[0]?.key ?? "page:home");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bytes, setBytes] = useState<number>();
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const set = (patch: Partial<SiteShareInput>) => {
    setValue((v) => ({ ...v, ...patch }));
    setJustSaved(false);
  };

  const target = targets.find((t) => t.key === targetKey) ?? targets[0]!;
  const parsed = siteShareSchema.safeParse(value);
  const settings = parsed.success ? parsed.data : siteShareSchema.parse({});
  const template = titleTemplateFor(settings, site.name);
  const title = target.title ? template.replace("%s", target.title) : `${site.name} — ${site.role}`;
  const description = target.key === "page:home" ? settings.defaultDescription || site.description : target.description;
  const url = new URL(target.path, siteUrl).toString();
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  const checks = shareChecks({
    card: pageShareCard({ site, settings }),
    settings,
    title,
    description,
    imageSize: settings.image ?? undefined,
    bytes,
  });
  const focal = { x: value.focalX ?? 0.5, y: value.focalY ?? 0.5 };
  const headlineLength = (value.headline ?? "").replace(/\*/g, "").length;

  function save() {
    startTransition(async () => {
      const res = await saveShareSettings(value);
      if (!res.ok) {
        setErrors(res.errors);
        toast.error(Object.values(res.errors)[0] ?? "Please fix the highlighted fields");
        return;
      }
      setErrors({});
      setSaved(value);
      setJustSaved(true);
      toast.success("Share settings saved — every card has a new link, so apps refetch it");
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <form
        className="space-y-6 rounded-md border border-border bg-onyx p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <label htmlFor="share-target" className={fieldLabel}>
            Preview page
          </label>
          <select
            id="share-target"
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {(["Pages", "Projects", "Labels"] as const).map((g) => {
              const list = targets.filter((t) => t.group === g);
              return list.length ? (
                <optgroup key={g} label={g}>
                  {list.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">Projects use their cover and title; pages and labels use the card below.</p>
        </div>

        <TemplatePicker value={value.template ?? "still"} onChange={(t) => set({ template: t ?? "still" })} />
        <ShareBackgroundField
          image={value.image}
          focal={focal}
          onImage={(image) => set({ image })}
          onFocal={(f) => set({ focalX: f.x, focalY: f.y })}
        />
        <div>
          <label htmlFor="share-overlay" className={fieldLabel}>
            Overlay · {value.overlay ?? 72}%
          </label>
          <input
            id="share-overlay"
            type="range"
            min={0}
            max={100}
            value={value.overlay ?? 72}
            onChange={(e) => set({ overlay: Number(e.target.value) })}
            className="w-full accent-[var(--cinema-red)]"
          />
          {value.overlay != null ? (
            <button type="button" className="text-xs text-muted-foreground hover:text-ivory" onClick={() => set({ overlay: null })}>
              Reset to default
            </button>
          ) : null}
        </div>
        <div>
          <label htmlFor="share-headline" className={fieldLabel}>
            Headline <span className="normal-case">({headlineLength}/60)</span>
          </label>
          <Textarea
            id="share-headline"
            rows={2}
            value={value.headline ?? ""}
            placeholder="Empty = the home hero headline. *italic red* for the accent"
            onChange={(e) => set({ headline: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="share-meta" className={fieldLabel}>
            Meta line
          </label>
          <Input
            id="share-meta"
            value={value.meta ?? ""}
            placeholder={[site.role, site.location].filter(Boolean).join(" · ").toUpperCase()}
            onChange={(e) => set({ meta: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={value.showMonogram ?? true} onCheckedChange={(c) => set({ showMonogram: Boolean(c) })} /> Monogram
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={value.showWordmark ?? true} onCheckedChange={(c) => set({ showWordmark: Boolean(c) })} /> Wordmark
          </label>
        </div>
        <div>
          <label htmlFor="share-alt" className={fieldLabel}>
            Alt text
          </label>
          <Input id="share-alt" value={value.alt ?? ""} placeholder={`${site.name}, ${site.role.toLowerCase()}`} onChange={(e) => set({ alt: e.target.value })} />
        </div>

        <div className="space-y-4 border-t border-border pt-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Search &amp; social defaults</p>
          <div>
            <label htmlFor="share-template" className={fieldLabel}>
              Title template
            </label>
            <Input id="share-template" value={value.titleTemplate ?? "%s — {name}"} onChange={(e) => set({ titleTemplate: e.target.value })} />
            <p className="mt-1.5 text-xs text-muted-foreground">%s is the page title, {"{name}"} your name.</p>
            {errors.titleTemplate ? <p className="mt-1 text-xs text-red-bright">{errors.titleTemplate}</p> : null}
          </div>
          <div>
            <label htmlFor="share-description" className={fieldLabel}>
              Default description <span className="normal-case">({(value.defaultDescription ?? "").length}/160)</span>
            </label>
            <Textarea
              id="share-description"
              rows={3}
              value={value.defaultDescription ?? ""}
              placeholder="Empty = your short bio"
              onChange={(e) => set({ defaultDescription: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="share-handle" className={fieldLabel}>
              X / Twitter handle
            </label>
            <Input id="share-handle" value={value.twitterHandle ?? ""} placeholder="@ashyanzafar" onChange={(e) => set({ twitterHandle: e.target.value })} />
            {errors.twitterHandle ? <p className="mt-1 text-xs text-red-bright">{errors.twitterHandle}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" disabled={pending || !dirty} onClick={() => setValue(saved)}>
            Discard
          </Button>
        </div>
        {justSaved ? <RefreshCaches url={url} /> : null}
      </form>

      <div className="space-y-4">
        <SharePreview target={target.target} settings={value} context={{ title, description, url }} onBytes={setBytes} />
        <ShareChecks checks={checks} />
      </div>
    </div>
  );
}

export function ShareChecks({ checks }: { checks: { field: string; message: string }[] }) {
  if (!checks.length) return <p className="text-xs text-emerald-400">✓ Title, description and card look good.</p>;
  return (
    <ul className="space-y-1" aria-label="Suggestions">
      {checks.map((c) => (
        <li key={`${c.field}-${c.message}`} className="text-xs text-amber-300">
          ⚠ {c.message}
        </li>
      ))}
    </ul>
  );
}

/** After a save: links to the platforms' own re-scrape tools, and the URL to paste into a chat. */
export function RefreshCaches({ url }: { url: string }) {
  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
      <p>The card link changed, so new shares pick it up. To refresh a link that was already shared:</p>
      <div className="flex flex-wrap gap-2">
        <a className="underline hover:text-ivory" href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
          Facebook Sharing Debugger ↗
        </a>
        <a className="underline hover:text-ivory" href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
          LinkedIn Post Inspector ↗
        </a>
        <button
          type="button"
          className="underline hover:text-ivory"
          onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))}
        >
          Copy test link
        </button>
      </div>
      <p>X has no manual tool; the new link handles it.</p>
    </div>
  );
}

/**
 * A page's or project's own card (#33): template, background + focal point, headline, meta. Empty
 * fields fall through to Settings (pages) or the cover and title (projects). Includes the live preview.
 */
export function ShareOverrideEditor({
  value,
  onChange,
  target,
  context,
  defaults,
}: {
  value: PageShareInput;
  onChange: (v: PageShareInput) => void;
  target: PreviewTarget;
  context: { title: string; description: string; url: string };
  defaults: { headline: string; background: string; template: string };
}) {
  const set = (patch: Partial<PageShareInput>) => onChange({ ...value, ...patch });
  const [show, setShow] = useState(Boolean(value.headline || value.image || value.meta || value.template));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Share card</p>
        <button type="button" onClick={() => setShow((s) => !s)} className="text-xs text-muted-foreground hover:text-ivory">
          {show ? "Hide" : "Customise & preview"}
        </button>
      </div>
      {show ? (
        <>
          <TemplatePicker value={value.template ?? null} onChange={(template) => set({ template })} allowDefault={`Default (${defaults.template})`} />
          <ShareBackgroundField
            image={value.image}
            focal={{ x: value.focalX ?? 0.5, y: value.focalY ?? 0.5 }}
            onImage={(image) => set({ image })}
            onFocal={(f) => set({ focalX: f.x, focalY: f.y })}
            emptyLabel={defaults.background}
          />
          <div>
            <label className={fieldLabel} htmlFor={`share-h-${target.slug}`}>
              Headline
            </label>
            <Input id={`share-h-${target.slug}`} value={value.headline ?? ""} placeholder={defaults.headline} onChange={(e) => set({ headline: e.target.value })} />
          </div>
          <div>
            <label className={fieldLabel} htmlFor={`share-m-${target.slug}`}>
              Meta line
            </label>
            <Input id={`share-m-${target.slug}`} value={value.meta ?? ""} placeholder="Default" onChange={(e) => set({ meta: e.target.value })} />
          </div>
          <SharePreview target={target} override={value} context={context} />
        </>
      ) : (
        <p className={cn("text-xs text-muted-foreground")}>Uses the default card. Customise to change its image, headline or template.</p>
      )}
    </div>
  );
}
