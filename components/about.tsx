"use client"

import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"
import { Card, CardContent } from "@/components/ui/card"
import { Code, Database, Server, Cloud, Zap, Users } from "lucide-react"

export function About() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

const highlights = [
    {
      icon: Code,
      title: "Frontend Development",
      description: "Expert in React, TypeScript, and modern frontend frameworks",
    },
    {
      icon: Server,
      title: "Backend Development",
      description: "Proficient in Node.js, Express, and RESTful API development",
    },
    {
      icon: Database,
      title: "Database Management",
      description: "Experienced with MongoDB, PostgreSQL, and database optimization",
    },
    {
      icon: Cloud,
      title: "DevOps & Cloud",
      description: "Skilled in CI/CD, Docker, AWS, and infrastructure automation",
    },
  ]

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.1 * i,
        duration: 0.5,
      },
    }),
  }

  return (
    <section id="about" className="py-24 bg-white dark:bg-gray-950 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-gray-50 to-transparent dark:from-gray-900 dark:to-transparent"></div>
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-100 dark:bg-violet-900/20 rounded-full blur-3xl opacity-50"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">About Me</h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-blue-600 to-violet-600 mx-auto mb-8 rounded-full"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            I'm a passionate Full Stack Developer with over 4 years of experience creating robust, scalable web
            applications. I love turning complex problems into simple, beautiful, and intuitive solutions.
          </p>
          
        </motion.div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {highlights.map((item, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <item.icon className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <div className="bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 rounded-3xl p-10 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">My Journey</h3>
                <div className="w-20 h-1.5 bg-gradient-to-r from-blue-600 to-violet-600 mb-8 rounded-full"></div>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  Started my development journey 4+ years ago with a passion for creating digital solutions. I've worked
                  on various projects ranging from small business websites to large-scale enterprise applications.
                </p>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  Recently expanded my skill set to include DevOps practices, enabling me to handle the complete
                  software development lifecycle from development to deployment and monitoring.
                </p>
                <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                  I'm always eager to learn new technologies and take on challenging projects that push the boundaries
                  of what's possible.
                </p>
              </div>
              <div className="space-y-8">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-lg">Experience</span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                      4+ Years
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full w-[80%] bg-gradient-to-r from-blue-600 to-violet-600 rounded-full"></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-lg">Projects Completed</span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                      50+
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full w-[75%] bg-gradient-to-r from-blue-600 to-violet-600 rounded-full"></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-lg">Client Satisfaction</span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                      100%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-blue-600 to-violet-600 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
