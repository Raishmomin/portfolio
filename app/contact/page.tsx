import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { ContactForm } from "../../components/contact-form";
import { Accent } from "../../components/ui/primitives";
import { RelatedPages } from "../../components/pages/about/subpage";
import { FaqSection } from "../../components/pages/about/faq-list";
import { ContactChannels } from "../../components/pages/contact/channels";
import { PageIntro, PageSection, SectionHead, card, reveal } from "../../components/pages/ui";
import { pageNeuralData } from "../../components/pages/neural";
import { NeuralStage } from "../../components/neural";
import { PROFILE } from "@/lib/profile";
import {
  buildMetadata,
  breadcrumbList,
  webPageSchema,
  faqPageSchema,
} from "@/lib/seo";
import { FAQS } from "@/lib/faqs";
import { getPersonal } from "@/lib/data";

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  path: "/contact",
  title: "Contact",
  description:
    "Get in touch with Raish Momin — open to senior engineering roles, freelance projects, and meaningful collaborations. Send a message directly.",
  keywords: [
    "Contact Raish Momin",
    "Hire Full Stack Developer",
    "Hire React engineer",
    "Freelance Next.js developer",
    "Get in touch",
  ],
});

export default async function ContactPage() {
  const [personal, neural] = await Promise.all([getPersonal(), pageNeuralData()]);
  const faqs = FAQS["/contact"] ?? [];
  const schema = [
    webPageSchema({
      type: "ContactPage",
      name: "Contact — Raish Momin",
      description: metadata.description as string,
      path: "/contact",
    }),
    faqPageSchema(faqs, "/contact"),
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Contact", path: "/contact" },
    ]),
  ];
  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <NeuralStage data={neural} />
        <PageIntro
          crumbs={[{ name: "Home", href: "/" }, { name: "Contact" }]}
          kicker="~/contact · IST (UTC+5:30)"
          scene="contact"
          note="The whole network converges into one bright node, with a line drawn out to you: a direct line to me."
          title={
            <>
              Contact — <Accent>let&apos;s build something.</Accent>
            </>
          }
          lead="Have a project in mind, a role to fill, or just want to say hi? Drop me a note."
        >
          <p className="mt-8 flex items-start gap-2.5 text-[15px] leading-6 text-foreground" {...reveal(240)}>
            <span aria-hidden="true" className="status-dot mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-ok" />
            Open to {PROFILE.availability}
          </p>
        </PageIntro>

        <PageSection id="contact" section="contact" scene="contact" stage="full" label="Contact details and form">
          <div data-card-group="" className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
            <div className="min-w-0 lg:col-span-5">
              <ContactChannels personal={personal} />
            </div>
            <div {...card("zoom")} className="panel min-w-0 p-6 md:p-8 lg:col-span-7" role="group" aria-labelledby="message-heading">
              <SectionHead
                id="message-heading"
                index="02"
                kicker="message"
                className="mb-8"
                title={
                  <>
                    Send a <Accent>message.</Accent>
                  </>
                }
              />
              <ContactForm />
            </div>
          </div>
        </PageSection>

        <FaqSection
          faqs={faqs}
          index="03"
          stage="right"
          title={
            <>
              Before you <Accent>reach out.</Accent>
            </>
          }
        />

        <RelatedPages index="04" stage="left" keys={["services", "projects", "experience", "about"]} />
      </main>
      <Footer />
    </>
  );
}
