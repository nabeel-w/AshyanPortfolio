"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { WHATSAPP_MAX_BYTES, type PageShareInput, type SiteShareInput } from "@/features/seo/share";

export type PreviewTarget = { kind: "page" | "project" | "label"; slug: string };
export type PreviewContext = { title: string; description: string; url: string };

const TABS = ["Card", "WhatsApp", "iMessage", "LinkedIn", "X", "Google"] as const;
type Tab = (typeof TABS)[number];

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Live share-card preview (#33). Renders the draft with the real renderer (POST /api/admin/og-preview,
 * 400 ms after the last change), keeps the last good card on screen while the next one renders, and
 * frames it the way each app shows a link. Reports the JPEG's size against WhatsApp's 300 KB limit.
 */
export function SharePreview({
  target,
  settings,
  override,
  context,
  onBytes,
}: {
  target: PreviewTarget;
  settings?: SiteShareInput;
  override?: PageShareInput;
  context: PreviewContext;
  onBytes?: (bytes: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("Card");
  const [dark, setDark] = useState(true);
  const [image, setImage] = useState<{ url: string; bytes: number } | null>(null);
  const [state, setState] = useState<"idle" | "rendering" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const lastUrl = useRef<string | null>(null);
  const key = JSON.stringify({ target, settings, override });

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("rendering");
      try {
        const res = await fetch("/api/admin/og-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: key,
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Preview failed (${res.status})`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = url;
        setImage({ url, bytes: blob.size });
        onBytes?.(blob.size);
        setError(null);
        setState("idle");
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Preview failed");
        setState("error");
      }
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` serialises every input
  }, [key]);

  useEffect(() => () => void (lastUrl.current && URL.revokeObjectURL(lastUrl.current)), []);

  const domain = (() => {
    try {
      return new URL(context.url).host;
    } catch {
      return context.url;
    }
  })();
  const img = image ? (
    // eslint-disable-next-line @next/next/no-img-element -- blob URL of the rendered card
    <img src={image.url} alt="Share card preview" width={1200} height={630} className="block h-auto w-full" />
  ) : (
    <div className="grid aspect-[1200/630] w-full place-items-center bg-graphite text-xs text-muted-foreground">
      {state === "error" ? "No preview" : "Rendering…"}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Preview as" className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded px-2.5 py-1 text-xs transition-colors",
                tab === t ? "bg-graphite text-ivory" : "text-muted-foreground hover:text-ivory",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {tab !== "Card" && tab !== "Google" ? (
          <button type="button" onClick={() => setDark((d) => !d)} className="text-xs text-muted-foreground hover:text-ivory">
            {dark ? "Dark" : "Light"} mode
          </button>
        ) : null}
      </div>

      <div className={cn("relative transition-opacity", state === "rendering" && image && "opacity-80")} aria-live="polite">
        {tab === "Card" ? (
          <div className="overflow-hidden rounded-md border border-border">{img}</div>
        ) : tab === "WhatsApp" ? (
          <ChatFrame dark={dark} tone={dark ? "#0b141a" : "#efeae2"}>
            <div className={cn("ml-auto max-w-[22rem] rounded-lg p-1", dark ? "bg-[#005c4b] text-[#e9edef]" : "bg-[#d9fdd3] text-[#111b21]")}>
              <div className={cn("overflow-hidden rounded-md", dark ? "bg-[#025144]" : "bg-[#cff5c9]")}>
                {img}
                <div className="space-y-0.5 px-2.5 py-2">
                  <p className="text-[13px] leading-snug font-semibold">{cut(context.title, 80)}</p>
                  <p className="line-clamp-2 text-xs opacity-80">{context.description}</p>
                  <p className="text-[11px] opacity-60">{domain}</p>
                </div>
              </div>
              <p className="px-1.5 pt-1 pb-0.5 text-[13px] text-[#53bdeb] underline">{context.url}</p>
            </div>
          </ChatFrame>
        ) : tab === "iMessage" ? (
          <ChatFrame dark={dark} tone={dark ? "#000" : "#fff"}>
            <div className={cn("ml-auto max-w-[20rem] overflow-hidden rounded-2xl", dark ? "bg-[#262628] text-white" : "bg-[#e9e9eb] text-black")}>
              {img}
              <div className="px-3 py-2">
                <p className="text-[13px] leading-snug font-semibold">{cut(context.title, 60)}</p>
                <p className="text-xs opacity-60">{domain}</p>
              </div>
            </div>
          </ChatFrame>
        ) : tab === "LinkedIn" ? (
          <ChatFrame dark={dark} tone={dark ? "#1b1f23" : "#f4f2ee"}>
            <div className={cn("overflow-hidden rounded-lg border", dark ? "border-[#38434f] bg-[#1b1f23] text-white" : "border-[#e0dfdc] bg-white text-black")}>
              {/* LinkedIn crops to 1.91:1 */}
              <div className="aspect-[1.91/1] overflow-hidden [&_img]:h-full [&_img]:object-cover">{img}</div>
              <div className="px-3 py-2">
                <p className="text-sm leading-snug font-semibold">{cut(context.title, 70)}</p>
                <p className="text-xs opacity-60">{domain}</p>
              </div>
            </div>
          </ChatFrame>
        ) : tab === "X" ? (
          <ChatFrame dark={dark} tone={dark ? "#000" : "#fff"}>
            <div className={cn("relative overflow-hidden rounded-2xl border", dark ? "border-[#2f3336]" : "border-[#cfd9de]")}>
              <div className="aspect-[1.91/1] overflow-hidden [&_img]:h-full [&_img]:object-cover">{img}</div>
              <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded bg-black/70 px-1.5 py-0.5 text-[12px] text-white">
                {cut(context.title, 70)}
              </span>
            </div>
            <p className={cn("mt-1 text-[13px]", dark ? "text-[#71767b]" : "text-[#536471]")}>From {domain}</p>
          </ChatFrame>
        ) : (
          <div className="rounded-md bg-white p-4 font-[arial,sans-serif]">
            <p className="text-xs text-[#202124]">
              {domain} <span className="text-[#5f6368]">› {new URL(context.url, "https://x").pathname.split("/").filter(Boolean).join(" › ")}</span>
            </p>
            <p className="mt-1 truncate text-xl leading-snug text-[#1a0dab]">{cut(context.title, 60)}</p>
            <p className="mt-1 line-clamp-2 text-sm text-[#4d5156]">{cut(context.description, 160)}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        1200×630 · JPEG
        {image ? (
          <>
            {" · "}
            {Math.round(image.bytes / 1024)} KB{" "}
            {image.bytes <= WHATSAPP_MAX_BYTES ? (
              <span className="text-emerald-400">✓ under 300 KB (WhatsApp)</span>
            ) : (
              <span className="text-red-bright">✗ over 300 KB: WhatsApp won&apos;t show it</span>
            )}
          </>
        ) : null}
        {state === "rendering" ? " · rendering…" : null}
      </p>
      {error ? <p className="text-xs text-red-bright">{error}</p> : null}
    </div>
  );
}

function ChatFrame({ children, dark, tone }: { children: React.ReactNode; dark: boolean; tone: string }) {
  return (
    <div className="rounded-md p-4" style={{ background: tone }} data-theme={dark ? "dark" : "light"}>
      {children}
    </div>
  );
}
