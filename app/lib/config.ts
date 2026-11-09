import { PROFILE, experienceLabel } from "./profile";

export const SITE_URL = "https://raish-momin.vercel.app";

export const SITE = {
  name: "Raish Momin",
  title: "Raish Momin — Full Stack Developer & DevOps Engineer",
  // A getter, so the derived years figure is current on every render (it changes
  // each September) instead of being fixed when the module first loads.
  get description() {
    return `Full-stack developer with ${experienceLabel()} years building production React, Node.js, and cloud infrastructure. Open to ${PROFILE.availability}.`;
  },
  jobTitle: "Full Stack Developer & DevOps Engineer",
  email: PROFILE.email,
  twitter: PROFILE.social.xHandle,
  github: PROFILE.social.github,
  linkedin: PROFILE.social.linkedin,
  locale: "en_US",
  themeColor: { light: "#F5F3EE", dark: "#0E0F11" },
} as const;

export const NAV_SECTIONS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
] as const;

export const PAGES = [
  { path: "/", label: "Home" },
  { path: "/about", label: "About" },
  { path: "/services", label: "Services" },
  { path: "/projects", label: "Projects" },
  { path: "/experience", label: "Experience" },
  { path: "/skills", label: "Skills" },
  { path: "/blog", label: "Blog" },
  { path: "/contact", label: "Contact" },
] as const;
