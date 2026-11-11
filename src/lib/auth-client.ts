"use client";
import { createAuthClient } from "better-auth/react";

// Same-origin, so no baseURL needed.
export const authClient = createAuthClient();
export const { signIn, signOut, useSession } = authClient;
