import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./router";
import { queryClient } from "./api/queryClient";
import { applyTheme, useUiStore } from "./store/useUiStore";
import "./index.css";

applyTheme(useUiStore.getState().theme);

function ThemedToaster() {
  const theme = useUiStore((s) => s.theme);
  return <Toaster theme={theme} position="top-center" richColors closeButton />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ThemedToaster />
    </QueryClientProvider>
  </StrictMode>,
);
