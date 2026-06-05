"use client";

import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main
        className="pb-16 min-h-screen"
        style={{ paddingTop: "calc(3.5rem + env(safe-area-inset-top))" }}
      >
        {children}
      </main>
      <BottomNav />
    </>
  );
}
