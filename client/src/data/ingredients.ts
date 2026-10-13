import { Apple, Beef, Carrot, CookingPot, Leaf, Milk, Package, Wheat, type LucideIcon } from "lucide-react";

export interface CatalogItem {
  name: string;
  emoji: string;
  /** Ingredient name on TheMealDB image CDN, or null when no photo exists. */
  img: string | null;
  category: CategoryId;
}

export type CategoryId = "proteins" | "vegetables" | "fruits" | "grains" | "dairy" | "spices" | "sauces" | "pantry";

export const CATEGORIES: { id: CategoryId; label: string; icon: LucideIcon }[] = [
  { id: "proteins", label: "Proteins", icon: Beef },
  { id: "vegetables", label: "Vegetables", icon: Carrot },
  { id: "fruits", label: "Fruits", icon: Apple },
  { id: "grains", label: "Grains & Carbs", icon: Wheat },
  { id: "dairy", label: "Dairy & Eggs", icon: Milk },
  { id: "spices", label: "Herbs & Spices", icon: Leaf },
  { id: "sauces", label: "Sauces & Oils", icon: CookingPot },
  { id: "pantry", label: "Pantry", icon: Package },
];

// [display name, emoji, MealDB image name (true = same as display name, null = none)]
type Row = [string, string, string | true | null];

