import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat } from "lucide-react";

export function ChefThinking({ messages, className }: { messages: string[]; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % messages.length), 2200);
    return () => window.clearInterval(id);
  }, [messages.length]);

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-stone-950 shadow-lg shadow-saffron-500/30">
          <ChefHat className="h-6 w-6 animate-float" />
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl" />
        </span>
        <div className="relative h-6 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={i}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute font-medium"
            >
              {messages[i]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
