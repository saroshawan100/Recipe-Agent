import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, ChefHat, Clock, Flame, Gauge, Heart, Lightbulb, ListOrdered, PieChart, ShoppingCart, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAddRecipeToList, useRecipe, useRecipeDetails, useRecipeImage, useToggleSaved } from "@/api/hooks";
import { ChefThinking } from "@/components/kitchen/ChefThinking";
import { MacroBars } from "@/components/recipe/RecipeCard";
import { IngredientsTab, NutritionTab, StepsTab, TipsTab } from "@/components/recipe/RecipeTabs";
import { Button } from "@/components/ui/button";
import { Badge, Card, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { cn, formatMinutes, gradientFor } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useKitchenStore } from "@/store/useKitchenStore";

const WRITING = [
  "Writing your step-by-step instructions...",
  "Measuring out every ingredient...",
  "Adding beginner tips and doneness cues...",
  "Double-checking food-safety temps...",
  "Crunching the nutrition numbers...",
];

export function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const recipeQ = useRecipe(id);
  const recipe = recipeQ.data;
  const detailsQ = useRecipeDetails(id, !!recipe && !recipe.details);
  const imageQ = useRecipeImage(id, !!recipe && !recipe.imageUrl);
  const toggleSaved = useToggleSaved();
  const addToList = useAddRecipeToList();
  const patchResult = useKitchenStore((s) => s.patchResult);
  const setRecipeContext = useChatStore((s) => s.setRecipeContext);

  const details = recipe?.details ?? detailsQ.data?.details ?? null;
  const imageUrl = recipe?.imageUrl ?? imageQ.data?.imageUrl ?? null;
  const [servings, setServings] = useState<number | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const currentServings = servings ?? details?.servings ?? recipe?.servings ?? 2;

  const recipeId = recipe?.id;
  const recipeTitle = recipe?.card.title;
  useEffect(() => {
    if (recipeId && recipeTitle) setRecipeContext({ id: recipeId, title: recipeTitle });
    return () => setRecipeContext(null);
  }, [recipeId, recipeTitle, setRecipeContext]);

  useEffect(() => {
    if (id && imageQ.data?.imageUrl) patchResult(id, { imageUrl: imageQ.data.imageUrl });
  }, [id, imageQ.data?.imageUrl, patchResult]);

  const detailedCard = detailsQ.data?.card;
  useEffect(() => {
    if (id && detailedCard) patchResult(id, { macros: detailedCard.macros, totalMinutes: detailedCard.totalMinutes });
  }, [id, detailedCard, patchResult]);

  if (recipeQ.isError) {
    return (
      <div className="py-24 text-center">
        <div className="text-6xl">🥘</div>
        <h1 className="mt-4 text-2xl font-semibold">We couldn't find that recipe</h1>
        <p className="mt-2 text-muted">{recipeQ.error.message}</p>
        <Link to="/" className="mt-6 inline-block">
          <Button>Back to the kitchen</Button>
        </Link>
      </div>
    );
  }

  if (!recipe) return <DetailSkeleton />;
  const card = recipe.card;

  const onToggleSave = () =>
    toggleSaved.mutate(
      { id: recipe.id, saved: !recipe.saved },
      {
        onSuccess: ({ saved }) => {
          patchResult(recipe.id, { saved });
          toast.success(saved ? "Saved to your recipes" : "Removed from saved");
        },
        onError: (e) => toast.error(e.message),
      },
    );

  const onAddMissing = () =>
    addToList.mutate(
      { recipeId: recipe.id, scale: details ? currentServings / details.servings : 1 },
      {
        onSuccess: (data) =>
          toast.success(data.added ? `Added ${data.added} item${data.added === 1 ? "" : "s"} to your shopping list` : "Nothing to buy for this one!", {
            action: data.added ? { label: "View list", onClick: () => navigate("/shopping") } : undefined,
          }),
        onError: (e) => toast.error(e.message),
      },
    );

  const missingCount = details ? details.ingredients.filter((i) => !i.have && !i.optional).length : card.missingIngredients.length;

  return (
    <div className="space-y-8">
      <button onClick={() => navigate(-1)} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <section className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn("relative aspect-[3/2] overflow-hidden rounded-[2rem] bg-gradient-to-br shadow-2xl shadow-black/20", gradientFor(card.title))}
        >
          {imageUrl && (
            <img
              src={imageUrl}
              alt={card.title}
              onLoad={() => setImgLoaded(true)}
              className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", imgLoaded ? "opacity-100" : "opacity-0")}
            />
          )}
          {(!imageUrl || !imgLoaded) && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <span className="animate-float inline-block text-8xl drop-shadow-2xl sm:text-9xl">{card.emoji}</span>
                {imageQ.isFetching && <p className="mt-4 text-sm font-medium text-white/90 drop-shadow">Plating your dish for a photo...</p>}
              </div>
              {imageQ.isFetching && <div className="shimmer-bg absolute inset-0 animate-shimmer opacity-20" />}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="saffron">{card.cuisine}</Badge>
            {card.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
          <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">{card.title}</h1>
          <p className="text-lg leading-relaxed text-muted">{details?.intro ?? card.description}</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Clock className="h-4 w-4" />} label="Total" value={formatMinutes(details ? details.prepMinutes + details.cookMinutes : card.totalMinutes)} />
            <Stat icon={<Gauge className="h-4 w-4" />} label="Level" value={card.difficulty.charAt(0).toUpperCase() + card.difficulty.slice(1)} />
            <Stat icon={<Users className="h-4 w-4" />} label="Serves" value={String(currentServings)} />
            <Stat icon={<Flame className="h-4 w-4" />} label="Per serving" value={`${details?.nutrition.calories ?? card.macros.calories} kcal`} />
          </div>

          <MacroBars
            protein={details?.nutrition.protein ?? card.macros.protein}
            carbs={details?.nutrition.carbs ?? card.macros.carbs}
            fat={details?.nutrition.fat ?? card.macros.fat}
          />

          <div className="flex flex-wrap gap-3 pt-1">
            <Button size="lg" onClick={() => navigate(`/cook/${recipe.id}`)} disabled={!details} className="flex-1 sm:flex-none">
              <ChefHat className="h-5 w-5" /> Cook with the Chef
            </Button>
            <Button size="lg" variant="outline" onClick={onToggleSave} loading={toggleSaved.isPending} aria-pressed={recipe.saved}>
              {!toggleSaved.isPending && <Heart className={cn("h-5 w-5", recipe.saved && "fill-tomato-500 text-tomato-500")} />}
              {recipe.saved ? "Saved" : "Save"}
            </Button>
            {missingCount > 0 && (
              <Button size="lg" variant="outline" onClick={onAddMissing} loading={addToList.isPending}>
                {!addToList.isPending && <ShoppingCart className="h-5 w-5" />}
                Add {missingCount} to list
              </Button>
            )}
          </div>
        </motion.div>
      </section>

      {!details ? (
        detailsQ.isError ? (
          <Card className="p-8 text-center">
            <p className="font-semibold">The chef couldn't write this recipe.</p>
            <p className="mt-1 text-sm text-muted">{detailsQ.error.message}</p>
            <Button className="mt-4" onClick={() => detailsQ.refetch()}>
              Try again
            </Button>
          </Card>
        ) : (
          <Card className="space-y-6 p-6">
            <ChefThinking messages={WRITING} />
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </Card>
        )
      ) : (
        <Tabs defaultValue="ingredients" className="space-y-6">
          <TabsList className="w-fit max-w-full">
            <TabsTrigger value="ingredients">
              <ShoppingCart className="h-4 w-4" /> Ingredients
            </TabsTrigger>
            <TabsTrigger value="steps">
              <ListOrdered className="h-4 w-4" /> Steps ({details.steps.length})
            </TabsTrigger>
            <TabsTrigger value="nutrition">
              <PieChart className="h-4 w-4" /> Nutrition
            </TabsTrigger>
            <TabsTrigger value="tips">
              <Lightbulb className="h-4 w-4" /> Tips
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ingredients">
            <IngredientsTab details={details} servings={currentServings} onServingsChange={setServings} onAddMissing={onAddMissing} adding={addToList.isPending} />
          </TabsContent>
          <TabsContent value="steps">
            <StepsTab details={details} />
          </TabsContent>
          <TabsContent value="nutrition">
            <NutritionTab details={details} calorieTarget={recipe.calorieTarget} />
          </TabsContent>
          <TabsContent value="tips">
            <TipsTab details={details} />
          </TabsContent>
        </Tabs>
      )}

      {details && (
        <Card className="flex flex-col items-center gap-4 bg-gradient-to-br from-saffron-500/10 to-herb-500/10 p-8 text-center sm:flex-row sm:text-left">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-stone-950">
            <BookOpen className="h-7 w-7" />
          </span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold">Never cooked this before?</h3>
            <p className="text-muted">
              Cook with the Chef walks you through it in real time: what to do each minute, when to check, and how to fix anything that goes sideways.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate(`/cook/${recipe.id}`)}>
            <ChefHat className="h-5 w-5" /> Start cooking
          </Button>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 pt-10 lg:grid-cols-[1.15fr_1fr]">
      <Skeleton className="aspect-[3/2] rounded-[2rem]" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
