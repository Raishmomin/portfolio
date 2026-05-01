"use client";
import { useEffect, useState } from "react";
import { Hero } from "./hero";
import { About } from "./about";
import { Skills } from "./skills";
import { Experience } from "./experience";
import { Projects } from "./projects";
import { Contact } from "./contact";
import { Footer } from "./footer";
import { Navbar } from "./navbar";
import { BrandLoader } from "./loader";
import { usePersonalStore } from "@/lib/zutand";
import { fetchIPInfo } from "@/lib/ipInfo";

const MainComponent = () => {
  const [showLoader, setShowLoader] = useState(true);
  const { fetch, value } = usePersonalStore();

  useEffect(() => {
    if (!value) {
      fetch("/api/skils");
      const idle =
        typeof window !== "undefined" && "requestIdleCallback" in window
          ? (window as unknown as { requestIdleCallback: (cb: () => void) => void })
              .requestIdleCallback
          : (cb: () => void) => setTimeout(cb, 600);
      idle(() => fetchIPInfo());
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowLoader(false), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <BrandLoader visible={showLoader} />
      <Navbar />
      <main className="relative">
        <Hero />
        <About />
        <Skills />
        <Experience />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </>
  );
};

export default MainComponent;
