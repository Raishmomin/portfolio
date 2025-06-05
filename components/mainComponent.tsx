"use client";
import React, { useEffect, useState } from "react";
import { Hero } from "./hero";
import { About } from "./about";
import { Skills } from "./skills";
import { Experience } from "./experience";
import { Projects } from "./projects";
import { Contact } from "./contact";
import { Footer } from "./footer";

const MainComponent = () => {
  const [data, setdata] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GetData();
  }, []);

  const GetData = async () => {
    let details = await fetch("/api/skils")
      .then((res) => res.json())
      .catch((err) => console.error("Error fetching skills:", err));
    setdata(details);
    setLoading(false);
  };

  return (
    <div>
      <Hero />
      <About />
      {!loading && (
        <>
          <Skills skillDetails={data?.skils[0]} />
          <Experience experiences={data?.experience} />
          <Projects projects={data?.projects} />
        </>
      )}
      <Contact />
      <Footer />
    </div>
  );
};

export default MainComponent;
