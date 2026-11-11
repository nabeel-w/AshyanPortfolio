"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteSubmission, setSubmissionRead } from "@/features/settings/actions";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "./confirm-button";

type Item = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  projectType: string | null;
  message: string;
  source: string | null;
  read: boolean;
  createdAt: string;
};

export function InboxList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  if (!items.length) {
    return <p className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">No messages yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((m) => (
        <li key={m.id} className={cn("rounded-md border bg-onyx p-5", m.read ? "border-border" : "border-red/60")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-ivory">
                {!m.read ? <span className="mr-2 inline-block size-1.5 rounded-full bg-red align-middle" aria-label="Unread" /> : null}
                {m.name}
                {m.company ? <span className="text-muted-foreground"> · {m.company}</span> : null}
              </p>
              <a
                href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your project")}`}
                className="text-sm text-muted-foreground underline hover:text-ivory"
              >
                {m.email}
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {m.projectType ? <Badge variant="outline">{m.projectType}</Badge> : null}
              <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-ivory/80">{m.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => setSubmissionRead(m.id, !m.read))}>
              Mark as {m.read ? "unread" : "read"}
            </Button>
            <ConfirmButton size="sm" variant="ghost" disabled={pending} confirmLabel="Delete message?" onConfirm={() => act(() => deleteSubmission(m.id))}>
              Delete
            </ConfirmButton>
            {m.source ? <span className="self-center text-xs text-muted-foreground">from {m.source}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
