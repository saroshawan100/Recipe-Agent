import { useState } from "react";
import { cn } from "@/lib/utils";

/** Ingredient photo from TheMealDB, falling back to an emoji if it's missing or fails to load. */
export function IngredientImage({
  src,
  emoji,
  alt,
  className,
  emojiClassName,
}: {
  src: string | null | undefined;
  emoji?: string;
  alt: string;
  className?: string;
  emojiClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={cn("grid place-items-center leading-none", emojiClassName)} role="img" aria-label={alt}>
        {emoji ?? "🥄"}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn("object-contain drop-shadow-md", className)}
    />
  );
}
