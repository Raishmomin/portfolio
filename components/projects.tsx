"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ExternalLink,
  Github,
  Code,
  Monitor,
  Database,
  Server,
} from "lucide-react";
import { usePersonalStore } from "@/lib/zutand";

export function Projects() {
  const [projects, setProjects] = useState<any>(null);
  const { value } = usePersonalStore();
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (value && Object.keys(value).length > 0) {
      setProjects(value?.projects || null);
    }
  }, [value]);

  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const filteredProjects =
    activeTab === "all"
      ? projects
      : projects?.filter((project: any) => project?.category === activeTab);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "frontend":
        return <Monitor className="h-4 w-4" />;
      case "backend":
        return <Server className="h-4 w-4" />;
      case "fullstack":
        return <Code className="h-4 w-4" />;
      case "devops":
        return <Database className="h-4 w-4" />;
      default:
        return <Code className="h-4 w-4" />;
    }
  };

  return (
    <section
      id="projects"
      className="sm:py-24 py-10 bg-gray-50 dark:bg-gray-900 relative overflow-hidden"
    >
      {/* Background decorative elements */}
      <div className="absolute top-40 right-0 w-96 h-96 bg-blue-100/50 dark:bg-blue-900/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 left-0 w-96 h-96 bg-violet-100/50 dark:bg-violet-900/10 rounded-full blur-3xl"></div>

      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative"
        ref={ref}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-20"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Featured Projects
          </h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-blue-600 to-violet-600 mx-auto mb-8 rounded-full"></div>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Here are some of the projects I've worked on that showcase my skills
            and experience
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mb-16"
        >
          <Tabs
            defaultValue="all"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div className="flex justify-center">
              <TabsList className="bg-white dark:bg-gray-800 -p-2 h-24 sm:h-14 rounded-xl shadow-lg grid grid-cols-3 sm:grid-cols-5">
                <TabsTrigger
                  value="all"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl px-6 py-2 text-base"
                >
                  All Projects
                </TabsTrigger>
                <TabsTrigger
                  value="frontend"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl px-6 py-2 text-base"
                >
                  Frontend
                </TabsTrigger>
                <TabsTrigger
                  value="backend"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl px-6 py-2 text-base"
                >
                  Backend
                </TabsTrigger>
                <TabsTrigger
                  value="fullstack"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl px-6 py-2.5 text-base"
                >
                  Full Stack
                </TabsTrigger>
                <TabsTrigger
                  value="devops"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl px-6 py-2 text-base"
                >
                  DevOps
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
        >
          {filteredProjects?.map((project: any, index: any) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="h-full border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 overflow-hidden group bg-white dark:bg-gray-950 rounded-3xl">
                <div className="relative overflow-hidden">
                  {/* <div className="aspect-video bg-gray-200 dark:bg-gray-800 overflow-hidden">
                    <img
                      src={project.image || "/placeholder.svg"}
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div> */}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-gradient-to-r from-blue-600 to-violet-600 text-white border-0 flex items-center gap-1 px-3 py-1.5 text-sm font-medium shadow-lg">
                      {getCategoryIcon(project.category)}
                      {project.category.charAt(0).toUpperCase() +
                        project.category.slice(1)}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {project.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {project.description}
                  </p>

                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                      Technologies:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {project.technologies.map((tech: any, techIndex: any) => (
                        <Badge
                          key={techIndex}
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 px-3 py-1"
                        >
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {project.liveUrl && (
                    <div className="flex justify-end gap-4 mt-8 w-full">
                      <Button
                        className="sm:w-1/2 w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-xl py-6"
                        asChild
                      >
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-5 w-5 mr-2" />
                          Live Demo
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
