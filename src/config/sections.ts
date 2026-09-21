/**
 * Content for the sections the nav links point at.
 *
 * The project entries are placeholders on purpose - swap in real ones rather
 * than shipping invented work. Everything here is plain data; no component
 * needs touching to edit it.
 */

export const SECTIONS = {
  about: {
    id: "about",
    title: "About",
    body: [
      "Developer, designer, and curious builder exploring software, agentic AI, blockchain, and digital experiences.",
      "Shubh Jadiya likes turning interesting ideas into things you can actually use.",
    ],
  },

  work: {
    id: "work",
    title: "Work",
    // TODO: replace with real projects.
    items: [
      { name: "Project one", note: "Add a one-line description.", href: "#work" },
      { name: "Project two", note: "Add a one-line description.", href: "#work" },
      { name: "Project three", note: "Add a one-line description.", href: "#work" },
    ],
  },

  services: {
    id: "services",
    title: "Services",
    items: [
      { name: "Product & web development", note: "Full-stack builds, from idea to shipped." },
      { name: "Agentic AI", note: "Agents, tooling, and LLM-backed workflows." },
      { name: "Blockchain", note: "Contracts, integrations, and on-chain apps." },
      { name: "Design", note: "Interface and interaction design for the above." },
    ],
  },

  contact: {
    id: "contact",
    title: "Contact",
    // TODO: set a real address and handles.
    email: "hello@example.com",
    socials: [
      { label: "GitHub", href: "https://github.com/333shubh" },
      { label: "X", href: "#contact" },
      { label: "LinkedIn", href: "#contact" },
    ],
  },
} as const;
