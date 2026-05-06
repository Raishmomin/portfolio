import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { About } from "../../components/about";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/about",
  title: "About",
  description:
    "Learn more about Raish Momin — a full-stack developer with 4+ years of experience building production React, Node.js, and cloud infrastructure.",
  keywords: [
    "About Raish Momin",
    "Full Stack Developer biography",
    "React Next.js engineer",
    "Node.js developer",
    "DevOps engineer profile",
  ],
});

export default function AboutPage() {
  const schema = [
    webPageSchema({
      type: "AboutPage",
      name: "About — Raish Momin",
      description: metadata.description as string,
      path: "/about",
    }),
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "About", path: "/about" },
    ]),
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main className="relative pt-24">
        <About />
      </main>
      <Footer />
    </>
  );
}
