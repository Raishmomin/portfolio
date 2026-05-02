import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Experience } from "../../components/experience";
import { Footer } from "../../components/footer";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
    title: "Experience",
    description:
        "Work experience timeline of Raish Momin — from junior developer to senior full-stack engineer, with roles spanning React, Node.js, TypeScript, and cloud infrastructure.",
    alternates: { canonical: `${SITE_URL}/experience` },
    openGraph: {
        title: "Experience — Raish Momin",
        description:
            "A timeline of engineering roles, projects, and the through-line that connects them.",
        url: `${SITE_URL}/experience`,
    },
};

export default function ExperiencePage() {
    return (
        <>
            <Navbar />
            <main className="relative pt-24">
                <Experience />
            </main>
            <Footer />
        </>
    );
}
