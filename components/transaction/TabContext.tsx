"use client";

import { createContext, useContext } from "react";

type TabContextValue = {
  setActiveTab: (key: string) => void;
};

export const TabContext = createContext<TabContextValue>({ setActiveTab: () => {} });

export function useTabContext() {
  return useContext(TabContext);
}
