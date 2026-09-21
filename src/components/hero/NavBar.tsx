"use client";

import { useEffect, useRef, useState } from "react";
import { NAV } from "@/config/nav";

/**
 * Hero navigation.
 *
 * Brand and status on the left. On the right the "+" expands the resume
 * pills *inline*, to its own left, and flips to a "-" - the same mechanic as
 * the reference, rather than a dropdown panel. The section links sit after
 * the toggle and never move.
 */
export default function NavBar() {
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape closes it, the way a disclosure should.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav__left">
        <a href="#top" className="nav__brand">
          {NAV.brand}
        </a>
        <span className="nav__status">{NAV.status}</span>
      </div>

      <div className="nav__right">
        {/*
          Width is animated with a 0fr -> 1fr grid track rather than a fixed
          max-width, so the reveal is exactly as wide as its contents at any
          font size or zoom level.
        */}
        <div
          ref={groupRef}
          className={open ? "nav__reveal nav__reveal--open" : "nav__reveal"}
          id="nav-resume"
          aria-hidden={!open}
        >
          <div className="nav__reveal-inner">
            <a
              className="nav__link nav__link--accent"
              href={NAV.resume.href}
              target="_blank"
              rel="noreferrer"
              tabIndex={open ? 0 : -1}
            >
              {NAV.resume.label}
            </a>
          </div>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="nav__plus"
          aria-expanded={open}
          aria-controls="nav-resume"
          aria-label={open ? "Hide resume" : "Show resume"}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>

        <ul className="nav__links">
          {NAV.links.map((link) => (
            <li key={link.href}>
              <a className="nav__link" href={link.href}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
