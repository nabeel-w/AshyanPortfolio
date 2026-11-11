/**
 * Branded enquiry emails, in the site's look: ink background, ivory serif headline with a red italic
 * accent word, mono labels, hairlines, the AZ monogram. Email clients ignore <style> blocks and web
 * fonts unevenly, so everything is inline and table-based, with Georgia / Helvetica / Courier
 * standing in for Instrument Serif / Geist / JetBrains Mono.
 *
 *  - enquiryNotification → us: every detail, Reply-To = the visitor, "Reply" + "Open inbox" buttons
 *  - enquiryConfirmation → the visitor: thank you, a copy of what they sent, what happens next
 *
 * Pure functions (no I/O) so they're unit-tested and previewable.
 */

export type Enquiry = {
  name: string;
  email: string;
  company?: string;
  projectType?: string;
  message: string;
  /** Page path the form was sent from */
  source?: string | null;
};

export type EmailSite = {
  name: string;
  role: string;
  location?: string;
  /** Public contact address (shown on the site) */
  email?: string;
  socials?: { label: string; href: string }[];
  /** Absolute site URL, no trailing slash needed */
  url: string;
};

export type RenderedEmail = { subject: string; text: string; html: string; replyTo?: string };

const C = {
  ink: "#0A0A0A",
  onyx: "#111111",
  hairline: "#262626",
  ivory: "#F4F1EC",
  body: "#C9C6C1",
  smoke: "#8C8984",
  red: "#C1121F",
  signal: "#F23A45",
} as const;
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

/** Escape user input for HTML. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ZWSP = "​";

/**
 * Text we echo back to a visitor must not become clickable links: anyone can type someone else's
 * address into the form, so a spammer could otherwise make our mailbox deliver their links.
 * A zero-width space breaks "https://", "www." and "domain.tld" auto-linking without changing what it reads as.
 */
