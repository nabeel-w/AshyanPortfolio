import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectedNotice } from "./connected-notice";

export const metadata: Metadata = { title: "Google", robots: { index: false, follow: false } };

/** Where Google sends the admin back after linking (in the connect popup, or this tab if popups are blocked). */
export default function ConnectedPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <p className="label mb-3 text-red">Google</p>
        <Suspense fallback={<p className="text-smoke">One moment…</p>}>
          <ConnectedNotice />
        </Suspense>
      </div>
    </main>
  );
}
