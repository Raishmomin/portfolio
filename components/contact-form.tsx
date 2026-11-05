"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { ArrowRight, Check } from "lucide-react";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Client island: the contact form and its sent state. */
export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: "", email: "", subject: "", message: "" });
        setSent(true);
        setTimeout(() => setSent(false), 6000);
      } else {
        const data = await res.json().catch(() => ({}));
        // Validation failures (400) arrive as { errors: string[] }; other failures as { error }.
        const messages = Array.isArray(data?.errors) ? data.errors.join(". ") : "";
        setError(messages || data?.error || "Something went wrong. Try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSending(false);
  }

  function update(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  return (
    <div className="lg:col-span-8">
      {sent ? (
        <div role="status" className="rounded-lg border border-border bg-card p-8 md:p-12">
          <p className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full border border-border">
              <Check className="h-3.5 w-3.5 text-ok" />
            </span>
            Delivered
          </p>
          <h3 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-foreground">Message sent.</h3>
          <p className="mt-2 text-[15px] leading-7 text-muted-foreground">
            Thanks for reaching out — I&apos;ll reply within a couple of days.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className={`mt-6 inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline underline-offset-4 transition-colors duration-150 hover:text-foreground ${FOCUS_RING}`}
          >
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate aria-busy={sending}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field
              id="contact-name"
              name="name"
              label="Name"
              autoComplete="name"
              value={form.name}
              onChange={update}
              required
            />
            <Field
              id="contact-email"
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update}
              required
            />
          </div>
          <Field
            id="contact-subject"
            name="subject"
            label="Subject"
            value={form.subject}
            onChange={update}
            required
          />
          <Field
            id="contact-message"
            name="message"
            label="Message"
            value={form.message}
            onChange={update}
            multiline
            required
          />

          <div className="flex flex-col-reverse items-stretch gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={sending}
              className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-60 sm:ml-auto ${FOCUS_RING}`}
            >
              {sending ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin rounded-full border border-primary-foreground/30 border-t-primary-foreground"
                  />
                  Sending
                </>
              ) : (
                <>
                  Send message
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type FieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  multiline?: boolean;
};

/** Always-visible label above a bordered field (no floating-label animation). */
function Field({ id, name, label, value, onChange, type = "text", autoComplete, required, multiline }: FieldProps) {
  const input =
    "mt-2 block w-full rounded-md border border-border bg-card px-4 py-3 text-base text-foreground transition-colors duration-150 hover:border-foreground/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40";

  return (
    <div>
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="text-primary">
            {" "}
            *
          </span>
        )}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          rows={6}
          className={`${input} min-h-36 resize-y`}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          required={required}
          className={`${input} min-h-12`}
        />
      )}
    </div>
  );
}
