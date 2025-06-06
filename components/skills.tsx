"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePersonalStore } from "@/lib/zutand";

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

  const getSkillColor = (level: number) => {
    if (level >= 90) return "bg-gradient-to-r from-emerald-500 to-green-500";
    if (level >= 80) return "bg-gradient-to-r from-blue-500 to-indigo-500";
    if (level >= 70) return "bg-gradient-to-r from-violet-500 to-purple-500";
    return "bg-gradient-to-r from-amber-500 to-orange-500";
  };

  const skillVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.05 * i,
        duration: 0.5,
      },
    }),
  };

  return (
    <section
      id="skills"
      className="sm:py-24 py-10 bg-gray-50 dark:bg-gray-900 relative overflow-hidden"
    >
      {/* Background decorative elements */}
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-blue-100/50 dark:bg-blue-900/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-violet-100/50 dark:bg-violet-900/10 rounded-full blur-3xl"></div>

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
            Skills & Expertise
          </h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-blue-600 to-violet-600 mx-auto mb-8 rounded-full"></div>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Here are the technologies and tools I've mastered over my {value?.personalData[0]?.experience || ""} years
            of experience
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <Tabs
            defaultValue="frontend"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full flex-wrap"
          >
            <div className="flex justify-center mb-12">
              <TabsList className="bg-white dark:bg-gray-800 -p-2 h-24 sm:h-14  rounded-xl shadow-lg grid grid-cols-2 sm:grid-cols-4">
                <TabsTrigger
                  value="frontend"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl px-8 py-2 text-base"
                >
                  Frontend
                </TabsTrigger>
                <TabsTrigger
                  value="backend"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl px-8 py-2 text-base"
                >
                  Backend
                </TabsTrigger>
                <TabsTrigger
                  value="database"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl px-8 py-2 text-base"
                >
                  Database
                </TabsTrigger>
                <TabsTrigger
                  value="devops"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl px-8 py-2 text-base"
                >
                  DevOps
                </TabsTrigger>
              </TabsList>
            </div>

            {skillDetails &&
              Object.entries(skillDetails).map(([category, skills]: any) => (
                <TabsContent key={category} value={category} className="mt-0">
                  <Card className="border-0 shadow-2xl bg-white dark:bg-gray-950 overflow-hidden rounded-3xl">
                    <div className="h-2 bg-gradient-to-r from-blue-600 to-violet-600"></div>
                    <CardContent className="p-8 md:p-12">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {category != "_id" &&
                          skills?.map((skill: any, index: any) => (
                            <motion.div
                              key={skill.name}
                              custom={index}
                              variants={skillVariants}
                              initial="hidden"
                              animate={
                                inView && activeTab === category
                                  ? "visible"
                                  : "hidden"
                              }
                              className="flex items-center gap-6"
                            >
                              {/* <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 shadow-md">
                            <img
                              src={skill.icon || "/placeholder.svg"}
                              alt={skill.name}
                              className="w-8 h-8"
                            /> 
                          </div>  */}
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-3">
                                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                                    {skill.name}
                                  </span>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                                    {skill.level}%
                                  </span>
                                </div>
                                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${skill.level}%` }}
                                    transition={{
                                      duration: 1,
                                      delay: 0.1 * index,
                                    }}
                                    className={`h-full ${getSkillColor(
                                      skill.level
                                    )} rounded-full shadow-lg`}
                                  ></motion.div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
          </Tabs>
        </motion.div>
      </div>
    </section>
  );
}
