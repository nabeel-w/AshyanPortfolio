"use client";

import { LaptopIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GoogleDriveLogo, GoogleLogo } from "@/components/icons/google-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  disconnectGoogleAction,
  drivePickerAction,
  googleStatusAction,
} from "@/features/google/actions";
import { connectGoogle, pickDriveFiles } from "@/features/google/client";
import type { GoogleStatus } from "@/features/google/scopes";
import { mimeTypesForAccept } from "@/features/media/mime";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "../confirm-button";
import type { QueueItem, UploadQueue } from "./use-upload-queue";

export const DEFAULT_ACCEPT = "image/*,video/*,application/pdf";

type Tab = "device" | "drive";

/**
 * "Add media": one dialog for every source (This device · Google Drive) over a shared queue.
 * The queue (useUploadQueue) belongs to the caller, so transfers continue after the dialog closes.
 * Full-screen sheet on phones.
 */
export function UploadDialog({
  open,
  onOpenChange,
  queue,
  accept = DEFAULT_ACCEPT,
  multiple = true,
  title = "Add media",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: UploadQueue;
  accept?: string;
  multiple?: boolean;
  title?: string;
}) {
  const [tab, setTab] = useState<Tab>("device");
  // The Google Picker is its own overlay; a modal dialog underneath would swallow its clicks and focus.
  const [picking, setPicking] = useState(false);

  const chooseFromDrive = useCallback(async () => {
    try {
      const config = await drivePickerAction();
      setPicking(true);
      const picked = await pickDriveFiles({
        ...config,
        mimeTypes: mimeTypesForAccept(accept),
      }).finally(() => setPicking(false));
      if (picked?.length) await queue.addDrive(multiple ? picked : picked.slice(0, 1));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open Google Drive");
    }
  }, [accept, multiple, queue]);

  return (
    <Dialog open={open && !picking} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] w-[min(96vw,44rem)] max-w-none flex-col gap-5 overflow-hidden sm:max-w-none",
          // Phone: full-screen sheet
          "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal text-ivory">{title}</DialogTitle>
          <DialogDescription>
            Files go straight to storage. Imports keep running if you close this window.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="device">
              <LaptopIcon aria-hidden /> This device
            </TabsTrigger>
            <TabsTrigger value="drive">
              <GoogleDriveLogo className="h-3.5 w-auto" /> Google Drive
            </TabsTrigger>
          </TabsList>
          <TabsContent value="device" className="pt-2">
            <DeviceTab accept={accept} multiple={multiple} onFiles={queue.addFiles} />
          </TabsContent>
          <TabsContent value="drive" className="pt-2">
            <DriveTab onChoose={chooseFromDrive} />
          </TabsContent>
        </Tabs>

        <QueueList items={queue.items} onRetry={queue.retry} onDismiss={queue.dismiss} />
      </DialogContent>
    </Dialog>
  );
}

function DeviceTab({
  accept,
  multiple,
  onFiles,
}: {
  accept: string;
  multiple: boolean;
  onFiles: (files: FileList | File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "grid place-items-center rounded-md border border-dashed border-border px-6 py-10 text-center transition-colors",
        dragging && "border-red bg-red/5",
      )}
    >
      <p className="font-serif text-2xl text-ivory">Drop stills, films or PDFs here</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Images go to the image store, video to the video host. Videos take a minute to process.
      </p>
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        data-testid="device-input"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button className="mt-4" onClick={() => input.current?.click()}>
        Browse files
      </Button>
    </div>
  );
}

