import { Header } from "./sections/header";
import { Hero } from "./sections/hero";
import { About, Stats } from "./sections/about";
import { Rooms } from "./sections/rooms";
import { Gallery } from "./sections/gallery";
import { Services } from "./sections/services";
import { Blog } from "./sections/blog";
import { Footer } from "./sections/footer";

// Section order follows the Mellow design (Figma + its HTML build). Content: ./data.ts.
export function LandingPage() {
  return (
    <>
      <Header />
      <main className="overflow-x-clip">
        <Hero />
        <About />
        <Stats />
        <Rooms />
        <Gallery />
        <Services />
        <Blog />
      </main>
      <Footer />
    </>
  );
}
