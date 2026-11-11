import { describe, expect, it } from "vitest";
import { buildMime } from "@/features/google/gmail";
import { defang, enquiryConfirmation, enquiryNotification, esc } from "./emails";

const site = {
  name: "Ashyan Zafar",
  role: "Film Editor",
  location: "Mumbai",
  email: "hello@ashyanzafar.com",
  socials: [{ label: "Instagram", href: "https://instagram.com/ashyan" }],
  url: "https://ashyanzafar.com/",
};
const enquiry = {
  name: "Priya Shah",
  email: "priya@brand.co",
  company: "Brand Co",
  projectType: "Commercial",
  message: "We need a 30s cut.\nShoot wraps Friday.",
  source: "/contact",
};

describe("enquiry notification (to us)", () => {
  const mail = enquiryNotification(enquiry, site, new Date("2026-11-11T10:00:00Z"));

  it("has every detail, and replies go to the visitor", () => {
    expect(mail.subject).toBe("New enquiry · Priya Shah (Brand Co)");
    expect(mail.replyTo).toBe("priya@brand.co");
    for (const s of [
      "Priya Shah",
      "priya@brand.co",
      "Brand Co",
      "Commercial",
      "/contact",
      "We need a 30s cut.",
    ]) {
      expect(mail.text).toContain(s);
      expect(mail.html).toContain(s);
    }
    expect(mail.text).toContain("Wed, 11 Nov 2026 10:00:00 UTC");
  });

  it("is branded: monogram, wordmark, site palette, reply + inbox buttons", () => {
    expect(mail.html).toContain('src="https://ashyanzafar.com/apple-icon.png"');
    expect(mail.html).toMatch(/ASHYAN<span[^>]*>&nbsp;·&nbsp;<\/span>ZAFAR/);
    expect(mail.html).toContain("#0A0A0A");
    expect(mail.html).toContain("#C1121F");
    expect(mail.html).toContain(
      'href="mailto:priya@brand.co?subject=Re%3A%20your%20enquiry%20(Commercial)"',
    );
    expect(mail.html).toContain(">Reply to Priya</a>");
    expect(mail.html).toContain('href="https://ashyanzafar.com/admin/inbox"');
  });

  it("escapes whatever the visitor typed", () => {
    const evil = enquiryNotification(
      { ...enquiry, name: "<img src=x onerror=alert(1)>", message: "<script>x</script>" },
      site,
    );
    expect(evil.html).not.toContain("<img src=x");
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).toContain("&lt;script&gt;");
  });
});

describe("enquiry confirmation (to the visitor)", () => {
  const mail = enquiryConfirmation(enquiry, site);

  it("thanks them, echoes what they sent and says we'll reply soon", () => {
    expect(mail.subject).toBe("Thanks for your enquiry · Ashyan Zafar");
    expect(mail.replyTo).toBe("hello@ashyanzafar.com");
    expect(mail.html).toContain("Thank you, <em");
    expect(mail.html).toContain(">Priya</em>");
    expect(mail.html).toMatch(/get back to you soon/);
    expect(mail.html).toContain("We need a 30s cut.");
    expect(mail.html).toContain("Brand Co");
    expect(mail.html).toContain('href="https://ashyanzafar.com/work"');
    expect(mail.text).toContain("Thank you, Priya.");
    expect(mail.text).toContain("Shoot wraps Friday.");
  });

  it("never turns echoed text into links (the form can be filled with anyone's address)", () => {
    const spam = enquiryConfirmation(
      {
        ...enquiry,
        message:
          "Win big at https://spam.example/x or www.spam.example or spam.biz, mail me@spam.biz",
      },
      site,
    );
    const visible = spam.html + spam.text;
    expect(visible).not.toContain("https://spam");
    expect(visible).not.toContain("www.spam");
    expect(visible).not.toContain("spam.biz");
    expect(visible).not.toContain("me@spam");
    // Same words, just unlinkable
    expect(spam.text.replace(/​/g, "")).toContain("https://spam.example/x");
  });

  it("clips very long messages", () => {
    const long = enquiryConfirmation({ ...enquiry, message: "x".repeat(5000) }, site);
    expect(long.text).toContain(`${"x".repeat(2000)}…`);
    expect(long.text).not.toContain("x".repeat(2001));
  });

  it("travels as multipart/alternative with text and HTML", () => {
    const mime = buildMime(
      { ...mail, to: "priya@brand.co", fromName: "Ashyan Zafar" },
      "studio@gmail.com",
    );
    expect(mime).toContain("From: Ashyan Zafar <studio@gmail.com>");
    expect(mime).toMatch(/Content-Type: multipart\/alternative; boundary="az-[0-9a-f]+"/);
    expect(mime).toContain("Content-Type: text/plain");
    expect(mime).toContain("Content-Type: text/html");
  });
});

describe("helpers", () => {
  it("esc escapes HTML specials", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
  it("defang only inserts zero-width spaces", () => {
    const s = "see https://a.io and www.b.com";
    expect(defang(s).replace(/​/g, "")).toBe(s);
  });
});
