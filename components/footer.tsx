"use client";
import { usePersonalStore } from "@/lib/zutand";
import { Github, Linkedin, Twitter, Mail, ArrowUp } from "lucide-react";

export function Footer() {
  const { value } = usePersonalStore();

  return (
    <footer className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-100/30 dark:bg-violet-900/10 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="">
            <p className="text-gray-600 dark:text-gray-400 max-w-md text-lg">
              Full Stack Developer & DevOps Engineer with{" "}
              {value?.personalData[0]?.experience || ""} years of experience
              building modern web applications.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end">
            <div className="flex space-x-5">
              <a
                href={
                  value?.personalData[0]?.git_hub ||
                  "https://github.com/Raishmomin"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-md hover:shadow-lg"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href={
                  value?.personalData[0]?.linkdin ||
                  "https://www.linkedin.com/in/raish-momin-ba8927253?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-md hover:shadow-lg"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href={"mailto:" + value?.personalData[0]?.email}
                className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-md hover:shadow-lg"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 mt-10 pt-10 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-600 dark:text-gray-400 text-base">
            © {new Date().getFullYear()} Raish Momin. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