export function defang(s: string): string {
  return s
    .replace(/(https?):\/\//gi, `$1:/${ZWSP}/`)
    .replace(/\bwww\./gi, `www${ZWSP}.`)
    .replace(/([a-z0-9-])\.([a-z]{2,})\b/gi, `$1${ZWSP}.$2`)
    .replace(/@/g, `@${ZWSP}`);
}

const MAX_ECHO = 2000;
function clip(s: string): string {
  return s.length > MAX_ECHO ? `${s.slice(0, MAX_ECHO).trimEnd()}…` : s;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const base = (url: string) => url.replace(/\/$/, "");

// ─── Building blocks ─────────────────────────────────────────────────────────

function label(text: string, color: string = C.smoke) {
  return `<span style="font-family:${MONO};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${color};">${text}</span>`;
}

function button(href: string, text: string, primary = false) {
  const style = primary
    ? `background:${C.ivory};color:${C.ink};border:1px solid ${C.ivory};`
    : `background:transparent;color:${C.ivory};border:1px solid #3a3a3a;`;
  return `<a href="${esc(href)}" style="${style}display:inline-block;padding:13px 22px;font-family:${MONO};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;">${text}</a>`;
}

/** Label/value rows separated by hairlines. Values are already escaped/defanged by the caller. */
function details(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid ${C.hairline};">
${rows
  .map(
    ([k, v]) => `<tr>
  <td valign="top" style="padding:14px 0;border-bottom:1px solid ${C.hairline};width:132px;">${label(k)}</td>
  <td valign="top" style="padding:12px 0;border-bottom:1px solid ${C.hairline};font-family:${SANS};font-size:15px;line-height:1.5;color:${C.ivory};">${v}</td>
</tr>`,
  )
  .join("\n")}
</table>`;
}

function quote(html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="border-left:2px solid ${C.red};padding:4px 0 4px 18px;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.body};white-space:pre-wrap;">${html}</td>
</tr></table>`;
}

/** The shared frame: preheader, AZ header, playhead accent, content, footer. */
function layout({
  site,
  preheader,
  eyebrow,
  title,
  content,
  footnote,
}: {
  site: EmailSite;
  preheader: string;
  eyebrow: string;
  /** Escaped HTML; may contain one <em> accent */
  title: string;
  content: string;
  footnote: string;
}) {
  const url = base(site.url);
  const socials = (site.socials ?? [])
    .map(
      (s) =>
        `<a href="${esc(s.href)}" style="color:${C.smoke};text-decoration:none;">${esc(s.label)}</a>`,
    )
    .join(`<span style="color:${C.red};">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`);
  const wordmark = esc(site.name.toUpperCase()).replace(
    " ",
    `<span style="color:${C.red};">&nbsp;·&nbsp;</span>`,
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(eyebrow)}</title>
</head>
<body style="margin:0;padding:0;background:${C.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.ink};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ink};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td style="padding:0 0 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" width="56"><a href="${url}"><img src="${url}/apple-icon.png" width="44" height="44" alt="AZ" style="display:block;border:0;"></a></td>
        <td valign="middle" style="font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.42em;color:${C.ivory};">${wordmark}</td>
        <td valign="middle" align="right">${label(`<span style="color:${C.red};">●</span>&nbsp;${esc(eyebrow)}`)}</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:${C.onyx};border:1px solid ${C.hairline};padding:40px 32px 36px;">
      <div style="width:48px;height:2px;background:${C.red};margin:0 0 28px;"></div>
      <h1 style="margin:0 0 24px;font-family:${SERIF};font-weight:400;font-size:34px;line-height:1.15;color:${C.ivory};">${title}</h1>
      ${content}
    </td></tr>
    <tr><td style="padding:24px 4px 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.smoke};">
      <p style="margin:0 0 8px;">${label(`${esc(site.name)}&nbsp;&nbsp;·&nbsp;&nbsp;${esc(site.role)}${site.location ? `&nbsp;&nbsp;·&nbsp;&nbsp;${esc(site.location)}` : ""}`)}</p>
      ${socials ? `<p style="margin:0 0 8px;">${socials}</p>` : ""}
      <p style="margin:0;">${footnote}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

const p = (html: string, mb = 20) =>
  `<p style="margin:0 0 ${mb}px;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.body};">${html}</p>`;

// ─── Templates ───────────────────────────────────────────────────────────────

/** To us: everything the visitor sent, one tap to reply. */
export function enquiryNotification(
  e: Enquiry,
  site: EmailSite,
  receivedAt = new Date(),
): RenderedEmail {
  const url = base(site.url);
  const first = firstName(e.name);
  const when = receivedAt.toUTCString().replace(" GMT", " UTC");
  const rows: [string, string][] = [
    ["Name", esc(e.name)],
    ["Email", `<a href="mailto:${esc(e.email)}" style="color:${C.ivory};">${esc(e.email)}</a>`],
    ...(e.company ? ([["Company", esc(e.company)]] as [string, string][]) : []),
    ...(e.projectType ? ([["Project", esc(e.projectType)]] as [string, string][]) : []),
    ...(e.source ? ([["Sent from", esc(e.source)]] as [string, string][]) : []),
    ["Received", esc(when)],
  ];
  const replyHref = `mailto:${e.email}?subject=${encodeURIComponent(`Re: your enquiry${e.projectType ? ` (${e.projectType})` : ""}`)}`;
  const html = layout({
    site,
    preheader: `${e.name}${e.company ? ` (${e.company})` : ""}: ${e.message.slice(0, 120)}`,
    eyebrow: "New enquiry",
    title: `New enquiry from <em style="font-style:italic;color:${C.signal};">${esc(e.name)}</em>`,
    content: [
      details(rows),
      `<div style="height:28px;"></div>`,
      `<p style="margin:0 0 12px;">${label("Message")}</p>`,
      quote(esc(e.message)),
      `<div style="height:32px;"></div>`,
      `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:0 10px 10px 0;">${button(replyHref, `Reply to ${esc(first)}`, true)}</td>
        <td style="padding:0 0 10px;">${button(`${url}/admin/inbox`, "Open inbox")}</td>
      </tr></table>`,
    ].join("\n"),
    footnote: `Sent by your site's contact form. Replying to this email answers ${esc(first)} directly.`,
  });
  const text = [
    `New enquiry from ${e.name}`,
    "",
    `Name: ${e.name}`,
    `Email: ${e.email}`,
    e.company ? `Company: ${e.company}` : null,
    e.projectType ? `Project: ${e.projectType}` : null,
    e.source ? `Sent from: ${e.source}` : null,
    `Received: ${when}`,
    "",
    e.message,
    "",
    "—",
    `Reply to this email to answer ${first}, or open the inbox: ${url}/admin/inbox`,
  ]
    .filter((l) => l !== null)
    .join("\n");
  return {
    subject: `New enquiry · ${e.name}${e.company ? ` (${e.company})` : ""}`,
    text,
    html,
    replyTo: e.email,
  };
}

/** To the visitor: thank you, a copy of what they sent (links defanged), what happens next. */
export function enquiryConfirmation(e: Enquiry, site: EmailSite): RenderedEmail {
  const url = base(site.url);
  const first = firstName(e.name);
  const safe = (s: string) => esc(defang(clip(s)));
  const rows: [string, string][] = [
    ["Name", safe(e.name)],
    ...(e.company ? ([["Company", safe(e.company)]] as [string, string][]) : []),
    ...(e.projectType ? ([["Project", safe(e.projectType)]] as [string, string][]) : []),
  ];
  const html = layout({
    site,
    preheader: `Thanks for getting in touch. I'll reply personally, usually within two working days.`,
    eyebrow: "Enquiry received",
    title: `Thank you, <em style="font-style:italic;color:${C.signal};">${safe(first)}</em>.`,
    content: [
      p(
        `Your message has reached me. I read every enquiry myself and will get back to you soon, usually within two working days.`,
      ),
      p(`Here's a copy of what you sent, for your records:`, 16),
      details(rows),
      `<div style="height:24px;"></div>`,
      quote(safe(e.message)),
      `<div style="height:32px;"></div>`,
      p(`Anything to add, like a brief, a deck or a reference cut? Just reply to this email.`, 28),
      `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:0 0 4px;">${button(`${url}/work`, "Watch the work", true)}</td>
      </tr></table>`,
      `<div style="height:32px;"></div>`,
      `<p style="margin:0;font-family:${SERIF};font-style:italic;font-size:22px;color:${C.ivory};">${esc(site.name)}</p>`,
      `<p style="margin:4px 0 0;">${label(esc(site.role))}</p>`,
    ].join("\n"),
    footnote: `You're receiving this because this address was used on the contact form at ${esc(url.replace(/^https?:\/\//, ""))}. If that wasn't you, you can ignore this email.`,
  });
  const text = [
    `Thank you, ${defang(clip(first))}.`,
    "",
    "Your message has reached me. I read every enquiry myself and will get back to you soon, usually within two working days.",
    "",
    "Here's a copy of what you sent:",
    "",
    `Name: ${defang(clip(e.name))}`,
    e.company ? `Company: ${defang(clip(e.company))}` : null,
    e.projectType ? `Project: ${defang(clip(e.projectType))}` : null,
    "",
    defang(clip(e.message)),
    "",
    "Anything to add? Just reply to this email.",
    `Watch the work: ${url}/work`,
    "",
    `${site.name}`,
    `${site.role}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
  return {
    subject: `Thanks for your enquiry · ${site.name}`,
    text,
    html,
    replyTo: site.email,
  };
}
