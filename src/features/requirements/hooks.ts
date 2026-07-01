/**
 * Feature-level Facade for requirements data.
 * Components stay simple: one hook, one loading/error state.
 */
import { queryKeys } from "@/lib/queryKeys";
import { useResultQuery } from "@/hooks/useResultQuery";
import { requirementsService } from "@/services";

export function useRequirements(projectId: string | undefined) {
  return useResultQuery(
    queryKeys.requirements.byProject(projectId ?? "none"),
    () => requirementsService.listForProject(projectId!),
    { enabled: !!projectId },
  );
}

export function useReverseEngineeredRequirements(projectId: string | undefined) {
  return useResultQuery(
    queryKeys.requirements.reverseEngineered(projectId ?? "none"),
    () => requirementsService.listReverseEngineered(projectId!),
    { enabled: !!projectId },
  );
}
