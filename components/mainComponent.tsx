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
        <>
          <Hero />
          <About />
          <Skills />
          <Experience />
          <Projects />
          <Contact />
          <Footer />
        </>
      ) : (
        <Loader
          className="fixed top-1/2 left-1/2 h-10 w-10 animate-spin text-gray-500"
        />
      )}
    </div>
  );
};

export default MainComponent;
