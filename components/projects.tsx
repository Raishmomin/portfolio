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
    Code2,
    Layers,
    Database,
    LayoutTemplate,
    ArrowUpRight,
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
            : projects?.filter(
                (project: any) =>
                    Array.isArray(project?.category) &&
                    project.category.includes(activeTab)
            );

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const item = {
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    return (
        <section
            id="projects"
            className="py-24 bg-gray-50 dark:bg-black/50 relative overflow-hidden"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative" ref={ref}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
                        Featured Work
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        A selection of projects that showcase my passion for building exceptional digital experiences.
                    </p>
                </motion.div>

                <div className="flex justify-center mb-12">
                    <Tabs
                        defaultValue="all"
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="w-full max-w-3xl"
                    >
                        <TabsList className="w-full grid grid-cols-3 sm:grid-cols-5 bg-white dark:bg-gray-900 p-1 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm h-auto">
                            {[
                                { value: "all", label: "All" },
                                { value: "frontend", label: "Frontend" },
                                { value: "backend", label: "Backend" },
                                { value: "fullstack", label: "Full Stack" },
                                { value: "devops", label: "DevOps" },
                            ].map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="rounded-full py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-white"
                                >
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>

                <motion.div
                    variants={container}
                    initial="hidden"
                    animate={inView ? "show" : "hidden"}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {filteredProjects?.map((project: any, index: number) => (
                        <motion.div key={index} variants={item}>
                            <Card className="h-full border-0 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 overflow-hidden group flex flex-col rounded-3xl relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                <CardContent className="p-8 flex-1 flex flex-col relative z-10">
                                    <div className="mb-6">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1">
                                                {project.title}
                                            </h3>
                                            <div className="p-2 rounded-full bg-primary/10 text-primary">
                                                <Layers className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed line-clamp-3 mb-6">
                                            {project.description}
                                        </p>

                                        {/* Features Section */}
                                        {project.features && project.features.length > 0 && (
                                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                                                <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                                                    <Database className="w-3 h-3 text-primary" /> Key Features
                                                </h4>
                                                <ul className="space-y-2">
                                                    {project.features.slice(0, 3).map((feature: any, i: number) => (
                                                        <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0 shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
                                                            <span className="line-clamp-1">{feature}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-auto space-y-6">
                                        <div className="flex flex-wrap gap-2">
                                            {project.technologies.slice(0, 3).map((tech: any, i: number) => (
                                                <Badge
                                                    key={i}
                                                    variant="secondary"
                                                    className="bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700 hover:border-primary/30 hover:text-primary transition-colors px-3 py-1"
                                                >
                                                    {tech}
                                                </Badge>
                                            ))}
                                            {project.technologies.length > 3 && (
                                                <Badge variant="secondary" className="bg-gray-50 dark:bg-gray-900 text-gray-500 border border-gray-100 dark:border-gray-800">
                                                    +{project.technologies.length - 3}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                                            {project.liveUrl ? (
                                                <Button
                                                    className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
                                                    onClick={() => window.open(project.liveUrl, "_blank")}
                                                >
                                                    <ExternalLink className="w-4 h-4 mr-2" /> Live Demo
                                                </Button>
                                            ) : <div className="h-10"></div>}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
