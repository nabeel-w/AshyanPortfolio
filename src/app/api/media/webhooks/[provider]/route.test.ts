import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";

const applyWebhook = vi.hoisted(() => vi.fn());
vi.mock("@/features/media/service", () => ({ applyWebhook }));

const { POST } = await import("./route");

const call = (provider: string) =>
  POST(
    new Request(`https://site.test/api/media/webhooks/${provider}`, { method: "POST", body: "{}" }),
    {
      params: Promise.resolve({ provider }),
    },
  );

describe("POST /api/media/webhooks/[provider]", () => {
  it("applies the update and refreshes asset + project caches", async () => {
    applyWebhook.mockResolvedValue({ id: "asset_1" });
    const res = await call("mux");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, updated: "asset_1" });
    expect(revalidateTag).toHaveBeenCalledWith("assets", "max");
    expect(revalidateTag).toHaveBeenCalledWith("projects", "max");
  });

  it("acknowledges ignored events without touching caches", async () => {
    applyWebhook.mockResolvedValue(null);
    const res = await call("mux");
    expect(await res.json()).toEqual({ ok: true, updated: null });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("401s on bad signatures", async () => {
    applyWebhook.mockRejectedValue(new Error("Invalid Mux webhook signature"));
    expect((await call("mux")).status).toBe(401);
  });

  it("404s for unknown providers", async () => {
    applyWebhook.mockRejectedValue(new Error('Unknown media provider "nope"'));
    expect((await call("nope")).status).toBe(404);
  });

  it("500s on unexpected errors without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    applyWebhook.mockRejectedValue(new Error("db password=hunter2 timeout"));
    const res = await call("mux");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "Internal error" });
  });
});
