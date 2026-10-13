import { Fragment, useMemo } from "react";
import { Popover } from "@/components/ui/primitives";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Renders text with glossary terms underlined; tapping a term shows its beginner-friendly definition. */
export function GlossaryText({ text, glossary }: { text: string; glossary: { term: string; definition: string }[] }) {
  const parts = useMemo(() => {
    const terms = glossary.filter((g) => g.term.trim().length > 2).sort((a, b) => b.term.length - a.term.length);
    if (!terms.length) return [text];
    const re = new RegExp(`\\b(${terms.map((t) => escapeRe(t.term)).join("|")})\\b`, "gi");
    return text.split(re);
  }, [text, glossary]);

  const lookup = useMemo(() => new Map(glossary.map((g) => [g.term.toLowerCase(), g])), [glossary]);

  return (
    <>
      {parts.map((part, i) => {
        const entry = i % 2 === 1 ? lookup.get(part.toLowerCase()) : undefined;
        if (!entry) return <Fragment key={i}>{part}</Fragment>;
        return (
          <Popover
            key={i}
            trigger={
              <button className="cursor-help font-medium text-saffron-700 underline decoration-saffron-500/60 decoration-dotted decoration-2 underline-offset-4 hover:decoration-solid dark:text-saffron-300">
                {part}
              </button>
            }
          >
            <div className="text-xs font-semibold tracking-wider text-saffron-600 uppercase dark:text-saffron-300">{entry.term}</div>
            <p className="mt-1 leading-relaxed">{entry.definition}</p>
          </Popover>
        );
      })}
    </>
  );
}
