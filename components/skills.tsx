"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePersonalStore } from "@/lib/zutand";
import { Cpu, Globe, Database, Server, Layout, Terminal, Code2, Smartphone, Cloud } from "lucide-react";

export function Skills() {
    const [skillDetails, setSkillDetails] = useState<any>(null);
    const { value } = usePersonalStore();

    useEffect(() => {
        if (value && Object.keys(value).length > 0) {
            setSkillDetails(value?.skils[0] || null);
        }
    }, [value]);

    const [ref, inView] = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const [activeTab, setActiveTab] = useState("frontend");

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
            },
        },
    };

    const item = {
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0 },
    };

    const getIconForCategory = (category: string) => {
        switch (category.toLowerCase()) {
            case "frontend":
                return <Layout className="w-5 h-5" />;
            case "backend":
                return <Server className="w-5 h-5" />;
            case "database":
                return <Database className="w-5 h-5" />;
            case "devops":
                return <Terminal className="w-5 h-5" />;
            case "mobile":
                return <Smartphone className="w-5 h-5" />;
            case "cloud":
                return <Cloud className="w-5 h-5" />;
            default:
                return <Code2 className="w-5 h-5" />;
        }
    };

    return (
        <section
            id="skills"
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
                        Technical Arsenal
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        My command center of technologies, organized by domain.
                    </p>
                </motion.div>

                <div className="flex flex-col md:flex-row gap-8 md:gap-12">
                    <Tabs
                        defaultValue="frontend"
                        value={activeTab}
                        onValueChange={setActiveTab}
                        orientation="vertical"
                        className="w-full flex flex-col md:flex-row gap-8"
                    >
                        {/* Vertical Tab List */}
                        <div className="w-full md:w-72 flex-shrink-0">
                            <TabsList className="flex flex-row md:flex-col h-auto bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm p-2 gap-2 w-full overflow-x-auto md:overflow-visible no-scrollbar rounded-2xl border border-gray-100 dark:border-gray-800 sticky top-24">
                                {["frontend", "backend", "database", "devops"].map((tab) => (
                                    <TabsTrigger
                                        key={tab}
                                        value={tab}
                                        className="w-full justify-start px-6 py-4 rounded-xl text-left font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                        <div className="flex items-center gap-3">
                                            {getIconForCategory(tab)}
                                            <span className="capitalize text-base">{tab}</span>
                                        </div>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 min-h-[400px]">
                            {skillDetails &&
                                Object.entries(skillDetails).map(([category, skills]: any) => {
                                    if (category === "_id") return null;

                                    return (
                                        <TabsContent key={category} value={category} className="mt-0 focus-visible:outline-none">
                                            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none">
                                                <div className="mb-8 flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white capitalize flex items-center gap-3">
                                                            {getIconForCategory(category)}
                                                            {category} Development
                                                        </h3>
                                                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                                                            Technologies I use to build robust {category} solutions.
                                                        </p>
                                                    </div>
                                                </div>

                                                <motion.div
                                                    variants={container}
                                                    initial="hidden"
                                                    animate={activeTab === category ? "show" : "hidden"}
                                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                                                >
                                                    {skills?.map((skill: any, index: number) => (
                                                        <motion.div key={skill.name} variants={item}>
                                                            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-transparent hover:border-primary/20 hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg transition-all duration-300 cursor-default">
                                                                <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center text-primary shadow-sm group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-300">
                                                                    {getIconForCategory(category)}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                                                                            {skill.name}
                                                                        </h4>
                                                                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                                            {skill.level}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                        <motion.div
                                                                            initial={{ width: 0 }}
                                                                            animate={{ width: `${skill.level}%` }}
                                                                            transition={{ duration: 1, delay: 0.2 }}
                                                                            className="h-full bg-gradient-to-r from-primary to-purple-600 rounded-full"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </motion.div>
                                            </div>
                                        </TabsContent>
                                    );
                                })}
                        </div>
                    </Tabs>
                </div>
            </div>
        </section>
    );
}
