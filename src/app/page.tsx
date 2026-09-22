import Hero from "@/components/hero/Hero";
import NavBar from "@/components/hero/NavBar";
import SelectedWork from "@/components/work/SelectedWork";
import Sections from "@/components/sections/Sections";

/**
 * Page order: landing, selected work, about, contact.
 *
 * The nav is a sibling of the hero rather than a child of it. It is pinned
 * to the viewport for the whole page, and nesting it inside the hero - which
 * is itself pinned and then covered - would take it out of view along with
 * everything else in that layer.
 */
export default function Home() {
  return (
    <main>
      <NavBar />
      <Hero />
      <SelectedWork />
      <Sections />
    </main>
  );
}
