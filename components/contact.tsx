"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, MapPin, Phone, Github, Linkedin, ArrowRight, Check } from "lucide-react";
import { Section, RevealHeading } from "./section";
import { Magnetic } from "./magnetic-button";
import { usePersonalStore } from "@/lib/zutand";
import { SITE } from "@/lib/config";

export function Contact() {
  const { value } = usePersonalStore();
  const reduce = useReducedMotion();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const email = value?.personalData?.[0]?.email || SITE.email;
  const phone = value?.personalData?.[0]?.phone_number;
  const location = value?.personalData?.[0]?.location || "Remote · Worldwide";
  const github = value?.personalData?.[0]?.git_hub || SITE.github;
  const linkedin = value?.personalData?.[0]?.linkdin || SITE.linkedin;

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
        setError(data?.error || "Something went wrong. Try again.");
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
    <Section id="contact" ariaLabel="Contact">
      <RevealHeading
        id="contact"
        eyebrow="Contact"
        title="Let's build something."
        description="Have a project in mind, a role to fill, or just want to say hi? Drop me a note."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        <aside className="lg:col-span-4 space-y-10">
          <ul className="space-y-6">
            <ContactRow icon={Mail} label="Email" value={email} href={`mailto:${email}`} />
            {phone && (
              <ContactRow icon={Phone} label="Phone" value={phone} href={`tel:${phone}`} />
            )}
            <ContactRow icon={MapPin} label="Location" value={location} />
          </ul>

          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Elsewhere
            </div>
            <div className="flex gap-2">
              <a
                href={github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="grid place-items-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="grid place-items-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-8">
          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-border rounded-2xl p-12 text-center bg-card"
            >
              <div className="grid place-items-center w-12 h-12 mx-auto rounded-full border border-border mb-6">
                <Check className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight mb-2">Message sent.</h3>
              <p className="text-sm text-muted-foreground">
                Thanks for reaching out — I&apos;ll reply within a couple of days.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-8 text-sm underline-offset-4 hover:underline text-muted-foreground hover:text-foreground transition-colors"
              >
                Send another message
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GhostField
                  id="contact-name"
                  name="name"
                  label="Name"
                  value={form.name}
                  onChange={update}
                  required
                />
                <GhostField
                  id="contact-email"
                  name="email"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={update}
                  required
                />
              </div>
              <GhostField
                id="contact-subject"
                name="subject"
                label="Subject"
                value={form.subject}
                onChange={update}
                required
              />
              <GhostField
                id="contact-message"
                name="message"
                label="Message"
                value={form.message}
                onChange={update}
                multiline
                required
              />

              <div className="flex items-center justify-between gap-6 pt-2">
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="ml-auto">
                  <Magnetic
                    as="button"
                    type="submit"
                    disabled={sending}
                    className="group h-12 px-7 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2">
                      {sending ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="w-3.5 h-3.5 border border-background/30 border-t-background rounded-full animate-spin"
                          />
                          Sending
                        </>
                      ) : (
                        <>
                          Send message
                          <ArrowRight
                            className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </span>
                  </Magnetic>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const Wrapper: React.ElementType = href ? "a" : "div";
  return (
    <li>
      <Wrapper
        href={href}
        className="group flex items-start gap-4 py-2 text-foreground hover:text-foreground transition-colors"
      >
        <Icon
          className="w-4 h-4 mt-1 text-muted-foreground group-hover:text-foreground transition-colors"
          aria-hidden="true"
        />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
            {label}
          </div>
          <div className="text-sm group-hover:underline underline-offset-4">{value}</div>
        </div>
      </Wrapper>
    </li>
  );
}

type GhostFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
};

function GhostField({
  id,
  name,
  label,
  value,
  onChange,
  type = "text",
  required,
  multiline,
}: GhostFieldProps) {
  const reduce = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;

  const labelClass = `pointer-events-none absolute left-0 transition-all duration-200 ${
    focused || filled
      ? "top-0 text-xs uppercase tracking-[0.2em] text-muted-foreground"
      : "top-7 text-base text-muted-foreground"
  }`;

  const sharedInput =
    "w-full bg-transparent border-0 border-b border-border focus:border-foreground outline-none pt-7 pb-3 text-base text-foreground placeholder:text-transparent transition-colors";

  return (
    <div className="relative">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          rows={5}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`${sharedInput} resize-none`}
          placeholder={label}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={sharedInput}
          placeholder={label}
        />
      )}
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ scaleX: focused ? 1 : 0 }}
        transition={
          reduce ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
        }
        style={{ transformOrigin: "left" }}
        className="absolute left-0 right-0 -bottom-px h-px bg-foreground"
      />
    </div>
  );
}
