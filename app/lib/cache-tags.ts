export const TAGS = {
  blogs: "blogs",
  blog: (slug: string) => `blog:${slug}`,
  projects: "projects",
  experience: "experience",
  skills: "skills",
  personal: "personal",
} as const;
