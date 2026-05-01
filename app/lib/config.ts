export const SITE_URL = "https://raish-portfolio.vercel.app";

export const SITE = {
  name: "Raish Momin",
  title: "Raish Momin — Full Stack Developer & DevOps Engineer",
  description:
    "Full-stack developer with 4+ years building production React, Node.js, and cloud infrastructure. Open to senior engineering roles and freelance.",
  jobTitle: "Full Stack Developer & DevOps Engineer",
  email: "raishmomin@example.com",
  twitter: "@raishmomin",
  github: "https://github.com/Raishmomin",
  linkedin: "https://www.linkedin.com/in/raish-momin/",
  locale: "en_US",
  themeColor: { light: "#fafafa", dark: "#121214" },
} as const;

export const NAV_SECTIONS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
] as const;
