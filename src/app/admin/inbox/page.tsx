import { InboxList } from "@/components/admin/inbox-list";
import { db } from "@/lib/db";

export default async function AdminInboxPage() {
  const items = await db.contactSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Enquiries</p>
        <h1 className="font-serif text-4xl text-ivory">Inbox</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Messages sent through the contact form.</p>
      </header>
      <InboxList
        items={items.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          company: m.company,
          projectType: m.budget,
          message: m.message,
          source: m.source,
          read: m.read,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
