import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Projects } from "../../components/projects";
import { Footer } from "../../components/footer";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
    title: "Projects",
    description:
        "Explore selected projects by Raish Momin — full-stack web applications, DevOps pipelines, and commerce APIs built with React, Node.js, and AWS.",
    alternates: { canonical: `${SITE_URL}/projects` },
    openGraph: {
        title: "Projects — Raish Momin",
        description:
            "A curated set of production projects spanning frontend, backend, full-stack, and DevOps.",
        url: `${SITE_URL}/projects`,
    },
};

export default function ProjectsPage() {
    return (
        <>
            <Navbar />
            <main className="relative pt-24">
                <Projects />
            </main>
            <Footer />
        </>
    );
}
