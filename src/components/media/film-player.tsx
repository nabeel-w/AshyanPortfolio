"use client";

import Image from "next/image";
import { lazy, Suspense, useState } from "react";
import { track } from "@/features/analytics/track";
import { createVideoTracker } from "@/features/analytics/video";
import { clockDuration } from "@/features/media/delivery";
import { cn } from "@/lib/utils";

// The player (~250 KB) is only fetched after the visitor presses play.
const MuxPlayer = lazy(() => import("@mux/mux-player-react"));

export type FilmPlayerProps = {
  playbackId: string;
  title: string;
  poster: { src: string; alt: string; blurDataUrl?: string };
  duration?: number;
  aspectRatio?: number;
  /** LCP image on project pages. */
  priority?: boolean;
  className?: string;
};

/**
 * Poster first, player on demand. The poster is a normal optimised image (fast LCP);
 * clicking swaps in Mux Player (adaptive HLS) styled in the brand colours and starts playback.
 */
export function FilmPlayer({ playbackId, title, poster, duration, aspectRatio = 16 / 9, priority, className }: FilmPlayerProps) {
  const [started, setStarted] = useState(false);
  // One tracker per film view: PLAY, then 25/50/75% and COMPLETE (docs/04).
  const [video] = useState(() => createVideoTracker((m) => track(m.type, "value" in m ? { v: m.value } : {})));

  return (
    <div className={cn("relative w-full overflow-hidden bg-ink", className)} style={{ aspectRatio }}>
      {started ? (
        <Suspense fallback={<Loading />}>
          <MuxPlayer
            playbackId={playbackId}
            streamType="on-demand"
            autoPlay
            title={title}
            metadata={{ video_title: title }}
            accentColor="#c1121f"
            primaryColor="#f4f1ec"
            secondaryColor="#0a0a0a"
            style={{ width: "100%", height: "100%", aspectRatio: String(aspectRatio) }}
            onPlay={() => video.play()}
            onTimeUpdate={(e) => {
              const el = e.target as unknown as { currentTime: number; duration: number };
              video.time(el.currentTime, el.duration);
            }}
          />
        </Suspense>
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          data-cursor="play"
          aria-label={`Play film${duration ? ` · ${clockDuration(duration)}` : ""}: ${title}`}
          className="group absolute inset-0 block size-full text-ivory"
        >
          <Image
            src={poster.src}
            alt={poster.alt}
            fill
            sizes="100vw"
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
              <span className="label text-ivory/80">
                Play film{duration ? ` · ${clockDuration(duration)}` : ""}
              </span>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

function Loading() {
  return (
    <span className="absolute inset-0 grid place-items-center">
      <span className="label animate-pulse text-ivory/60">Loading film…</span>
    </span>
  );
}
