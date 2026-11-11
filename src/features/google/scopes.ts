/**
 * The Google scopes this app asks for, per feature. Both are granted to one linked Google account
 * (incremental consent: Better Auth merges scopes when the same account is linked again).
 *
 *  - drive.file  — non-sensitive. Only the files the admin picks in the Google Picker.
 *  - gmail.send  — sensitive (not restricted). Send-only: we can't read the mailbox.
 */
export const GOOGLE_SCOPES = {
  drive: "https://www.googleapis.com/auth/drive.file",
  gmail: "https://www.googleapis.com/auth/gmail.send",
} as const;

export type GoogleFeature = keyof typeof GOOGLE_SCOPES;

/** Better Auth stores granted scopes comma-joined; Google itself uses spaces. Accept both. */
export function parseScopes(scope: string | null | undefined): string[] {
  return (scope ?? "").split(/[\s,]+/).filter(Boolean);
}

export function hasFeature(scope: string | null | undefined, feature: GoogleFeature): boolean {
  return parseScopes(scope).includes(GOOGLE_SCOPES[feature]);
}

/** What the admin UI needs to know about one linked Google account (serializable). */
export type GoogleAccountInfo = {
  /** Better Auth Account row id */
  id: string;
  email: string | null;
  drive: boolean;
  gmail: boolean;
};

export type GoogleStatus = {
  /** GOOGLE_CLIENT_ID / SECRET set — linking is possible */
  configured: boolean;
  /** Picker API key + project number set — the Drive tab can open the Picker */
  pickerConfigured: boolean;
  accounts: GoogleAccountInfo[];
};
