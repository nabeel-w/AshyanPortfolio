"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { GOOGLE_FEATURE_LOGO, GoogleLogo } from "@/components/icons/google-icons";
import { Button } from "@/components/ui/button";
import {
  disconnectGoogleAction,
  googleStatusAction,
  sendTestEmailAction,
} from "@/features/google/actions";
import { connectGoogle } from "@/features/google/client";
import type { GoogleFeature, GoogleStatus } from "@/features/google/scopes";
import { ConfirmButton } from "./confirm-button";

const FEATURES: { feature: GoogleFeature; title: string; body: string }[] = [
  {
    feature: "gmail",
    title: "Enquiry emails (Gmail)",
    body: "Each contact-form enquiry is emailed to the connected mailbox, with Reply-To set to the sender. Send-only: the site can't read your mail.",
  },
  {
    feature: "drive",
    title: "Google Drive imports",
    body: "Import masters from Drive in Media → Upload. The site only sees the files you pick.",
  },
];

/** Settings → Connected services: link Google per feature (incremental consent), test, disconnect. */
export function GoogleConnections({ initial }: { initial: GoogleStatus }) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = useCallback(async () => setStatus(await googleStatusAction()), []);

  if (!status.configured) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Google isn&apos;t configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (docs/03,
        &ldquo;Import sources&rdquo;) to enable Gmail notifications and Drive imports.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {FEATURES.map(({ feature, title, body }) => {
        const account = status.accounts.find((a) => a[feature]);
        const Logo = GOOGLE_FEATURE_LOGO[feature];
        const unavailable = feature === "drive" && !status.pickerConfigured;
        return (
          <li
            key={feature}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex min-w-0 gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-ink">
                <Logo className="h-5 w-auto" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ivory">{title}</p>
                <p className="mt-1 max-w-xl text-xs text-muted-foreground">{body}</p>
                <p className="mt-2 text-xs">
                  {account ? (
                    <span className="inline-flex items-center gap-1.5 text-ivory">
                      <GoogleLogo className="size-3.5" />
                      Connected as {account.email ?? "your Google account"}
                    </span>
                  ) : unavailable ? (
                    <span className="text-muted-foreground">
                      Needs the Picker API key and project number.
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not connected</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {!account ? (
                <Button
                  size="sm"
                  disabled={busy !== null || unavailable}
                  onClick={async () => {
                    setBusy(feature);
                    try {
                      if (await connectGoogle(feature))
                        toast.success(
                          `${feature === "gmail" ? "Gmail" : "Google Drive"} connected`,
                        );
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Couldn't connect");
                    } finally {
                      setBusy(null);
                      await refresh();
                    }
                  }}
                >
                  {busy === feature ? (
                    "Waiting for Google…"
                  ) : (
                    <>
                      <Logo className="h-3.5 w-auto" />
                      Connect {feature === "gmail" ? "Gmail" : "Drive"}
                    </>
                  )}
                </Button>
              ) : (
                <>
                  {feature === "gmail" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy("test");
                        try {
                          const { to } = await sendTestEmailAction();
                          toast.success(`Test email sent to ${to}`);
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Couldn't send the test email",
                          );
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === "test" ? "Sending…" : "Send test email"}
                    </Button>
                  ) : null}
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    confirmLabel={
                      account.drive && account.gmail
                        ? "Disconnects Drive and Gmail. Sure?"
                        : "Disconnect?"
                    }
                    onConfirm={async () => {
                      await disconnectGoogleAction(account.id);
                      toast.success("Google disconnected");
                      await refresh();
                    }}
                  >
                    Disconnect
                  </ConfirmButton>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
