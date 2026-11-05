import type { ComponentType } from "react";
import { Mail, MapPin, Phone, Github, Linkedin } from "lucide-react";
import { Section, RevealHeading } from "./section";
import { ContactForm } from "./contact-form";
import type { Personal } from "@/lib/data";

type ContactProps = {
  personal: Personal;
  headingAs?: "h1" | "h2";
};

export function Contact({ personal, headingAs = "h2" }: ContactProps) {
  const { email, phone, location, github, linkedin } = personal;

  return (
    <Section id="contact" ariaLabel="Contact" reveal={headingAs !== "h1"}>
      <RevealHeading
        as={headingAs}
        id="contact"
        eyebrow="Contact"
        title="Let's build something."
        description="Have a project in mind, a role to fill, or just want to say hi? Drop me a note."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        <aside className="lg:col-span-4 space-y-10">
          <ul className="space-y-6">
            {email && (
              <ContactRow icon={Mail} label="Email" value={email} href={`mailto:${email}`} />
            )}
            {phone && (
              // RFC 3966: the tel: URI carries digits and "+" only ("+91 94…" -> "+9194…").
              <ContactRow
                icon={Phone}
                label="Phone"
                value={phone}
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              />
            )}
            {location && <ContactRow icon={MapPin} label="Location" value={location} />}
          </ul>

          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Elsewhere
            </div>
            <div className="flex gap-2">
              {github && (
                <a
                  href={github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="grid place-items-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Github className="w-4 h-4" />
                </a>
              )}
              {linkedin && (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="grid place-items-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </aside>

        <ContactForm />
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
  icon: ComponentType<{ className?: string }>;
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

