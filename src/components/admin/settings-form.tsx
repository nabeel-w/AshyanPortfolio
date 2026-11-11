"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { settingsFields } from "@/features/admin/fields";
import { saveSettings, type SettingsInput } from "@/features/settings/actions";
import { SchemaForm } from "./schema-form";

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="max-w-2xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveSettings(value);
          if (!res.ok) {
            setErrors(res.errors);
            toast.error("Please fix the highlighted fields");
          } else {
            setErrors({});
            toast.success("Settings saved — the site is updated");
          }
        });
      }}
    >
      <div className="rounded-md border border-border bg-onyx p-5">
        <SchemaForm
          fields={settingsFields}
          value={value as unknown as Record<string, unknown>}
          onChange={(v) => setValue(v as unknown as SettingsInput)}
          errors={errors}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
