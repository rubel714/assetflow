import React from "react";
import TopNav from "./TopNav";
import { useTheme } from "../lib/ThemeContext";

export default function Layout({ children, onLogout }) {
  const { theme } = useTheme();

  return (
    <div data-theme={theme} className="min-h-dvh flex flex-col">
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
        <div
          className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full blur-[100px]"
          style={{ background: "var(--bg-grad-1)" }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full blur-[100px]"
          style={{ background: "var(--bg-grad-2)" }}
        />
      </div>
      <div className="relative z-10 flex flex-col min-h-dvh">
        <TopNav onLogout={onLogout} />
        <main className="flex-1 w-full px-4 md:px-6 py-8">
          {children}
        </main>
      </div>
      <div
        id="ag-grid-popup-root"
        className="fixed inset-0 z-[10040] pointer-events-none"
      />
    </div>
  );
}
