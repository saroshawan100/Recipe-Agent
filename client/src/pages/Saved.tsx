import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useSaved } from "@/api/hooks";
import { RecipeCard, RecipeCardSkeleton } from "@/components/recipe/RecipeCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

export function Saved() {
  const { data, isLoading, isError, error } = useSaved();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold">Saved recipes</h1>
        <p className="mt-1 text-muted">Your favorites, ready to cook again.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <Card className="p-8 text-center text-muted">{error.message}</Card>
      ) : !data?.length ? (
        <Card className="p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-tomato-400" />
          <h2 className="mt-4 text-2xl font-semibold">No saved recipes yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted">Tap the heart on any recipe to keep it here.</p>
          <Link to="/" className="mt-6 inline-block">
            <Button>Find something to cook</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {data.map((r, i) => (
            <RecipeCard key={r.id} recipe={r} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
