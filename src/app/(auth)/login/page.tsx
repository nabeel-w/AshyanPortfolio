import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <p className="label mb-3 text-red">Admin</p>
        <h1 className="mb-8 font-serif text-5xl text-ivory">Sign in</h1>
        <LoginForm />
      </div>
    </main>
  );
}
