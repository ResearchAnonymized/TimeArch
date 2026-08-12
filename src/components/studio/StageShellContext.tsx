import { createContext, useContext, ReactNode } from "react";

interface StageShellContextValue {
  compact: boolean;
}

const StageShellContext = createContext<StageShellContextValue>({ compact: false });

export function StageShellProvider({
  compact,
  children,
}: {
  compact: boolean;
  children: ReactNode;
}) {
  return (
    <StageShellContext.Provider value={{ compact }}>{children}</StageShellContext.Provider>
  );
}

export function useStageShellCompact(): boolean {
  return useContext(StageShellContext).compact;
}
