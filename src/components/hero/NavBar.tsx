"use client";

import { useEffect, useRef, useState } from "react";
import { NAV } from "@/config/nav";

/**
 * Site navigation.
 *
 * Measured off the reference at 1536px: two *independent* fixed groups, not
 * one bar with space-between - left at `left: 4px`, right at `right: 4px`,
 * both `top: 4px`, 4px between pills, z-index 9. Each pill is 26px tall,
 * 8px/12px padding, a 100px radius, #f1f1f1, and 12.8px/600 type at
 * -0.384px tracking in #252525. Hover inverts the pill to black on white.
 *
 * The "+" expands the extra pills *inline*, to its own left, and flips to a
 * "−". The section links after it never move, which is the detail that
 * makes the reveal read as the bar growing rather than as a menu opening.
 */
export default function NavBar() {
  const [open, setOpen] = useState(false);
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
      <div className="nav__group nav__group--left">
        <a href="#top" className="nav__pill nav__pill--brand">
          {NAV.brand}
        </a>
        <span className="nav__pill nav__pill--status">{NAV.status}</span>
      </div>

      <div className="nav__group nav__group--right">
        {/*
          Width animates with a 0fr -> 1fr grid track rather than a fixed
          max-width, so the reveal is exactly as wide as its contents at any
          font size or zoom level.
        */}
        <div
          className={open ? "nav__reveal nav__reveal--open" : "nav__reveal"}
          id="nav-resume"
          aria-hidden={!open}
        >
          <div className="nav__reveal-inner">
            <a
              className="nav__pill"
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
          className="nav__pill nav__pill--toggle"
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
              <a className="nav__pill" href={link.href}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
