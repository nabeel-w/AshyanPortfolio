"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { sectionFields } from "@/features/admin/fields";
import { saveSectionDraft } from "@/features/pages/actions";
import { sectionSchemas, type SectionType } from "@/features/sections/schemas";
import { cn } from "@/lib/utils";
import { DevicePreview, DeviceToggle, type Device } from "./device-preview";
import { SchemaForm } from "./schema-form";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "invalid"; count: number } | { kind: "error"; message: string };

/**
 * Text-content form on the left, live iframe preview of the section on the right.
 * Every valid change is pushed to the preview instantly (postMessage) and autosaved as a draft.
 * Nothing goes live until the page is published.
 */
export function SectionEditor({
  section,
  page,
  label,
}: {
  section: { id: string; type: SectionType; data: Record<string, unknown> };
  page: { slug: string; title: string };
  label: string;
}) {
  const [value, setValue] = useState(section.data);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [device, setDevice] = useState<Device>("desktop");
  const [mobilePane, setMobilePane] = useState<"form" | "preview">("form");
  const frame = useRef<HTMLIFrameElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(value);

  const push = useCallback(
    (data: unknown) => {
      frame.current?.contentWindow?.postMessage({ type: "az:preview:update", id: section.id, data }, window.location.origin);
    },
    [section.id],
  );

  // Re-sync the preview once the iframe (re)loads, e.g. after switching device width.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "az:preview:ready") return;
      const parsed = sectionSchemas[section.type].safeParse(latest.current);
      if (parsed.success) push(parsed.data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [push, section.type]);

  function onChange(next: Record<string, unknown>) {
    setValue(next);
    latest.current = next;
    const parsed = sectionSchemas[section.type].safeParse(next);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join(".") || "_"] ??= i.message;
      setErrors(errs);
      setStatus({ kind: "invalid", count: Object.keys(errs).length });
      return;
    }
    setErrors({});
    push(parsed.data);
    clearTimeout(timer.current);
    setStatus({ kind: "saving" });
    timer.current = setTimeout(async () => {
      try {
        const res = await saveSectionDraft(section.id, latest.current);
        if (res.ok) setStatus({ kind: "saved", at: new Date(res.savedAt) });
        else {
          setErrors(res.errors);
          setStatus({ kind: "invalid", count: Object.keys(res.errors).length });
        }
      } catch (e) {
        setStatus({ kind: "error", message: e instanceof Error ? e.message : "Save failed" });
      }
    }, 700);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col gap-4 md:h-[calc(100dvh-4rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/pages/${page.slug}`} className="text-xs text-muted-foreground hover:text-foreground">
            ← {page.title}
          </Link>
          <h1 className="truncate font-serif text-3xl text-ivory">{label}</h1>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={status} />
          <DeviceToggle value={device} onChange={setDevice} />
          <Button size="sm" render={<Link href={`/admin/pages/${page.slug}`} />}>
            Done
          </Button>
        </div>
      </header>

      <div className="flex gap-2 lg:hidden" role="tablist">
        {(["form", "preview"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={mobilePane === p}
            onClick={() => setMobilePane(p)}
            className={cn("rounded-md px-3 py-1.5 text-sm capitalize", mobilePane === p ? "bg-graphite text-ivory" : "text-muted-foreground")}
          >
            {p === "form" ? "Content" : "Preview"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(22rem,30rem)_1fr]">
        <div className={cn("min-h-0 overflow-y-auto rounded-md border border-border bg-onyx p-5", mobilePane === "preview" && "hidden lg:block")}>
          <SchemaForm fields={sectionFields[section.type]} value={value} onChange={onChange} errors={errors} />
        </div>
        <div className={cn("min-h-[60dvh] lg:min-h-0", mobilePane === "form" && "hidden lg:block")}>
          <DevicePreview ref={frame} key={device} device={device} src={`/preview/${page.slug}?section=${section.id}`} title={`Preview of ${label}`} />
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ status }: { status: Status }) {
  const text =
    status.kind === "saving"
      ? "Saving draft…"
      : status.kind === "saved"
        ? `Draft saved ${status.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : status.kind === "invalid"
          ? `${status.count} field${status.count === 1 ? "" : "s"} to fix`
          : status.kind === "error"
            ? status.message
            : "Changes save automatically";
  const tone = status.kind === "invalid" || status.kind === "error" ? "text-red-bright" : "text-muted-foreground";
  return (
    <span role="status" aria-live="polite" className={cn("text-xs", tone)}>
      {text}
    </span>
  );
}
