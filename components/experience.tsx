"use client"

import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Briefcase } from "lucide-react"

export function Experience() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const experiences = [
    {
      title: "Senior Full Stack Developer",
      company: "Tech Solutions Inc.",
      location: "Remote",
      period: "2022 - Present",
      description:
        "Led development of scalable web applications using React, Node.js, and cloud technologies. Implemented DevOps practices and mentored junior developers.",
      achievements: [
        "Reduced application load time by 40% through optimization",
        "Implemented CI/CD pipeline reducing deployment time by 60%",
        "Led a team of 5 developers on multiple projects",
        "Migrated legacy systems to modern tech stack",
      ],
      technologies: ["React", "Node.js", "PostgreSQL", "AWS", "Docker", "TypeScript"],
    },
    {
      title: "Full Stack Developer",
      company: "Digital Innovations Ltd.",
      location: "New York, NY",
      period: "2021 - 2022",
      description:
        "Developed and maintained multiple client projects using MERN stack. Collaborated with design and product teams to deliver high-quality solutions.",
      achievements: [
        "Built 15+ responsive web applications",
        "Improved database query performance by 35%",
        "Integrated third-party APIs and payment systems",
        "Maintained 99.9% uptime for production applications",
      ],
      technologies: ["React", "Express.js", "MongoDB", "Node.js", "JavaScript", "CSS"],
    },
    {
      title: "Frontend Developer",
      company: "StartupXYZ",
      location: "San Francisco, CA",
      period: "2020 - 2021",
      description:
        "Focused on frontend development using React and modern JavaScript. Worked closely with UX/UI designers to create intuitive user interfaces.",
      achievements: [
        "Developed responsive UI components library",
        "Increased user engagement by 25%",
        "Implemented real-time features using WebSocket",
        "Optimized bundle size reducing load time by 30%",
      ],
      technologies: ["React", "JavaScript", "HTML", "CSS", "Redux", "Webpack"],
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  }

  return (
    <section id="experience" className="py-20 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Work Experience</h2>
          <div className="w-20 h-1.5 bg-gradient-to-r from-blue-600 to-violet-600 mx-auto mb-8 rounded-full"></div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            My professional journey and the impact I've made at various organizations
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="relative"
        >
          {/* Timeline line */}
          <div className="absolute left-0 md:left-1/2 transform md:-translate-x-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 to-violet-600 hidden md:block"></div>

          {experiences.map((exp, index) => (
            <motion.div key={index} variants={itemVariants} className="mb-12 relative">
              <div className={`flex flex-col md:flex-row items-center ${index % 2 === 0 ? "md:flex-row-reverse" : ""}`}>
                {/* Timeline dot */}
                <div className="absolute left-0 md:left-1/2 transform md:-translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 z-10 hidden md:block"></div>

                {/* Content */}
                <div className="md:w-1/2 md:px-10">
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white dark:bg-gray-900 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-blue-600 to-violet-600"></div>
                    <CardContent className="p-6">
                      <div className="flex items-center mb-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-4">
                          <Briefcase className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{exp.title}</h3>
                          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{exp.company}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 mb-4">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                          <Calendar className="h-4 w-4 mr-2" />
                          {exp.period}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                          <MapPin className="h-4 w-4 mr-2" />
                          {exp.location}
                        </div>
                      </div>

                      <p className="text-gray-600 dark:text-gray-300 mb-4">{exp.description}</p>

                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Key Achievements:</h4>
                        <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                          {exp.achievements.map((achievement, achIndex) => (
                            <li key={achIndex} className="flex items-start">
                              <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                              {achievement}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Technologies Used:</h4>
                        <div className="flex flex-wrap gap-2">
                          {exp.technologies.map((tech, techIndex) => (
                            <Badge
                              key={techIndex}
                              className="bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
