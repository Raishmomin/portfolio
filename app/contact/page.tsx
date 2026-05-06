import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Contact } from "../../components/contact";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";

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
  const schema = [
    webPageSchema({
      type: "ContactPage",
      name: "Contact — Raish Momin",
      description: metadata.description as string,
      path: "/contact",
    }),
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
      </main>
      <Footer />
    </>
  );
}
