"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Card, CardContent } from "@/components/ui/card";
import { Code2, Rocket, Users, Coffee, Sparkles } from "lucide-react";
import { usePersonalStore } from "@/lib/zutand";

export function About() {
  const { value } = usePersonalStore();

  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const stats = [
    {
      icon: Code2,
      label: "Years Experience",
      value: value?.personalData[0]?.experience || "3+",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Rocket,
      label: "Projects Completed",
      value: value?.projects?.length ? `${value.projects.length}+` : "10+",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      icon: Users,
      label: "Happy Clients",
      value: "10+",
      color: "text-pink-500",
      bg: "bg-pink-500/10",
    },
    {
      icon: Coffee,
      label: "Coffee Consumed",
      value: "∞",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <section
      id="about"
      className="py-24 bg-white dark:bg-black relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            About Me
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Passionate about creating digital solutions that make a difference.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-8"
          >
            <div className="prose prose-lg dark:prose-invert">
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {value?.personalData[0]?.about_desc ||
                  "I'm a Full Stack Developer with a deep passion for building scalable, efficient, and user-friendly web applications. With a strong foundation in modern technologies like React, Next.js, and Node.js, I strive to deliver high-quality code that solves real-world problems."}
              </p>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
                My journey in tech has been driven by curiosity and a constant desire to learn. Whether it's architecting complex backend systems or crafting pixel-perfect user interfaces, I approach every project with dedication and attention to detail.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, index) => (
                <Card key={index} className="border-0 shadow-sm bg-gray-50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-900 transition-colors">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stat.value}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {stat.label}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* Image/Visual Side */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="relative"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Decorative blob */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary to-purple-500 rounded-full blur-[100px] opacity-20 animate-pulse"></div>

              {/* Main Card */}
              <div className="relative h-full bg-white dark:bg-gray-900 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900"></div>

                {/* Code Snippet Decoration */}
                <div className="absolute inset-4 bg-black/5 dark:bg-black/50 rounded-2xl p-6 font-mono text-sm text-gray-600 dark:text-gray-400 overflow-hidden">
                  <div className="flex gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="space-y-2 opacity-70">
                    <p><span className="text-purple-500">const</span> <span className="text-blue-500">developer</span> = {"{"}</p>
                    <p className="pl-4">name: <span className="text-green-500">"Raish Momin"</span>,</p>
                    <p className="pl-4">role: <span className="text-green-500">"Full Stack Engineer"</span>,</p>
                    <p className="pl-4">skills: [<span className="text-green-500">"React"</span>, <span className="text-green-500">"Node"</span>, <span className="text-green-500">"Cloud"</span>],</p>
                    <p className="pl-4">hardWorker: <span className="text-orange-500">true</span>,</p>
                    <p className="pl-4">coffeeLover: <span className="text-orange-500">true</span></p>
                    <p>{"}"};</p>
                  </div>
                </div>

                {/* Floating Badge */}
                <div className="absolute bottom-8 right-8 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <p className="font-bold text-gray-900 dark:text-white">Open to Work</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
