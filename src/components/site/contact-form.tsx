"use client";

import { useActionState } from "react";
import { submitContact, type ContactState } from "@/features/contact/actions";
import { cn } from "@/lib/utils";

const field =
  "w-full border-0 border-b border-hairline bg-transparent px-0 py-3 text-ivory placeholder:text-smoke/60 focus:border-red focus:ring-0 focus:outline-none";

export function ContactForm({
  projectTypes,
  submitLabel,
  successMessage,
}: {
  projectTypes: string[];
  submitLabel: string;
  successMessage: string;
}) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { status: "idle" });
  const err = state.status === "error" ? state.fieldErrors ?? {} : {};

  if (state.status === "success") {
    return (
      <div role="status" className="border border-hairline bg-onyx p-8">
        <p className="label mb-3 text-red">● Message sent</p>
        <p className="font-serif text-3xl text-ivory">{successMessage}</p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
      <Field label="Name" name="name" required error={err.name} autoComplete="name" placeholder="Your name" />
      <Field label="Email" name="email" type="email" required error={err.email} autoComplete="email" placeholder="you@company.com" />
      <Field label="Company" name="company" autoComplete="organization" placeholder="Your company" />
      <label className="block">
        <span className="label text-smoke">Project type</span>
        <select name="projectType" defaultValue="" className={cn(field, "appearance-none [&>option]:bg-onyx")}>
          <option value="">Select type</option>
          {projectTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="label text-smoke">Message *</span>
        <textarea
          name="message"
          required
          rows={5}
          placeholder="Tell me about your project — timeline, format, references…"
          aria-invalid={Boolean(err.message)}
          aria-describedby={err.message ? "message-error" : undefined}
          className={cn(field, "resize-y")}
        />
        {err.message ? (
          <span id="message-error" className="mt-2 block text-sm text-red-bright">
            {err.message}
          </span>
        ) : null}
      </label>
      {/* Honeypot — hidden from people, irresistible to bots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0 opacity-0" />
      <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="label inline-flex min-h-12 items-center gap-3 rounded-full bg-ivory px-7 text-ink transition-colors duration-500 hover:bg-red hover:text-ivory disabled:opacity-60"
        >
          {pending ? "Sending…" : submitLabel}
          <span aria-hidden>→</span>
        </button>
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-red-bright">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  error,
  ...input
}: { label: string; name: string; required?: boolean; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label text-smoke">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={field}
        {...input}
      />
      {error ? (
        <span id={`${name}-error`} className="mt-2 block text-sm text-red-bright">
          {error}
        </span>
      ) : null}
    </label>
  );
}
