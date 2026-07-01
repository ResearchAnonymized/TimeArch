/**
 * Centralised react-query keys.
 *
 * Co-locating keys avoids typo-driven cache bugs and lets us invalidate
 * whole subtrees consistently.
 *
 * @example
 *   queryClient.invalidateQueries({ queryKey: queryKeys.requirements.byProject(id) });
 */
export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    detail: (id: string) => ["projects", id] as const,
    list: (userId: string) => ["projects", "list", userId] as const,
  },
  requirements: {
    all: ["requirements"] as const,
    byProject: (projectId: string) => ["requirements", projectId] as const,
    reverseEngineered: (projectId: string) => ["requirements", projectId, "re"] as const,
  },
  artifacts: {
    all: ["artifacts"] as const,
    byProject: (projectId: string) => ["artifacts", projectId] as const,
    byStage: (projectId: string, stage: number) => ["artifacts", projectId, stage] as const,
  },
} as const;
