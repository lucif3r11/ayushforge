"use client";

import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="pt-14 pb-16 min-h-screen">{children}</main>
      <BottomNav />
    </>
  );
}
