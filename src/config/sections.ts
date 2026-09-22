/**
 * Content for the sections the nav links point at.
 *
 * Selected Work is not here - it has its own presentation and lives in
 * `src/config/work.ts`. This file covers the plain-text sections that
 * follow it, in page order: About, then Contact.
 *
 * Everything here is data; no component needs touching to edit it.
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
