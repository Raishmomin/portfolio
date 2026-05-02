import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Contact } from "../../components/contact";
import { Footer } from "../../components/footer";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
    title: "Contact",
    description:
        "Get in touch with Raish Momin — open to senior engineering roles, freelance projects, and meaningful collaborations. Send a message directly.",
    alternates: { canonical: `${SITE_URL}/contact` },
    openGraph: {
        title: "Contact — Raish Momin",
        description:
            "Have a project in mind, a role to fill, or just want to say hi? Drop a note.",
        url: `${SITE_URL}/contact`,
    },
};

export default function ContactPage() {
    return (
        <>
            <Navbar />
            <main className="relative pt-24">
                <Contact />
            </main>
            <Footer />
        </>
    );
}
