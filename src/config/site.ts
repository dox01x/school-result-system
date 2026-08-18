export const siteConfig = {
  name: "EduPulse Pro",
  shortName: "EduPulse",
  description: "Modern, unified school management platform for results, attendance, finance, and academic administration.",
  url: "https://edupulse.example.com",
  ogImage: "/logos/logo.png",
  links: {
    github: "https://github.com",
    docs: "/docs",
  },
  contact: {
    email: "support@edupulse.example.com",
    phone: "+880 1700-000000",
    address: "Dhaka, Bangladesh",
  },
  academic: {
    currentYear: "2026",
    currency: "BDT",
    currencySymbol: "৳",
  },
};

export type SiteConfig = typeof siteConfig;
