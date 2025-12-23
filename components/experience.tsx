"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, MapPin, Briefcase, ChevronRight, ChevronLeft } from "lucide-react";
import { usePersonalStore } from "@/lib/zutand";

export function Experience() {
  const [experiences, setExperiences] = useState<any>(null);
  const { value } = usePersonalStore();
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && Object.keys(value).length > 0) {
      setExperiences(value?.experience || null);
    }
  }, [value]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || isPaused) return;

    const autoScroll = () => {
      const isDesktop = window.innerWidth >= 768;
      const cardWidth = isDesktop ? 400 : window.innerWidth * 0.85;
      const gap = 32; // gap-8 is 2rem = 32px
      const itemWidth = cardWidth + gap;

      const currentScroll = container.scrollLeft;
      const maxScroll = container.scrollWidth - container.clientWidth;

      if (currentScroll >= maxScroll - 10) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        const nextScroll = Math.floor((currentScroll + itemWidth) / itemWidth) * itemWidth;
        container.scrollTo({ left: nextScroll, behavior: "smooth" });
      }
    };

    const intervalId = setInterval(autoScroll, 3000);
    return () => clearInterval(intervalId);
  }, [isPaused, experiences]);

  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const isDesktop = window.innerWidth >= 768;
      const scrollAmount = isDesktop ? 432 : (window.innerWidth * 0.85) + 32; // Card width + gap
      const newScrollLeft =
        direction === "left"
          ? scrollContainerRef.current.scrollLeft - scrollAmount
          : scrollContainerRef.current.scrollLeft + scrollAmount;

      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  };

  return (
    <section
      id="experience"
      className="py-24 bg-white dark:bg-black relative overflow-hidden"
    >
      <div className="max-w-[85rem] mx-auto px-4 sm:px-6 lg:px-8 relative" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Professional Journey
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            My career path and the milestones I've achieved along the way.
          </p>
        </motion.div>

        {/* Navigation Buttons */}
        <div className="hidden md:flex justify-end gap-2 mb-4 px-4">
          <button
            onClick={() => scroll("left")}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-primary/10 hover:text-primary transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-primary/10 hover:text-primary transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Horizontal Timeline Container */}
        <div className="relative">
          {/* Gradient Masks */}
          <div className="absolute hidden md:block left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-black to-transparent z-10 pointer-events-none md:hidden"></div>
          <div className="absolute hidden md:block right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-black to-transparent z-10 pointer-events-none md:hidden"></div>

          <div
            ref={scrollContainerRef}
            className="flex flex-col sm:flex-row overflow-x-auto pb-12 pt-8 px-4 gap-8 snap-x snap-mandatory no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Horizontal Line (Visual only, positioned absolutely) */}
            <div className="absolute left-0 right-0 top-[88px] h-0.5 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent hidden md:block pointer-events-none"></div>

            {experiences?.map((exp: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex-shrink-0 w-[85vw] md:w-[400px] snap-center relative pt-8"
              >
                {/* Timeline Dot & Connector */}
                <div className="hidden md:flex flex-col items-center absolute left-1/2 -translate-x-1/2 top-[62px] z-10">
                  {/* Upper Connector */}
                  <div className="w-px h-[18px] bg-gradient-to-b from-primary/10 to-primary/50"></div>
                  {/* Dot */}
                  <div className="w-4 h-4 rounded-full bg-primary border-4 border-white dark:border-black shadow-sm ring-2 ring-primary/20 z-20"></div>
                  {/* Lower Connector */}
                  <div className="w-px h-[18px] bg-gradient-to-b from-primary/50 to-primary/10"></div>
                </div>

                <div className="flex flex-col h-full">
                  {/* Date Badge - Positioned above line on desktop */}
                  <div className="mb-12 flex justify-start md:justify-center relative">
                    <Badge variant="secondary" className="bg-white dark:bg-gray-900 text-primary border border-primary/20 px-4 py-1.5 rounded-full text-sm font-medium shadow-sm z-20">
                      <Calendar className="w-3.5 h-3.5 mr-2" />
                      {exp.period}
                    </Badge>
                  </div>

                  {/* Card Content */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-none hover:border-primary/30 transition-all duration-300 h-full flex flex-col group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
                          {exp.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                          {exp.company}
                        </p>
                      </div>
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6 line-clamp-4 flex-grow">
                      {exp.description}
                    </p>

                    {exp.achievements && exp.achievements.length > 0 && (
                      <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3 text-primary" /> Key Achievements
                        </h4>
                        <ul className="space-y-1.5">
                          {exp.achievements.slice(0, 3).map((achievement: any, i: number) => (
                            <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                              <span className="line-clamp-2">{achievement}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-gray-50 dark:border-gray-800">
                      <div className="flex flex-wrap gap-2">
                        {exp.technologies.map((tech: any, i: number) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-primary/5 text-primary border border-primary/10"
                          >
                            {tech}
                          </span>
                        ))}
                        {/* {exp.technologies?.length > 3 && (
                          <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-gray-50 dark:bg-gray-900 text-gray-400 border border-gray-100 dark:border-gray-800">
                            +{exp.technologies.length - 3}
                          </span>
                        )} */}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
