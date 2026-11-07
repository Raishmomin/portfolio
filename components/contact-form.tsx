"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import { launchPoint, signal } from "./pages/contact/signal";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type Fields = { name: string; email: string; subject: string; message: string };
type FieldName = keyof Fields;
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY: Fields = { name: "", email: "", subject: "", message: "" };
const ORDER: FieldName[] = ["name", "email", "subject", "message"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The same rules as app/api/contact/route.ts, checked first so each message sits next to its field. */
function validate(f: Fields): FieldErrors {
  const errors: FieldErrors = {};
  if (f.name.trim().length < 2) errors.name = "Name must be at least 2 characters";
  if (!EMAIL_RE.test(f.email)) errors.email = "Valid email is required";
  if (f.subject.trim().length < 2) errors.subject = "Subject must be at least 2 characters";
  if (f.message.trim().length < 2) errors.message = "Message must be at least 2 characters";
  return errors;
}

/** Maps the API's validation messages ("Name must…", "Valid email…") back to their fields. */
function fieldOf(message: string): FieldName | null {
  const m = message.toLowerCase();
  return ORDER.find((f) => m.startsWith(f) || (f === "email" && m.includes("email"))) ?? null;
}

const fieldId = (name: FieldName) => `contact-${name}`;

/**
 * Client island: the contact form and its sent state. Focus never drops to <body>:
 * the submit button stays focusable while sending (aria-disabled), a failed check
 * focuses the first invalid field (aria-invalid + aria-describedby), and a sent
 * message focuses its heading. The status region is always mounted, so the result
 * is announced. It also tells the contact globe (signal.ts) when a field gains focus,
 * on typing, and when a message is sent, from where the message leaves the page.
 */
export function ContactForm() {
  const [form, setForm] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const sentRef = useRef<HTMLHeadingElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const typedAt = useRef(0);
  const focusAfterReset = useRef(false);
  const focusInvalid = useRef<FieldName | null>(null);

  useEffect(() => {
    if (sent) sentRef.current?.focus();
    else if (focusAfterReset.current) {
      focusAfterReset.current = false;
      formRef.current?.querySelector<HTMLElement>("input, textarea")?.focus();
    }
  }, [sent]);

  // After the render that sets aria-invalid/aria-describedby, so both are announced with the field.
  useEffect(() => {
    if (!focusInvalid.current) return;
    document.getElementById(fieldId(focusInvalid.current))?.focus();
    focusInvalid.current = null;
  }, [errors]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError("");

    const invalid = validate(form);
    const first = ORDER.find((f) => invalid[f]);
    if (first) {
      focusInvalid.current = first;
      setErrors(invalid);
      return;
    }

    setErrors({});
    setSending(true);
    const at = launchPoint(submitRef.current);
    signal("send", at);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        signal("sent", at);
        setForm(EMPTY);
        setSent(true);
      } else {
        signal("error");
        const data = await res.json().catch(() => ({}));
        // Validation failures (400) arrive as { errors: string[] }; other failures as { error }.
        const messages: string[] = Array.isArray(data?.errors) ? data.errors : [];
        const byField: FieldErrors = {};
        const general: string[] = [];
        for (const m of messages) {
          const f = fieldOf(m);
          if (f) byField[f] = m;
          else general.push(m);
        }
        const firstServer = ORDER.find((f) => byField[f]);
        focusInvalid.current = firstServer ?? null;
        setErrors(byField);
        setError(general.join(". ") || (firstServer ? "" : data?.error || "Something went wrong. Try again."));
      }
    } catch {
      signal("error");
      setError("Network error. Please try again.");
    }
    setSending(false);
  }

  function update(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const name = e.target.name as FieldName;
    setForm({ ...form, [name]: e.target.value });
    if (errors[name]) setErrors({ ...errors, [name]: undefined });
    const now = performance.now();
    if (now - typedAt.current > 80) {
      typedAt.current = now;
      signal("type", launchPoint(e.target));
    }
  }

  function field(name: FieldName) {
    return { id: fieldId(name), name, value: form[name], onChange: update, error: errors[name] };
  }

  return (
    <div className="lg:col-span-8">
      <p role="status" className="sr-only">
        {sent ? "Message sent. Thanks for reaching out." : ""}
      </p>
      {sent ? (
        <div className="rounded-lg border border-border bg-card p-8 md:p-12">
          <p className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full border border-border">
              <Check className="h-3.5 w-3.5 text-ok" />
            </span>
            Delivered
          </p>
          <h3
            ref={sentRef}
            tabIndex={-1}
            className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-foreground outline-none"
          >
            Message sent.
          </h3>
          <p className="mt-2 text-[15px] leading-7 text-muted-foreground">
            Thanks for reaching out — I&apos;ll reply within a couple of days.
          </p>
          <button
            type="button"
            onClick={() => {
              focusAfterReset.current = true;
              setSent(false);
            }}
            className={`mt-6 inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline underline-offset-4 transition-colors duration-150 hover:text-foreground ${FOCUS_RING}`}
          >
            Send another message
          </button>
        </div>
      ) : (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onFocus={(e) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) signal("focus", launchPoint(e.target));
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) signal("blur");
          }}
          className="space-y-6"
          noValidate
          aria-busy={sending}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field {...field("name")} label="Name" autoComplete="name" />
            <Field {...field("email")} label="Email" type="email" autoComplete="email" />
          </div>
          <Field {...field("subject")} label="Subject" />
          <Field {...field("message")} label="Message" multiline />

          <div className="flex flex-col-reverse items-stretch gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <button
              ref={submitRef}
              type="submit"
              aria-disabled={sending}
              className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 aria-disabled:cursor-progress aria-disabled:opacity-60 sm:ml-auto ${FOCUS_RING}`}
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
  error?: string;
  type?: string;
  autoComplete?: string;
  multiline?: boolean;
};

/** Always-visible label above a bordered field (no floating-label animation). Every field is required. */
function Field({ id, name, label, value, onChange, error, type = "text", autoComplete, multiline }: FieldProps) {
  const errorId = `${id}-error`;
  const shared = {
    id,
    name,
    value,
    onChange,
    required: true,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  };
  const input = `mt-2 block w-full rounded-md border border-border bg-card px-4 py-3 text-base text-foreground transition-colors duration-150 hover:border-foreground/30 aria-[invalid=true]:border-destructive ${FOCUS_RING}`;

  return (
    <div>
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        <span aria-hidden="true"> *</span>
      </label>
      {multiline ? (
        <textarea {...shared} rows={6} className={`${input} min-h-36 resize-y`} />
      ) : (
        <input {...shared} type={type} autoComplete={autoComplete} className={`${input} min-h-12`} />
      )}
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
