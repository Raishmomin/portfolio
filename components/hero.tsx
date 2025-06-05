"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { Navbar } from "../components/navbar";
import { useInView } from "react-intersection-observer";
import { usePersonalStore } from "@/lib/zutand";

export function Hero() {
  const { value } = usePersonalStore();

  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    console.log(value);
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
    }[] = [];

    const createParticles = () => {
      const particleCount = Math.min(Math.floor(window.innerWidth / 10), 100);
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 0.5,
          speedX: Math.random() * 0.5 - 0.25,
          speedY: Math.random() * 0.5 - 0.25,
          color: `rgba(${Math.floor(Math.random() * 100 + 155)}, ${Math.floor(
            Math.random() * 100 + 155
          )}, ${Math.floor(Math.random() * 255)}, ${
            Math.random() * 0.5 + 0.1
          })`,
        });
      }
    };

    const animateParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0) p.y = canvas.height;

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const distance = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (distance < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(150, 150, 255, ${
              0.2 * (1 - distance / 100)
            })`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animateParticles);
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles.length = 0;
      createParticles();
    };

    createParticles();
    animateParticles();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-start justify-center overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0 bg-gradient-to-b from-white to-blue-50 dark:from-gray-950 dark:to-blue-950"
      ></canvas>

      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 sm:pt-40 pt-20 h min-h-fit">
        <div className="flex flex-col items-center justify-center text-center">
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-4xl"
          >
            <div className="inline-block mb-6 px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
              Full Stack Developer & DevOps Engineer
            </div>
            <h1 className="text-3xl md:text-6xl font-bold text-gray-900 dark:text-white">
              Hi, I'm{" "}
              <span className="text-blue-600 dark:text-blue-400">
                Raish Momin
              </span>
            </h1>
            <div className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-300 h-4 sm:h-12 mb-8 sm:mb-0">
              <TypeAnimation
                sequence={[
                  "Full Stack Developer",
                  2000,
                  "Next.js Expert",
                  2000,
                  "React.js Specialist",
                  2000,
                  "Node.js Expert",
                  2000,
                  "DevOps Engineer",
                  2000,
                ]}
                wrapper="span"
                speed={50}
                repeat={Number.POSITIVE_INFINITY}
              />
            </div>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-10">
              {value?.personalData[0]?.main_desc || ""}
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white sm:px-8 px-4 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                <a href="#contact" className="flex items-center">
                  Get In Touch
                </a>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="flex items-center gap-2 px-8 py-6 text-lg rounded-xl border-2 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <a href="#projects" className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  View Projects
                </a>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  window.open(value?.personalData[0]?.resume_link, "_blank");
                }}
                className="flex items-center gap-2 px-8 py-6 text-lg rounded-xl border-2 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Download className="h-5 w-5" />
                Download Resume
              </Button>
            </div>
          </motion.div>
        </div>

        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        >
          <a href="#about" className="inline-block animate-bounce">
            <ArrowDown className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          </a>
        </motion.div> */}
      </div>
    </section>
  );
}