const RAW: Record<CategoryId, Row[]> = {
  proteins: [
    ["Chicken Breast", "🍗", true],
    ["Chicken Thighs", "🍗", true],
    ["Chicken Wings", "🍗", true],
    ["Ground Beef", "🥩", "Minced Beef"],
    ["Steak", "🥩", "Sirloin steak"],
    ["Pork Chops", "🥩", true],
    ["Ground Pork", "🥩", "Minced Pork"],
    ["Pork Tenderloin", "🥩", true],
    ["Bacon", "🥓", true],
    ["Sausages", "🌭", true],
    ["Chorizo", "🌭", true],
    ["Ham", "🍖", true],
    ["Ground Turkey", "🦃", "Turkey Mince"],
    ["Lamb", "🍖", true],
    ["Salmon", "🐟", true],
    ["Shrimp", "🍤", true],
    ["White Fish", "🐟", "White Fish Fillets"],
    ["Tuna", "🐟", true],
    ["Cod", "🐟", true],
    ["Tofu", "🧈", true],
    ["Tempeh", "🫘", true],
    ["Chickpeas", "🫘", true],
    ["Black Beans", "🫘", true],
    ["Kidney Beans", "🫘", true],
    ["Lentils", "🫘", true],
  ],
  vegetables: [
    ["Onion", "🧅", true],
    ["Red Onion", "🧅", "Red Onions"],
    ["Garlic", "🧄", true],
    ["Tomatoes", "🍅", true],
    ["Cherry Tomatoes", "🍅", true],
    ["Potatoes", "🥔", true],
    ["Sweet Potatoes", "🍠", true],
    ["Carrots", "🥕", true],
    ["Bell Pepper", "🫑", "Red Pepper"],
    ["Broccoli", "🥦", true],
    ["Cauliflower", "🥦", null],
    ["Spinach", "🥬", true],
    ["Kale", "🥬", true],
    ["Zucchini", "🥒", true],
    ["Mushrooms", "🍄", true],
    ["Cucumber", "🥒", true],
    ["Lettuce", "🥬", true],
    ["Cabbage", "🥬", true],
    ["Green Beans", "🫛", true],
    ["Peas", "🫛", true],
    ["Corn", "🌽", "Sweetcorn"],
    ["Celery", "🥬", true],
    ["Asparagus", "🌱", true],
    ["Eggplant", "🍆", "Aubergine"],
    ["Avocado", "🥑", true],
    ["Jalapeño", "🌶️", "Jalapeno"],
    ["Ginger", "🫚", true],
    ["Leek", "🥬", true],
    ["Green Onions", "🧅", "Spring Onions"],
    ["Butternut Squash", "🎃", true],
    ["Brussels Sprouts", "🥬", true],
    ["Bok Choy", "🥬", "Bok Choi"],
    ["Beets", "🫜", "Beetroot"],
    ["Radish", "🌱", true],
  ],
  fruits: [
    ["Lemon", "🍋", true],
    ["Lime", "🍋", true],
    ["Apples", "🍎", true],
    ["Bananas", "🍌", "Banana"],
    ["Oranges", "🍊", "Orange"],
    ["Strawberries", "🍓", true],
    ["Blueberries", "🫐", true],
    ["Raspberries", "🍓", true],
    ["Mango", "🥭", true],
    ["Pineapple", "🍍", "Pineapple Chunks"],
    ["Peaches", "🍑", true],
    ["Pears", "🍐", true],
    ["Grapes", "🍇", null],
    ["Coconut", "🥥", true],
    ["Dates", "🌴", "Medjool Dates"],
    ["Raisins", "🍇", true],
    ["Pomegranate", "🍎", true],
    ["Cranberries", "🍒", "Dried cranberries"],
  ],
  grains: [
    ["Rice", "🍚", true],
    ["Brown Rice", "🍚", true],
    ["Basmati Rice", "🍚", true],
    ["Jasmine Rice", "🍚", true],
    ["Spaghetti", "🍝", true],
    ["Penne", "🍝", "Penne Rigate"],
    ["Macaroni", "🍝", true],
    ["Lasagna Sheets", "🍝", "Lasagne Sheets"],
    ["Egg Noodles", "🍜", true],
    ["Rice Noodles", "🍜", true],
    ["Udon Noodles", "🍜", true],
    ["Bread", "🍞", true],
    ["Tortillas", "🌯", "Flour Tortilla"],
    ["Pita Bread", "🫓", true],
    ["Naan", "🫓", "Naan Bread"],
    ["Quinoa", "🌾", true],
    ["Couscous", "🌾", true],
    ["Oats", "🥣", "Rolled Oats"],
    ["Flour", "🌾", "Plain Flour"],
    ["Breadcrumbs", "🍞", true],
    ["Cornmeal", "🌽", true],
  ],
  dairy: [
    ["Eggs", "🥚", true],
    ["Milk", "🥛", true],
    ["Butter", "🧈", true],
    ["Cheddar", "🧀", "Cheddar Cheese"],
    ["Mozzarella", "🧀", true],
    ["Parmesan", "🧀", true],
    ["Feta", "🧀", true],
    ["Goat Cheese", "🧀", "Goats Cheese"],
    ["Ricotta", "🧀", true],
    ["Cream Cheese", "🧀", true],
    ["Sour Cream", "🥛", true],
    ["Greek Yogurt", "🥛", true],
    ["Heavy Cream", "🥛", true],
    ["Paneer", "🧀", true],
    ["Almond Milk", "🥛", true],
  ],
  spices: [
    ["Salt", "🧂", true],
    ["Black Pepper", "🧂", true],
    ["Cumin", "🌿", true],
    ["Paprika", "🌶️", true],
    ["Smoked Paprika", "🌶️", true],
    ["Chili Powder", "🌶️", true],
    ["Cayenne Pepper", "🌶️", true],
    ["Red Pepper Flakes", "🌶️", true],
    ["Garlic Powder", "🧄", true],
    ["Oregano", "🌿", "Dried Oregano"],
    ["Basil", "🌿", true],
    ["Thyme", "🌿", true],
    ["Rosemary", "🌿", true],
    ["Parsley", "🌿", true],
    ["Cilantro", "🌿", true],
    ["Mint", "🌿", true],
    ["Dill", "🌿", true],
    ["Chives", "🌿", true],
    ["Sage", "🌿", true],
    ["Bay Leaves", "🍃", true],
    ["Cinnamon", "🟤", true],
    ["Nutmeg", "🟤", true],
    ["Ground Ginger", "🫚", true],
    ["Turmeric", "🟡", true],
    ["Curry Powder", "🟡", true],
    ["Garam Masala", "🟤", true],
    ["Ground Coriander", "🌿", true],
    ["Italian Seasoning", "🌿", true],
    ["Cajun Seasoning", "🌶️", "Cajun"],
    ["Five Spice", "⭐", "Five Spice Powder"],
  ],
  sauces: [
    ["Olive Oil", "🫒", true],
    ["Vegetable Oil", "🛢️", true],
    ["Sesame Oil", "🫙", "Sesame Seed Oil"],
    ["Soy Sauce", "🥢", true],
    ["Vinegar", "🫙", "White Vinegar"],
    ["Balsamic Vinegar", "🫙", true],
    ["Rice Vinegar", "🫙", true],
    ["Honey", "🍯", true],
    ["Maple Syrup", "🍁", true],
    ["Ketchup", "🍅", "Tomato Ketchup"],
    ["Dijon Mustard", "🟡", true],
    ["Mayonnaise", "🥚", true],
    ["Hot Sauce", "🌶️", "Hotsauce"],
    ["Sriracha", "🌶️", true],
    ["Worcestershire", "🫙", "Worcestershire Sauce"],
    ["Fish Sauce", "🐟", true],
    ["Oyster Sauce", "🦪", true],
    ["Hoisin Sauce", "🥢", true],
    ["BBQ Sauce", "🍖", "Barbeque Sauce"],
    ["Salsa", "🍅", true],
    ["Pesto", "🌿", null],
    ["Tomato Paste", "🍅", "Tomato Puree"],
    ["Peanut Butter", "🥜", true],
    ["Tahini", "🫙", true],
    ["Gochujang", "🌶️", true],
    ["Thai Curry Paste", "🍛", "Thai Red Curry Paste"],
    ["Sweet Chili Sauce", "🌶️", "sweet chilli sauce"],
  ],
  pantry: [
    ["Canned Tomatoes", "🥫", "Chopped Tomatoes"],
    ["Tomato Sauce", "🥫", "Passata"],
    ["Chicken Stock", "🥣", true],
    ["Beef Stock", "🥣", true],
    ["Vegetable Stock", "🥣", true],
    ["Coconut Milk", "🥥", true],
    ["Sugar", "🍬", true],
    ["Brown Sugar", "🍬", true],
    ["Baking Powder", "🧁", true],
    ["Baking Soda", "🧁", "Bicarbonate Of Soda"],
    ["Cornstarch", "🌽", true],
    ["Yeast", "🍞", true],
    ["Vanilla Extract", "🍦", true],
    ["Cocoa Powder", "🍫", true],
    ["Chocolate Chips", "🍫", true],
    ["Almonds", "🥜", true],
    ["Walnuts", "🥜", true],
    ["Peanuts", "🥜", true],
    ["Cashews", "🥜", "Cashew Nuts"],
    ["Pine Nuts", "🥜", true],
    ["Sesame Seeds", "⚪", "Sesame Seed"],
    ["Olives", "🫒", "Black Olives"],
    ["Capers", "🫙", true],
    ["Sun-Dried Tomatoes", "🍅", true],
    ["Pickles", "🥒", "Dill Pickles"],
  ],
};

