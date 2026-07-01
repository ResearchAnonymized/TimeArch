import { createContext, useContext, useState, type ReactNode } from "react";

export type DensityLevel = "compact" | "standard" | "detailed";

interface DensityContextValue {
  density: DensityLevel;
  setDensity: (d: DensityLevel) => void;
}

const DensityContext = createContext<DensityContextValue>({
  density: "standard",
  setDensity: () => {},
});

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<DensityLevel>("standard");
  return (
    <DensityContext.Provider value={{ density, setDensity }}>{children}</DensityContext.Provider>
  );
}

export function useDensity() {
  return useContext(DensityContext);
}
