"use client";
import React, { useEffect, useState } from "react";
import { Hero } from "./hero";
import { About } from "./about";
import { Skills } from "./skills";
import { Experience } from "./experience";
import { Projects } from "./projects";
import { Contact } from "./contact";
import { Footer } from "./footer";
import { usePersonalStore } from "@/lib/zutand";
import { fetchIPInfo } from "@/lib/ipInfo";
import { Loader } from "lucide-react";

const MainComponent = () => {
  const [loading, setLoading] = useState(true);
  const { fetch, value } = usePersonalStore();

  useEffect(() => {
    if (loading && !value) {
      fetch("/api/skils");
      fetchIPInfo();
    }
  }, []);
  useEffect(() => {
    if (value && Object.keys(value).length > 0) {
      setLoading(false);
    }
  }, [value]);

  return (
    <div>
      {!loading ? (
        <main className="bg-white dark:bg-black min-h-screen">
          <Hero />
          <About />
          <Skills />
          <Experience />
          <Projects />
          <Contact />
          <Footer />
        </main>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-black">
          <div className="relative flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-400 animate-pulse">
              Loading Experience...
            </div>

            {/* Decorative background blobs for loader */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-blob"></div>
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainComponent;
