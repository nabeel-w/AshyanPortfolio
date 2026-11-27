"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { track } from "@/features/analytics/track";
import { createVideoTracker } from "@/features/analytics/video";
import { addListenerMessage, applyYouTubeMessage, listeningMessage } from "@/features/analytics/youtube";
import { clockDuration } from "@/features/media/delivery";
import { embedUrl, type VideoOrientation } from "@/lib/youtube";
import { cn } from "@/lib/utils";

export type YouTubeFilmProps = {
  youtubeId: string;
  title: string;
  /** The project cover: a normal optimised image, the page's LCP. */
  poster: { src: string; alt: string; blurDataUrl?: string };
  duration?: number;
  /** width / height of the box (9/16 for a Short) */
  aspect: number;
  orientation: VideoOrientation;
  start?: number;
  /** LCP image on project pages: preload + fetchPriority high */
  priority?: boolean;
  /** `sizes` for the poster (the box is narrower than the viewport in the portrait layout) */
  sizes?: string;
  className?: string;
  style?: React.CSSProperties;
};

const PRECONNECT = ["https://www.youtube-nocookie.com", "https://i.ytimg.com", "https://www.google.com"];
let warmed = false;

/** Open the connections a click will need, once per page, without fetching anything. */
function warm() {
  if (warmed) return;
  warmed = true;
  for (const href of PRECONNECT) {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "";
    document.head.append(link);
  }
}

/**
 * Click-to-play YouTube facade. Before a click there is no iframe and no YouTube byte on the page: only
 * the poster and a real <button>. The click injects a privacy-enhanced (nocookie) embed with autoplay,
 * which the user gesture allows with sound. Play analytics come from the player's postMessage stream
 * (features/analytics/youtube.ts), so iframe_api is never loaded.
 */
export function YouTubeFilm({
  youtubeId,
  title,
  poster,
  duration,
  aspect,
  orientation,
  start,
  priority,
  sizes = "100vw",
  className,
  style,
}: YouTubeFilmProps) {
  const [started, setStarted] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // One tracker per film view: PLAY, then 25/50/75% and COMPLETE (docs/04).
  const [video] = useState(() => createVideoTracker((m) => track(m.type, "value" in m ? { v: m.value } : {})));

  useEffect(() => {
    if (!started) return;
    const state = { duration: duration ?? 0 };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      applyYouTubeMessage(e, video, state);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [started, duration, video]);

  function onLoad() {
    const win = frame.current?.contentWindow;
    if (!win) return;
    // Ask the player to stream its state to us (no iframe_api script needed).
    win.postMessage(listeningMessage(), "*");
    win.postMessage(addListenerMessage(), "*");
    frame.current?.focus();
  }

  const label = `Play film${duration ? ` · ${clockDuration(duration)}` : ""}`;

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-ink", className)}
      style={{ aspectRatio: aspect, ...style }}
      data-orientation={orientation}
    >
      {started ? (
        <iframe
          ref={frame}
          src={embedUrl(youtubeId, { autoplay: true, origin: window.location.origin, start })}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
          onLoad={onLoad}
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          onPointerEnter={warm}
          onFocus={warm}
          data-cursor="play"
          aria-label={`${label}: ${title}`}
          className="group absolute inset-0 block size-full text-ivory"
        >
          <Image
            src={poster.src}
            alt={poster.alt}
            fill
            sizes={sizes}
            quality={90}
            preload={priority}
            fetchPriority={priority ? "high" : undefined}
            placeholder={poster.blurDataUrl ? "blur" : "empty"}
            blurDataURL={poster.blurDataUrl}
            className="object-cover transition-transform duration-[1.4s] ease-out-expo group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/10 to-ink/20" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="flex flex-col items-center gap-4">
              <span className="relative grid size-20 place-items-center rounded-full border border-ivory/40 bg-ink/30 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:border-red group-hover:bg-red md:size-24">
                <svg viewBox="0 0 24 24" aria-hidden className="ml-1 size-7 fill-current">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.02-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
                </svg>
              </span>
              <span className="label text-ivory/80">{label}</span>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
