/**
 * Turns a player's time updates into analytics milestones: one PLAY, PROGRESS at 25/50/75,
 * and COMPLETE once 95% is reached. Each fires at most once per tracker (one per film view).
 */

export type VideoMilestone = { type: "VIDEO_PLAY" } | { type: "VIDEO_PROGRESS"; value: 25 | 50 | 75 } | { type: "VIDEO_COMPLETE"; value: 100 };

const STEPS = [25, 50, 75] as const;

export function createVideoTracker(emit: (m: VideoMilestone) => void) {
  let played = false;
  let completed = false;
  const reached = new Set<number>();

  return {
    play() {
      if (played) return;
      played = true;
      emit({ type: "VIDEO_PLAY" });
    },
    time(currentTime: number, duration: number) {
      if (!played || !Number.isFinite(duration) || duration <= 0) return;
      const pct = (currentTime / duration) * 100;
      for (const step of STEPS) {
        if (pct >= step && !reached.has(step)) {
          reached.add(step);
          emit({ type: "VIDEO_PROGRESS", value: step });
        }
      }
      if (pct >= 95 && !completed) {
        completed = true;
        emit({ type: "VIDEO_COMPLETE", value: 100 });
      }
    },
  };
}
