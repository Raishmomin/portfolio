import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Contact } from "../../components/contact";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { FAQSection } from "../../components/faq-section";
import {
  buildMetadata,
  breadcrumbList,
  webPageSchema,
  faqPageSchema,
} from "@/lib/seo";
import { FAQS } from "@/lib/faqs";

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

export default function ContactPage() {
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
      <main className="relative pt-24">
        <Contact />
        <FAQSection faqs={faqs} heading="Before you reach out" />
      </main>
      <Footer />
    </>
  );
}
