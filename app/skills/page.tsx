import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Skills } from "../../components/skills";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/skills",
  title: "Skills",
  description:
    "Technical skill set of Raish Momin — proficiency across React, Next.js, TypeScript, Node.js, MongoDB, PostgreSQL, Docker, AWS, and more.",
  keywords: [
    "Raish Momin skills",
    "React skills",
    "Next.js skills",
    "Node.js skills",
    "Full Stack skills",
    "DevOps skills",
    "TypeScript",
    "MongoDB",
    "AWS",
  ],
});

async function getSkillNames(): Promise<string[]> {
  try {
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const doc = await db.collection("skills").findOne({});
    if (!doc) return [];
    const out: string[] = [];
    for (const [k, v] of Object.entries(doc)) {
      if (k === "_id" || !Array.isArray(v)) continue;
      for (const s of v as { name?: string }[]) if (s?.name) out.push(s.name);
    }
    return out;
  } catch {
    return [];
  }
}

export default async function SkillsPage() {
  const skills = await getSkillNames();

  const schema: object[] = [
    webPageSchema({
      name: "Skills — Raish Momin",
      description: metadata.description as string,
      path: "/skills",
    }),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Technical skills",
      numberOfItems: skills.length,
      itemListElement: skills.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "DefinedTerm", name: s },
      })),
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Skills", path: "/skills" },
    ]),
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main className="relative pt-24">
        <Skills />
      </main>
      <Footer />
    </>
  );
}
