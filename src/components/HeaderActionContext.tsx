"use client";

import { createContext, useContext } from "react";

export const HeaderActionContext = createContext<{
  setAction: (node: React.ReactNode | null) => void;
} | null>(null);

export function useHeaderAction() {
  const ctx = useContext(HeaderActionContext);
  if (!ctx) {
    throw new Error("useHeaderAction must be used within HeaderActionContext");
  }
  return ctx;
}