function DriveTab({ onChoose }: { onChoose: () => Promise<void> }) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      googleStatusAction().catch((): GoogleStatus => ({
        configured: false,
        pickerConfigured: false,
        accounts: [],
      })),
    [],
  );
  const refresh = useCallback(async () => setStatus(await load()), [load]);
  useEffect(() => {
    let live = true;
    load().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, [load]);

  if (!status)
    return <p className="py-8 text-center text-sm text-muted-foreground">Checking Google Drive…</p>;

  if (!status.configured || !status.pickerConfigured) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p className="text-ivory">Google Drive isn&apos;t set up yet.</p>
        <p className="mt-1">
          Add the Google client ID/secret, Picker API key and project number to the environment
          (docs/03, &ldquo;Import sources&rdquo;), then reload.
        </p>
      </div>
    );
  }

  const account = status.accounts.find((a) => a.drive);
  if (!account) {
    return (
      <div className="grid place-items-center rounded-md border border-dashed border-border px-6 py-10 text-center">
        <GoogleDriveLogo className="mb-4 h-9 w-auto" />
        <p className="font-serif text-2xl text-ivory">Import masters from Google Drive</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Connect once. The site only sees the files you pick, nothing else in your Drive.
        </p>
        <Button
          className="mt-4"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (await connectGoogle("drive")) toast.success("Google Drive connected");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't connect Google Drive");
            } finally {
              setBusy(false);
              void refresh();
            }
          }}
        >
          {busy ? (
            "Waiting for Google…"
          ) : (
            <>
              <GoogleLogo className="size-3.5" /> Connect Google Drive
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid place-items-center gap-3 rounded-md border border-dashed border-border px-6 py-10 text-center">
      <GoogleDriveLogo className="mb-1 h-9 w-auto" />
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onChoose();
          setBusy(false);
        }}
      >
        {busy ? "Opening Drive…" : "Choose from Drive"}
      </Button>
      <p className="max-w-md text-xs text-muted-foreground">
        Large files copy server to server, so they don&apos;t pass through this browser. Google
        Docs, Sheets and Slides can&apos;t be imported.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <GoogleLogo className="size-3.5" />
          Connected as <span className="text-ivory">{account.email ?? "your Google account"}</span>
        </span>
        <span aria-hidden>·</span>
        <ConfirmButton
          size="xs"
          variant="ghost"
          confirmLabel={account.gmail ? "Also stops Gmail alerts. Sure?" : "Disconnect?"}
          onConfirm={async () => {
            await disconnectGoogleAction(account.id);
            toast.success("Google disconnected");
            void refresh();
          }}
        >
          Disconnect
        </ConfirmButton>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<QueueItem["status"], string> = {
  uploading: "",
  processing: "Processing…",
  done: "Done",
  error: "Failed",
};

export function QueueList({
  items,
  onRetry,
  onDismiss,
}: {
  items: QueueItem[];
  onRetry: (key: string) => void;
  onDismiss: (key: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section aria-label="Uploads" className="-mx-1 min-h-0 overflow-y-auto px-1">
      <p className="label mb-2 text-smoke">Queue</p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.key} className="text-sm" data-testid="queue-item">
            <div className="flex items-center gap-2">
              {item.source === "drive" ? (
                <GoogleDriveLogo className="h-3.5 w-auto shrink-0" title="Google Drive" />
              ) : (
                <LaptopIcon className="size-3.5 shrink-0 text-smoke" aria-label="This device" />
              )}
              <span className="min-w-0 flex-1 truncate text-ivory">{item.name}</span>
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  item.status === "error" ? "text-red-bright" : "text-muted-foreground",
                )}
              >
                {item.status === "uploading"
                  ? `${Math.round(item.progress * 100)}%`
                  : STATUS_LABEL[item.status]}
              </span>
              {item.status === "error" && (item.source === "device" || item.assetId) ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Retry ${item.name}`}
                  onClick={() => onRetry(item.key)}
                >
                  <RotateCcwIcon />
                </Button>
              ) : null}
              {item.status === "done" || item.status === "error" ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Dismiss ${item.name}`}
                  onClick={() => onDismiss(item.key)}
                >
                  <XIcon />
                </Button>
              ) : null}
            </div>
            <div
              className="mt-1.5 h-0.5 bg-graphite"
              role="progressbar"
              aria-label={`${item.name} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress * 100)}
            >
              <div
                className={cn(
                  "h-full transition-[width]",
                  item.status === "error" ? "bg-oxblood" : "bg-red",
                )}
                style={{ width: `${item.status === "done" ? 100 : item.progress * 100}%` }}
              />
            </div>
            {item.error ? <p className="mt-1 text-xs text-red-bright">{item.error}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
