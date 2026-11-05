import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { ContactForm } from "../../components/contact-form";
import { toFormationData } from "../../components/cluster";
import { Accent, Container, Section } from "../../components/ui/primitives";
import {
  RelatedPages,
  SubpageIntro,
  SubsectionHeading,
} from "../../components/pages/about/subpage";
import { FaqList } from "../../components/pages/about/faq-list";
import { ContactChannels } from "../../components/pages/contact/channels";
import {
  buildMetadata,
  breadcrumbList,
  webPageSchema,
  faqPageSchema,
} from "@/lib/seo";
import { FAQS } from "@/lib/faqs";
import { getExperience, getPersonal, getProjects, getSkills } from "@/lib/data";

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
  const [personal, skills, experience, projects] = await Promise.all([
    getPersonal(),
    getSkills(),
    getExperience(),
    getProjects(),
  ]);
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
  const motif = toFormationData({ skills, experience, featuredProjects: projects.slice(0, 6) });

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
        <SubpageIntro
          crumb="Contact"
          title={
            <>
              Contact — <Accent>let&apos;s build something.</Accent>
            </>
          }
          lead="Have a project in mind, a role to fill, or just want to say hi? Drop me a note."
          motif={motif}
        />

        <Section section="contact" id="contact" aria-label="Contact details and form">
          <Container className="grid gap-14 lg:grid-cols-12 lg:gap-16">
            <div className="min-w-0 lg:col-span-5">
              <ContactChannels personal={personal} />
            </div>
            <div className="min-w-0 lg:col-span-7" role="group" aria-labelledby="message-heading">
              <SubsectionHeading kicker="02 · message" id="message-heading" className="mb-8">
                Send a message
              </SubsectionHeading>
              <ContactForm />
            </div>
          </Container>
        </Section>

        {faqs.length ? (
          <Section id="faq" aria-labelledby="faq-heading">
            <Container className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <SubsectionHeading kicker="03 · faq" id="faq-heading" className="lg:col-span-4">
                Before you reach out
              </SubsectionHeading>
              <div className="min-w-0 lg:col-span-8">
                <FaqList faqs={faqs} />
              </div>
            </Container>
          </Section>
        ) : null}

        <RelatedPages kicker="04 · next" keys={["services", "projects", "experience", "about"]} />
      </main>
      <Footer />
    </>
  );
}
