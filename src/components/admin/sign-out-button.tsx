"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/login");
      }}
      className="block w-full rounded-md px-3 py-2 text-left text-sm whitespace-nowrap text-smoke transition-colors hover:bg-graphite hover:text-ivory"
    >
      Sign out
    </button>
  );
}
