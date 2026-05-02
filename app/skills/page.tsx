import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Skills } from "../../components/skills";
import { Footer } from "../../components/footer";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
    title: "Skills",
    description:
        "Technical skill set of Raish Momin — proficiency across React, Next.js, TypeScript, Node.js, MongoDB, PostgreSQL, Docker, AWS, and more.",
    alternates: { canonical: `${SITE_URL}/skills` },
    openGraph: {
        title: "Skills — Raish Momin",
        description:
            "A working stack honed across years of shipping. Comfortable across the full stack, opinionated where it matters.",
        url: `${SITE_URL}/skills`,
    },
};

export default function SkillsPage() {
    return (
        <>
            <Navbar />
            <main className="relative pt-24">
                <Skills />
            </main>
            <Footer />
        </>
    );
}
