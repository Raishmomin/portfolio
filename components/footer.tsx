"use client";
import { usePersonalStore } from "@/lib/zutand";
import { Github, Linkedin, Twitter, Mail, ArrowUp } from "lucide-react";

export function Footer() {
  const { value } = usePersonalStore();

  const socialLinks = [
    {
      icon: Github,
      href: value?.personalData[0]?.git_hub || "https://github.com/Raishmomin",
      label: "GitHub",
    },
    {
      icon: Linkedin,
      href: value?.personalData[0]?.linkdin || "https://linkedin.com",
      label: "LinkedIn",
    },
    {
      icon: Mail,
      href: `mailto:${value?.personalData[0]?.email}`,
      label: "Email",
    },
  ];

  return (
    <footer className="bg-white dark:bg-black border-t border-gray-100 dark:border-gray-800 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Raish Momin
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Building digital experiences with passion and precision.
            </p>
          </div>

          <div className="flex items-center gap-6">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-primary transition-colors hover:scale-110 transform duration-200"
                aria-label={social.label}
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            © {new Date().getFullYear()} Raish Momin. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
