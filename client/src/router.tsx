import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Kitchen } from "./pages/Kitchen";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Kitchen /> },
      { path: "/recipe/:id", lazy: () => import("./pages/RecipeDetail").then((m) => ({ Component: m.RecipeDetail })) },
      { path: "/saved", lazy: () => import("./pages/Saved").then((m) => ({ Component: m.Saved })) },
      { path: "/shopping", lazy: () => import("./pages/ShoppingList").then((m) => ({ Component: m.ShoppingListPage })) },
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "/cook/:id", lazy: () => import("./pages/CookWithChef").then((m) => ({ Component: m.CookWithChef })) },
]);
