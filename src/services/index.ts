/**
 * Barrel for the service layer.
 *
 * Import services from here, not from individual files:
 *
 *   import { projectsService, requirementsService } from "@/services";
 */
export { projectsService } from "@/services/projectsService";
export type { Project, ProjectInsert, ProjectUpdate } from "@/services/projectsService";
export { requirementsService } from "@/services/requirementsService";
export type { Requirement } from "@/services/requirementsService";
export { artifactsService } from "@/services/artifactsService";
export type { ArchitectureArtifact } from "@/services/artifactsService";
export { discoveryService } from "@/services/discoveryService";