export function imageUrl(img: string | null): string | null {
  return img ? `https://www.themealdb.com/images/ingredients/${encodeURIComponent(img)}-small.png` : null;
}

export const CATALOG: CatalogItem[] = (Object.entries(RAW) as [CategoryId, Row[]][]).flatMap(([category, rows]) =>
  rows.map(([name, emoji, img]) => ({ name, emoji, img: img === true ? name : img, category })),
);

const byName = new Map(CATALOG.map((i) => [i.name.toLowerCase(), i]));

export function findCatalogItem(name: string): CatalogItem | undefined {
  return byName.get(name.trim().toLowerCase());
}

export function searchCatalog(query: string, limit = 24): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: CatalogItem[] = [];
  const contains: CatalogItem[] = [];
  for (const item of CATALOG) {
    const n = item.name.toLowerCase();
    if (n.startsWith(q) || n.split(" ").some((w) => w.startsWith(q))) starts.push(item);
    else if (n.includes(q)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
}

export const STAPLE_OPTIONS = [
  "salt",
  "black pepper",
  "olive oil",
  "vegetable oil",
  "butter",
  "water",
  "garlic",
  "flour",
  "sugar",
  "eggs",
  "milk",
  "soy sauce",
  "vinegar",
];

export const DIETS = ["Vegetarian", "Vegan", "Pescatarian", "Gluten-free", "Dairy-free", "Keto", "Low-carb", "High-protein", "Low-calorie", "Paleo"];
export const ALLERGIES = ["Peanuts", "Tree nuts", "Shellfish", "Fish", "Eggs", "Dairy", "Soy", "Wheat", "Sesame"];
export const CUISINES = ["Italian", "Mexican", "Chinese", "Japanese", "Thai", "Indian", "Mediterranean", "Korean", "American", "French", "Middle Eastern", "Greek", "Vietnamese", "Caribbean"];
export const EQUIPMENT = ["Stovetop", "Oven", "Air fryer", "Microwave", "Slow cooker", "Instant Pot", "Grill", "Blender"];
