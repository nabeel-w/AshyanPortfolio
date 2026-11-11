"use client";

import { authClient } from "@/lib/auth-client";
import { type GoogleFeature, GOOGLE_SCOPES } from "./scopes";

/**
 * Browser helpers for the linked Google account: the connect popup and the Google Picker.
 * Nothing here loads until the admin opens the Drive tab or clicks Connect.
 */

export const CONNECT_CHANNEL = "az-google-connect";
export type ConnectMessage = {
  type: "google-connect";
  feature: GoogleFeature;
  ok: boolean;
  error?: string;
};

/**
 * Link Google with one more scope (incremental consent) in a popup, so unsaved work on the page
 * survives. Google's pages sever `window.opener`, so the landing page (/connected) reports back over a
 * BroadcastChannel. Resolves true once linked, false if the admin gives up (closes it, an error).
 */
export async function connectGoogle(feature: GoogleFeature): Promise<boolean> {
  // Open synchronously inside the click so the popup isn't blocked; navigate it once we have the URL.
  const popup = window.open("", "az-google-connect", "popup,width=520,height=700");
  const landing = `/connected?feature=${feature}`;
  const { data, error } = await authClient.linkSocial({
    provider: "google",
    scopes: [GOOGLE_SCOPES[feature]],
    callbackURL: landing,
    errorCallbackURL: `${landing}&failed=1`,
    disableRedirect: true,
  });
  if (error || !data?.url) {
    popup?.close();
    throw new Error(error?.message ?? "Couldn't start the Google connection.");
  }
  if (!popup) {
    // Popups blocked: do it in this tab; the landing page links back.
    window.location.href = data.url;
    return new Promise(() => {});
  }
  popup.location.href = data.url;

  return new Promise<boolean>((resolve) => {
    const channel = new BroadcastChannel(CONNECT_CHANNEL);
    const giveUp = window.setTimeout(() => finish(false), 10 * 60 * 1000);
    function finish(ok: boolean) {
      channel.close();
      window.clearTimeout(giveUp);
      resolve(ok);
    }
    channel.onmessage = (e: MessageEvent<ConnectMessage>) => {
      if (e.data?.type === "google-connect" && e.data.feature === feature) finish(e.data.ok);
    };
  });
}

// ─── Google Picker ───────────────────────────────────────────────────────────

export type PickedFile = { id: string; name: string; mimeType: string; sizeBytes?: number };

type PickerDoc = { id: string; name: string; mimeType: string; sizeBytes?: number };
type PickerData = { action: string; docs?: PickerDoc[] };
// Minimal typing for the bits of the Picker API we use (it ships no npm types worth adding).
type PickerNS = {
  Action: { PICKED: string; CANCEL: string };
  ViewId: { DOCS: string };
  DocsViewMode: { LIST: string };
  Feature: { MULTISELECT_ENABLED: string; SUPPORT_DRIVES: string };
  DocsView: new (viewId: string) => {
    setMimeTypes(m: string): PickerViewChain;
    setIncludeFolders(b: boolean): PickerViewChain;
    setSelectFolderEnabled(b: boolean): PickerViewChain;
    setMode(m: string): PickerViewChain;
    setEnableDrives(b: boolean): PickerViewChain;
  };
  PickerBuilder: new () => PickerBuilderChain;
};
type PickerViewChain = InstanceType<PickerNS["DocsView"]>;
type PickerBuilderChain = {
  addView(v: unknown): PickerBuilderChain;
  enableFeature(f: string): PickerBuilderChain;
  setOAuthToken(t: string): PickerBuilderChain;
  setDeveloperKey(k: string): PickerBuilderChain;
  setAppId(id: string): PickerBuilderChain;
  setTitle(t: string): PickerBuilderChain;
  setCallback(cb: (data: PickerData) => void): PickerBuilderChain;
  build(): { setVisible(v: boolean): void; dispose(): void };
};
declare global {
  interface Window {
    gapi?: { load(name: string, opts: { callback: () => void; onerror: () => void }): void };
    google?: { picker?: PickerNS };
  }
}

let pickerReady: Promise<PickerNS> | null = null;

function loadPicker(): Promise<PickerNS> {
  pickerReady ??= new Promise<PickerNS>((resolve, reject) => {
    const fail = () => {
      pickerReady = null;
      reject(new Error("Couldn't load the Google Picker. Check your connection and try again."));
    };
    const ready = () =>
      window.gapi!.load("picker", {
        callback: () => resolve(window.google!.picker!),
        onerror: fail,
      });
    if (window.gapi) return ready();
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = ready;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pickerReady;
}

/** Open the Google Picker (files only, multi-select). Resolves null when cancelled. */
export async function pickDriveFiles(opts: {
  accessToken: string;
  apiKey: string;
  appId: string;
  mimeTypes: string[];
}) {
  const g = await loadPicker();
  return new Promise<PickedFile[] | null>((resolve) => {
    const mimes = opts.mimeTypes.join(",");
    // drive.file only covers picked *files*: folders are browsable but can't be selected.
    const myDrive = new g.DocsView(g.ViewId.DOCS)
      .setMimeTypes(mimes)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMode(g.DocsViewMode.LIST);
    const shared = new g.DocsView(g.ViewId.DOCS)
      .setMimeTypes(mimes)
      .setEnableDrives(true)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);
    const picker = new g.PickerBuilder()
      .addView(myDrive)
      .addView(shared)
      .enableFeature(g.Feature.MULTISELECT_ENABLED)
      .enableFeature(g.Feature.SUPPORT_DRIVES)
      .setOAuthToken(opts.accessToken)
      .setDeveloperKey(opts.apiKey)
      .setAppId(opts.appId)
      .setTitle("Import from Google Drive")
      .setCallback((data) => {
        if (data.action === g.Action.PICKED) {
          resolve(
            (data.docs ?? []).map((d) => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
              sizeBytes: d.sizeBytes,
            })),
          );
          picker.dispose();
        } else if (data.action === g.Action.CANCEL) {
          resolve(null);
          picker.dispose();
        }
      })
      .build();
    picker.setVisible(true);
  });
}
