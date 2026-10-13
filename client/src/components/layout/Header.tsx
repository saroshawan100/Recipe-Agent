import { ChefHat, Heart, Moon, ShoppingBasket, Sun, UtensilsCrossed } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useShoppingList } from "@/api/hooks";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/useUiStore";

const links = [
  { to: "/", label: "Kitchen", icon: UtensilsCrossed, end: true },
  { to: "/saved", label: "Saved", icon: Heart },
  { to: "/shopping", label: "Shopping list", icon: ShoppingBasket },
];

export function Header() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const { data } = useShoppingList();
  const openItems = data?.items.filter((i) => !i.checked).length ?? 0;

  return (
    <header className="glass sticky top-0 z-30 border-x-0 border-t-0 print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <NavLink to="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-stone-950 shadow-lg shadow-saffron-500/30 transition-transform group-hover:-rotate-6">
            <ChefHat className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Pantry<span className="text-saffron-500">Chef</span>
          </span>
        </NavLink>

        <nav className="ml-auto flex items-center gap-1">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              {to === "/shopping" && openItems > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-saffron-500 px-1 text-[11px] font-bold text-stone-950">
                  {openItems}
                </span>
              )}
            </NavLink>
          ))}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="ml-1 grid h-9 w-9 cursor-pointer place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </nav>
      </div>
    </header>
  );
}
