import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Toaster } from "@/components/ui/sonner";
import { requireAdmin } from "@/lib/session";

// Every admin view reads the session per request, so it is never an instant (prefetched) navigation.
export const instant = false;

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/settings", label: "Settings" },
];

/**
 * Admin shell. The nav is static (prerendered); the session check streams in behind Suspense,
 * which Cache Components requires for anything that reads cookies/headers.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink md:flex-row">
      <aside className="border-b border-hairline md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-14 items-center px-4 md:h-16 md:px-5">
          <Link href="/" className="label text-ivory">
            Ashyan Zafar <span className="text-red">·</span> Admin
          </Link>
        </div>
        <nav aria-label="Admin" className="overflow-x-auto px-2 pb-2 md:px-3">
          <ul className="flex gap-1 md:flex-col">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm whitespace-nowrap text-smoke transition-colors hover:bg-graphite hover:text-ivory"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="md:mt-4 md:border-t md:border-border md:pt-4">
              <SignOutButton />
            </li>
          </ul>
        </nav>
      </aside>
      <Toaster position="bottom-right" />
      <div className="min-w-0 flex-1 p-4 md:p-8">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-onyx" />}>
          <Guard>{children}</Guard>
        </Suspense>
      </div>
    </div>
  );
}

async function Guard({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
