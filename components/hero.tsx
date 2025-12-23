"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, ArrowRight, Sparkles } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { Navbar } from "../components/navbar";
import { usePersonalStore } from "@/lib/zutand";

export function Hero() {
  const { value } = usePersonalStore();

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white dark:bg-black selection:bg-primary/20"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/30 rounded-full blur-[120px] animate-blob mix-blend-multiply dark:mix-blend-screen"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/30 rounded-full blur-[120px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] bg-pink-500/30 rounded-full blur-[120px] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-screen"></div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02] dark:opacity-[0.05]"></div>
      </div>

      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-20">
        <div className="flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-5xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 backdrop-blur-md shadow-sm mb-8"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Full Stack Developer & DevOps Engineer
              </span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
              Hi, I'm{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-600">
                Raish Momin
              </span>
            </h1>

            <div className="text-xl md:text-2xl lg:text-3xl text-gray-600 dark:text-gray-400 h-12 mb-8 font-light">
              <TypeAnimation
                sequence={[
                  "Building Digital Experiences",
                  2000,
                  "Crafting Scalable Solutions",
                  2000,
                  "Engineering Modern Web Apps",
                  2000,
                  "Automating Cloud Infrastructure",
                  2000,
                ]}
                wrapper="span"
                speed={50}
                repeat={Number.POSITIVE_INFINITY}
              />
            </div>

            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              {value?.personalData[0]?.main_desc ||
                "I transform complex problems into elegant, scalable solutions. Specialized in the React ecosystem and Cloud Infrastructure."}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 transition-all hover:scale-105"
              >
                <a href="#contact" className="flex items-center gap-2">
                  Let's Talk <ArrowRight className="w-5 h-5" />
                </a>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-full border-2 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all hover:scale-105"
              >
                <a href="#projects" className="flex items-center gap-2">
                  View Work
                </a>
              </Button>

              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  if (value?.personalData[0]?.resume_link) {
                    window.open(value.personalData[0].resume_link, "_blank");
                  }
                }}
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-5 h-5" /> Resume
                </span>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
