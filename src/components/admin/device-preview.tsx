"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const DEVICES = {
  desktop: { label: "Desktop", width: 1440 },
  tablet: { label: "Tablet", width: 820 },
  phone: { label: "Phone", width: 390 },
} as const;
export type Device = keyof typeof DEVICES;

export function DeviceToggle({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  return (
    <div role="radiogroup" aria-label="Preview width" className="inline-flex rounded-md border border-border p-0.5">
      {(Object.keys(DEVICES) as Device[]).map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          onClick={() => onChange(d)}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            value === d ? "bg-red text-ivory" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {DEVICES[d].label}
        </button>
      ))}
    </div>
  );
}

/**
 * An iframe rendered at a real device width (so breakpoints behave exactly like the site)
 * and scaled down to fit its container.
 */
export const DevicePreview = forwardRef<HTMLIFrameElement, { src: string; device: Device; title: string }>(
  function DevicePreview({ src, device, title }, ref) {
    const box = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const width = DEVICES[device].width;

    useEffect(() => {
      const el = box.current;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => entry && setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const scale = size.w ? Math.min(1, size.w / width) : 1;
    return (
      <div ref={box} className="relative h-full w-full overflow-hidden rounded-md border border-border bg-ink">
        <iframe
          ref={ref}
          src={src}
          title={title}
          style={{
            width,
            height: scale ? size.h / scale : "100%",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            left: Math.max(0, (size.w - width * scale) / 2),
          }}
          className="absolute top-0 border-0 bg-ink"
        />
      </div>
    );
  },
);
