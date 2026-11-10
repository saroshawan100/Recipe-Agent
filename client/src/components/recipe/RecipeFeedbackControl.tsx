import { CircleHelp, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useRecipeFeedback, useSaveRecipeFeedback } from "@/api/hooks";
import type { RecipeFeedbackRating } from "@/api/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RecipeFeedbackControl({ recipeId, afterCook = false }: { recipeId: string; afterCook?: boolean }) {
  const feedback = useRecipeFeedback(recipeId);
  const save = useSaveRecipeFeedback();
  const current = feedback.data;

  const choose = (tried: boolean, rating: RecipeFeedbackRating) =>
    save.mutate(
      { id: recipeId, tried, rating },
      {
        onSuccess: () => toast.success("Preference saved", { description: "Future recipe ideas will take this into account." }),
        onError: (error) => toast.error("Couldn't save your feedback", { description: error.message }),
      },
    );

  return (
    <section className="rounded-2xl border border-line bg-surface/60 p-4" aria-label="Recipe feedback">
      <div className="font-semibold">{afterCook ? "Would you make this again?" : "Help personalize future recipes"}</div>
      <p className="mt-1 text-sm text-muted">
        {afterCook ? "Your answer helps Pantry Chef learn what works for you." : "Tell Pantry Chef if this recipe interests you."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {afterCook ? (
          <>
            <Button
              size="sm"
              variant={current?.tried && current.rating === "liked" ? "herb" : "outline"}
              aria-pressed={current?.tried === true && current.rating === "liked"}
              disabled={save.isPending}
              onClick={() => choose(true, "liked")}
            >
              <ThumbsUp className="h-4 w-4" /> Yes, make it again
            </Button>
            <Button
              size="sm"
              variant={current?.tried && current.rating === "notForMe" ? "danger" : "outline"}
              aria-pressed={current?.tried === true && current.rating === "notForMe"}
              disabled={save.isPending}
              onClick={() => choose(true, "notForMe")}
            >
              <ThumbsDown className="h-4 w-4" /> No, not for me
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant={!current?.tried && !current?.rating ? "secondary" : "outline"}
              aria-pressed={!current?.tried && !current?.rating}
              disabled={save.isPending}
              onClick={() => choose(false, null)}
            >
              <CircleHelp className="h-4 w-4" /> Haven't tried it
            </Button>
            <Button
              size="sm"
              variant={current?.rating === "liked" ? "herb" : "outline"}
              aria-pressed={current?.rating === "liked"}
              disabled={save.isPending}
              onClick={() => choose(current?.tried ?? false, "liked")}
            >
              <ThumbsUp className="h-4 w-4" /> I like this
            </Button>
            <Button
              size="sm"
              variant={current?.rating === "notForMe" ? "danger" : "outline"}
              aria-pressed={current?.rating === "notForMe"}
              disabled={save.isPending}
              onClick={() => choose(current?.tried ?? false, "notForMe")}
            >
              <ThumbsDown className="h-4 w-4" /> Not for me
            </Button>
          </>
        )}
      </div>
      {current?.tried && current.rating && (
        <p className={cn("mt-2 text-xs", current.rating === "liked" ? "text-herb-600 dark:text-herb-300" : "text-tomato-600 dark:text-tomato-300")}>
          Marked as cooked · {current.rating === "liked" ? "you'd make it again" : "not for you"}
        </p>
      )}
    </section>
  );
}
