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

const MainComponent = () => {
  const [data, setdata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { fetch, value } = usePersonalStore();

  useEffect(() => {
    if (loading && !value) {
      fetch("/api/skils");
    }
  }, []);
  useEffect(() => {
    if (value && Object.keys(value).length > 0) {
      setdata(value);
      setLoading(false);
    }
  }, [value]);

  return (
    <div>
      {!loading && (
        <>
          <Hero />
          <About />
          <Skills />
          <Experience  />
          <Projects />
          <Contact />
          <Footer />
        </>
      )}
    </div>
  );
};

export default MainComponent;
