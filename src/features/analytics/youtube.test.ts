import { describe, expect, it } from "vitest";
import { createVideoTracker, type VideoMilestone } from "./video";
import { applyYouTubeMessage, listeningMessage } from "./youtube";

const origin = "https://www.youtube-nocookie.com";

function setup() {
  const out: VideoMilestone[] = [];
  const tracker = createVideoTracker((m) => out.push(m));
  const state = { duration: 0 };
  const send = (data: unknown, from = origin) => applyYouTubeMessage({ origin: from, data }, tracker, state);
  return { out, send, state };
}

describe("applyYouTubeMessage", () => {
  it("maps a full watch to PLAY, 25, 50, 75 and COMPLETE", () => {
    const { out, send } = setup();
    send(JSON.stringify({ event: "initialDelivery", info: { duration: 100, currentTime: 0 } }));
    send(JSON.stringify({ event: "onStateChange", info: 1 }));
    for (const t of [10, 26, 51, 80, 96]) send(JSON.stringify({ event: "infoDelivery", info: { currentTime: t } }));
    expect(out.map((m) => ("value" in m ? `${m.type}:${m.value}` : m.type))).toEqual([
      "VIDEO_PLAY",
      "VIDEO_PROGRESS:25",
      "VIDEO_PROGRESS:50",
      "VIDEO_PROGRESS:75",
      "VIDEO_COMPLETE:100",
    ]);
  });

  it("counts PLAY from infoDelivery's playerState and an end-of-film state as complete", () => {
    const { out, send } = setup();
    send({ event: "infoDelivery", info: { playerState: 1, duration: 60, currentTime: 1 } });
    send({ event: "onStateChange", info: 0 });
    expect(out.map((m) => m.type)).toEqual([
      "VIDEO_PLAY",
      "VIDEO_PROGRESS",
      "VIDEO_PROGRESS",
      "VIDEO_PROGRESS",
      "VIDEO_COMPLETE",
    ]);
  });

  it("ignores progress before the film has played (autoplay blocked, scrubbing the poster)", () => {
    const { out, send } = setup();
    send({ event: "infoDelivery", info: { duration: 60, currentTime: 59 } });
    expect(out).toEqual([]);
  });

  it("only trusts YouTube's origins and well-formed messages", () => {
    const { out, send } = setup();
    expect(send(JSON.stringify({ event: "onStateChange", info: 1 }), "https://evil.example")).toBe(false);
    expect(send("{not json")).toBe(false);
    expect(send(42)).toBe(false);
    expect(send({ event: "somethingElse" })).toBe(false);
    expect(out).toEqual([]);
  });

  it("builds the listening handshake", () => {
    expect(JSON.parse(listeningMessage())).toEqual({ event: "listening", id: "film", channel: "widget" });
  });
});
