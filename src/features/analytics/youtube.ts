/**
 * Play analytics for the YouTube embed without loading YouTube's iframe_api script (~100 KB).
 * After the iframe loads we post {event:"listening"}; the player then streams JSON messages:
 *   { event: "onStateChange", info: 1 }                       (1 = playing, 0 = ended, 2 = paused…)
 *   { event: "infoDelivery", info: { currentTime, duration, playerState } }
 *   { event: "initialDelivery", info: { duration, … } }
 * We feed those into the same tracker the old player used, so PLAY / 25 / 50 / 75 / COMPLETE and the
 * admin "Film retention" panel are unchanged (docs/04).
 */

export const YOUTUBE_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com"] as const;

export const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;

type Tracker = { play(): void; time(currentTime: number, duration: number): void };

/** The message to post to the iframe so it starts sending events. */
export const listeningMessage = (id = "film") => JSON.stringify({ event: "listening", id, channel: "widget" });

/** Subscribe to state changes as well (some player versions only stream infoDelivery after this). */
export const addListenerMessage = (id = "film") =>
  JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"], id, channel: "widget" });

/**
 * Apply one postMessage from the player. Returns false for anything that isn't a trusted YouTube
 * player message (wrong origin, not JSON, unknown shape), so callers can ignore it.
 * `state` keeps the last known duration between messages (infoDelivery often omits it).
 */
export function applyYouTubeMessage(
  event: { origin: string; data: unknown },
  tracker: Tracker,
  state: { duration: number },
): boolean {
  if (!(YOUTUBE_ORIGINS as readonly string[]).includes(event.origin)) return false;
  let msg: unknown = event.data;
  if (typeof msg === "string") {
    try {
      msg = JSON.parse(msg);
    } catch {
      return false;
    }
  }
  if (!msg || typeof msg !== "object") return false;
  const { event: name, info } = msg as { event?: unknown; info?: unknown };

  if (name === "onStateChange") {
    if (info === PLAYER_STATE.PLAYING) tracker.play();
    if (info === PLAYER_STATE.ENDED && state.duration > 0) tracker.time(state.duration, state.duration);
    return true;
  }
  if ((name === "infoDelivery" || name === "initialDelivery") && info && typeof info === "object") {
    const i = info as { currentTime?: unknown; duration?: unknown; playerState?: unknown };
    if (typeof i.duration === "number" && i.duration > 0) state.duration = i.duration;
    if (i.playerState === PLAYER_STATE.PLAYING) tracker.play();
    if (typeof i.currentTime === "number") tracker.time(i.currentTime, state.duration);
    if (i.playerState === PLAYER_STATE.ENDED && state.duration > 0) tracker.time(state.duration, state.duration);
    return true;
  }
  return false;
}
