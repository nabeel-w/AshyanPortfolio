"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GOOGLE_FEATURE_LOGO } from "@/components/icons/google-icons";
import { CONNECT_CHANNEL, type ConnectMessage } from "@/features/google/client";
import type { GoogleFeature } from "@/features/google/scopes";

const LABEL: Record<GoogleFeature, string> = { drive: "Google Drive", gmail: "Gmail" };

/** Tell the admin tab how it went (BroadcastChannel: Google's pages cut window.opener), then close the popup. */
export function ConnectedNotice() {
  const params = useSearchParams();
  const feature: GoogleFeature = params.get("feature") === "gmail" ? "gmail" : "drive";
  const error = params.get("error");
  const ok = !params.get("failed") && !error;

  useEffect(() => {
    const message: ConnectMessage = {
      type: "google-connect",
      feature,
      ok,
      error: error ?? undefined,
    };
    const channel = new BroadcastChannel(CONNECT_CHANNEL);
    channel.postMessage(message);
    channel.close();
    if (ok) {
      const t = window.setTimeout(() => window.close(), 600);
      return () => window.clearTimeout(t);
    }
  }, [feature, ok, error]);

  const Logo = GOOGLE_FEATURE_LOGO[feature];
  return (
    <>
      <Logo className="mb-6 h-10 w-auto" />
      <h1 className="mb-4 font-serif text-4xl text-ivory">
        {ok ? `${LABEL[feature]} connected` : "Not connected"}
      </h1>
      <p className="text-sm text-smoke">
        {ok
          ? "You can close this window."
          : `Google didn't complete the connection${error ? ` (${error.replace(/_/g, " ")})` : ""}. Close this window and try again.`}
      </p>
      <Link
        href={feature === "gmail" ? "/admin/settings" : "/admin/media"}
        className="link-cut mt-6 inline-block text-sm text-ivory"
      >
        Back to the admin
      </Link>
    </>
  );
}
