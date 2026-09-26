import { motion } from "motion/react";

// Starter hero only — proves React + Tailwind + Motion are wired. The real landing page replaces this.
export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <motion.p
        className="text-sm font-medium tracking-[0.3em] text-accent uppercase"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Powered by AURIC
      </motion.p>
      <motion.h1
        className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
      >
        Hotel
      </motion.h1>
    </main>
  );
}
