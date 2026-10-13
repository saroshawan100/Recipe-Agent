import { Outlet, ScrollRestoration } from "react-router-dom";
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { Header } from "./Header";

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted print:hidden">
        Pantry Chef · Nutrition values are AI estimates · Always follow food-safety temperatures
      </footer>
      <ChatDrawer />
      <ScrollRestoration />
    </div>
  );
}
