import type { Metadata } from "next";
import MainComponent from "../components/mainComponent";
import { PageJsonLd } from "../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { SITE, SITE_URL } from "@/lib/config";

export const metadata: Metadata = buildMetadata({
  path: "/",
  title: SITE.title,
  description: SITE.description,
  keywords: [
    "Raish Momin",
    "Full Stack Developer",
    "DevOps Engineer",
    "React developer portfolio",
    "Next.js portfolio",
    "Node.js engineer",
    "TypeScript",
    "MongoDB",
    "AWS",
    "MERN stack",
  ],
});

export default function Home() {
  const schema = [
    webPageSchema({
      name: SITE.title,
      description: SITE.description,
      path: "/",
    }),
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      "@id": `${SITE_URL}#profilepage`,
      url: SITE_URL,
      name: SITE.name,
      mainEntity: { "@id": `${SITE_URL}#person` },
    },
    breadcrumbList([{ name: "Home", path: "/" }]),
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <MainComponent />
    </>
  );
}
