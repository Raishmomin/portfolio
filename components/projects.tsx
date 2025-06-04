"use client";

import { useState } from "react";
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

export function Projects() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const [activeTab, setActiveTab] = useState("all");

  const projects = [
    {
      title: "E-Commerce Platform",
      description:
        "Full-stack e-commerce solution with payment integration, inventory management, and admin dashboard. Built with React, Node.js, and PostgreSQL.",
      image: "/placeholder.svg?height=300&width=600",
      technologies: ["React", "Node.js", "PostgreSQL", "Stripe", "Docker"],
      category: "fullstack",
      features: [
        "User authentication and authorization",
        "Shopping cart and checkout process",
        "Payment integration with Stripe",
        "Admin dashboard for inventory management",
        "Responsive design for all devices",
      ],
      liveUrl: "https://example.com",
      githubUrl: "https://github.com/username/project",
    },
    {
      title: "Task Management App",
      description:
        "Collaborative task management application with real-time updates, team collaboration features, and project tracking capabilities.",
      image: "/placeholder.svg?height=300&width=600",
      technologies: ["React", "Express.js", "MongoDB", "Socket.io", "AWS"],
      category: "fullstack",
      features: [
        "Real-time collaboration with Socket.io",
        "Drag and drop task management",
        "Team member invitation system",
        "File upload and sharing",
        "Progress tracking and analytics",
      ],
      liveUrl: "https://example.com",
      githubUrl: "https://github.com/username/project",
    },
    {
      title: "Analytics Dashboard",
      description:
        "Business intelligence dashboard with data visualization, reporting features, and real-time metrics for business decision making.",
      image: "/placeholder.svg?height=300&width=600",
      technologies: ["React", "Node.js", "PostgreSQL", "Chart.js", "Redis"],
      category: "frontend",
      features: [
        "Interactive data visualizations",
        "Custom report generation",
        "Real-time data updates",
        "User role-based access control",
        "Export functionality for reports",
      ],
      liveUrl: "https://example.com",
      githubUrl: "https://github.com/username/project",
    },
    {
      title: "DevOps Automation Tool",
      description:
        "CI/CD pipeline automation tool that streamlines deployment processes and infrastructure management for development teams.",
      image: "/placeholder.svg?height=300&width=600",
      technologies: ["Node.js", "Docker", "AWS", "Jenkins", "Terraform"],
      category: "devops",
      features: [
        "Automated deployment pipelines",
        "Infrastructure as Code",
        "Container orchestration",
        "Monitoring and alerting",
        "Multi-environment support",
      ],
      liveUrl: "https://example.com",
      githubUrl: "https://github.com/username/project",
    },
    {
      title: "Real-time Chat Application",
      description:
        "Feature-rich chat application with real-time messaging, file sharing, and user presence indicators.",
      image: "/placeholder.svg?height=300&width=600",
      technologies: ["React", "Node.js", "Socket.io", "MongoDB", "AWS S3"],
      category: "fullstack",
      features: [
        "Real-time messaging",
        "File and image sharing",
        "User presence indicators",
        "Message read receipts",
        "Push notifications",
      ],
      liveUrl: "https://example.com",
      githubUrl: "https://github.com/username/project",
    },
    {
      title: "API Gateway Service",
      description:
        "Microservice-based API gateway that handles authentication, rate limiting, and request routing for a distributed system.",
      image: "/placeholder.svg?height=300&width=600",
      technologies: ["Node.js", "Express", "Redis", "JWT", "Docker"],
      category: "backend",
      features: [
        "Authentication and authorization",
        "Rate limiting and throttling",
        "Request routing and load balancing",
        "API documentation with Swagger",
        "Monitoring and logging",
      ],
      liveUrl: "https://example.com",
      githubUrl: "https://github.com/username/project",
    },
  ];

  const filteredProjects =
    activeTab === "all"
      ? projects
      : projects.filter((project) => project.category === activeTab);

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
      className="py-24 bg-gray-50 dark:bg-gray-900 relative overflow-hidden"
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
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Featured Projects
          </h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-blue-600 to-violet-600 mx-auto mb-8 rounded-full"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
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
              <TabsList className="bg-white dark:bg-gray-800 -p-2 rounded-xl shadow-lg">
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
          {filteredProjects.map((project, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="h-full border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 overflow-hidden group bg-white dark:bg-gray-950 rounded-3xl">
                <div className="relative overflow-hidden">
                  <div className="aspect-video bg-gray-200 dark:bg-gray-800 overflow-hidden">
                    <img
                      src={project.image || "/placeholder.svg"}
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
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
                      {project.technologies.map((tech, techIndex) => (
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

                  <div className="flex gap-4 mt-8">
                    <Button
                      className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-xl py-6"
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
                    <Button
                      variant="outline"
                      asChild
                      className="flex-1 rounded-xl py-6 border-2"
                    >
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Github className="h-5 w-5 mr-2" />
                        Source
                      </a>
                    </Button>
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
