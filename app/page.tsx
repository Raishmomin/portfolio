// app/page.tsx (or app/home/page.tsx)

import { Hero } from "../components/hero";
import { About } from "../components/about";
import { Skills } from "../components/skills";
import { Experience } from "../components/experience";
import { Projects } from "../components/projects";
// import { Testimonials } from "../components/testimonials"
import { Contact } from "../components/contact";
import { Footer } from "../components/footer";

// ✅ Server-side function
async function getData() {
  const res = await fetch(process.env.API_URL + "skils", {
    // Avoid caching on server
    cache: "no-store",
  });

  if (!res?.ok) {
    throw new Error("Failed to fetch data");
  }

  return res.json();
}

// ✅ Server component
export default async function Home() {
  const data = await getData();

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <Hero />
      <About />
      <Skills skillDetails={data?.skils[0]} />
      <Experience experiences={data?.experience} />
      <Projects projects={data?.projects} />
      {/* <Testimonials /> */}
      <Contact />
      <Footer />
    </main>
  );
}
