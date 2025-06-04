import { Hero } from "../components/hero"
import { About } from "../components/about"
import { Skills } from "../components/skills"
import { Experience } from "../components/experience"
import { Projects } from "../components/projects"
// import { Testimonials } from "../components/testimonials"
import { Contact } from "../components/contact"
import { Footer } from "../components/footer"

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <Hero />
      <About />
      <Skills />
      <Experience />
      <Projects />
      {/* <Testimonials /> */}
      <Contact />
      <Footer />
    </main>
  )
}
