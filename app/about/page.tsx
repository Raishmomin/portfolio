import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { About } from "../../components/about";
import { Footer } from "../../components/footer";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
    title: "About",
    description:
        "Learn more about Raish Momin — a full-stack developer with 4+ years of experience building production React, Node.js, and cloud infrastructure.",
    alternates: { canonical: `${SITE_URL}/about` },
    openGraph: {
        title: "About — Raish Momin",
        description:
            "Full-stack developer with 4+ years building scalable web applications. Strong foundation in React, Next.js, Node.js, and DevOps.",
        url: `${SITE_URL}/about`,
    },
};

export default function AboutPage() {
    return (
        <>
            <Navbar />
            <main className="relative pt-24">
                <About />
            </main>
            <Footer />
        </>
    );
}
