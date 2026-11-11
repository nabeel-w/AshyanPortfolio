import { beforeEach, describe, expect, it, vi } from "vitest";

/** notifyEnquiry: both branded emails from the linked mailbox, best effort, capped confirmations. */

const gmail = vi.hoisted(() => ({ gmailSender: vi.fn(), sendGmail: vi.fn() }));
vi.mock("@/features/google/gmail", () => gmail);

const db = vi.hoisted(() => ({ contactSubmission: { count: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));

vi.mock("@/features/content/queries", () => ({
  getSite: async () => ({
    name: "Ashyan Zafar",
    role: "Film Editor",
    location: "Mumbai",
    email: "hello@ashyanzafar.com",
    socials: [{ label: "Instagram", href: "https://instagram.com/x" }],
  }),
}));

const { notifyEnquiry, CONFIRMATION_DAILY_CAP } = await import("./notify");

const enquiry = { name: "Priya Shah", email: "priya@brand.co", message: "We need a 30s cut." };

beforeEach(() => {
  gmail.gmailSender.mockResolvedValue({ id: "acc1", email: "studio@gmail.com" });
  gmail.sendGmail.mockResolvedValue({ id: "m" });
  db.contactSubmission.count.mockResolvedValue(3);
});

describe("notifyEnquiry", () => {
  it("emails us (Reply-To visitor) and thanks the visitor (Reply-To our public address)", async () => {
    await notifyEnquiry(enquiry);
    expect(gmail.sendGmail).toHaveBeenCalledTimes(2);
    const [[, toUs, fromA], [, toThem, fromB]] = gmail.sendGmail.mock.calls;
    expect(toUs).toMatchObject({
      to: "studio@gmail.com",
      replyTo: "priya@brand.co",
      fromName: "Priya Shah via Ashyan Zafar",
    });
    expect(toUs.html).toContain("New enquiry from");
    expect(toThem).toMatchObject({
      to: "priya@brand.co",
      replyTo: "hello@ashyanzafar.com",
      fromName: "Ashyan Zafar",
    });
    expect(toThem.html).toContain("Thank you");
    expect(fromA).toBe("studio@gmail.com");
    expect(fromB).toBe("studio@gmail.com");
  });

  it("does nothing when Gmail isn't connected", async () => {
    gmail.gmailSender.mockResolvedValue(null);
    vi.spyOn(console, "info").mockImplementation(() => {});
    await notifyEnquiry(enquiry);
    expect(gmail.sendGmail).not.toHaveBeenCalled();
  });

  it("stops confirmations past the daily cap but still notifies us", async () => {
    db.contactSubmission.count.mockResolvedValue(CONFIRMATION_DAILY_CAP + 1);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await notifyEnquiry(enquiry);
    expect(gmail.sendGmail).toHaveBeenCalledTimes(1);
    expect(gmail.sendGmail.mock.calls[0]![1].to).toBe("studio@gmail.com");
  });

  it("one failed send doesn't stop the other, and nothing throws", async () => {
    gmail.sendGmail.mockRejectedValueOnce(new Error("Gmail send failed: 500"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyEnquiry(enquiry)).resolves.toBeUndefined();
    expect(gmail.sendGmail).toHaveBeenCalledTimes(2);
    expect(err).toHaveBeenCalled();
  });
});
