/**
 * Seed corpus for the Experiment Ground (Sprint 4).
 * Mirrors `docs/experiments/seed-proposals.json` — keep in sync when either changes.
 *
 * Vocabulary note: `qualities[].direction` must be one of TimeArch's canonical
 * values `improves | degrades | neutral` (not positive/negative). Ripple `files`
 * are concern keywords the ripple stage tends to emit (tests, migration, docs,
 * monitoring, …) rather than filesystem paths, since ripple analysis surfaces
 * concerns/cross-cutting effects, not files. Mapping still uses class-level
 * component names.
 */
export interface SeedProposal {
  title: string;
  description: string;
  change_type: string;
  expected_hints?: Record<string, unknown>;
}

export const SEED_PROPOSALS: SeedProposal[] = [
  {
    title: "Search owners by phone number",
    description:
      "Allow support staff to look up an owner record by phone number from the owners list view. Must match partial numbers and be case/space-insensitive.",
    change_type: "add",
    expected_hints: {
      components: ["OwnerController", "OwnerRepository", "Owner"],
      files: ["tests", "validation", "telephone", "search"],
      qualities: [
        { attribute: "performance", direction: "degrades" },
        { attribute: "usability", direction: "improves" },
      ],
    },
  },
  {
    title: "Soft-delete pets instead of hard delete",
    description:
      "Replace hard delete of pet rows with a soft-delete flag so historical visit records remain intact for reporting.",
    change_type: "modify",
    expected_hints: {
      components: ["PetController", "PetRepository", "Pet"],
      files: ["migration", "tests", "visit"],
      qualities: [
        { attribute: "modifiability", direction: "improves" },
        { attribute: "reliability", direction: "improves" },
      ],
    },
  },
  {
    title: "Bulk-import visits from CSV",
    description:
      "Add an admin endpoint that accepts a CSV file of visits and creates them in a single transaction with per-row validation errors returned to the caller.",
    change_type: "add",
    expected_hints: {
      components: ["VisitController", "VisitRepository", "Visit"],
      files: ["tests", "validation", "transaction", "upload"],
      qualities: [
        { attribute: "performance", direction: "improves" },
        { attribute: "reliability", direction: "degrades" },
      ],
    },
  },
  {
    title: "Migrate vets list from server-render to JSON API",
    description:
      "Expose /api/vets returning JSON and replace the Thymeleaf vets page with a client-side rendered table backed by the new endpoint.",
    change_type: "migrate",
    expected_hints: {
      components: ["VetController", "VetRepository", "Vet"],
      files: ["tests", "thymeleaf", "json", "api"],
      qualities: [
        { attribute: "performance", direction: "improves" },
        { attribute: "modifiability", direction: "improves" },
        { attribute: "usability", direction: "degrades" },
      ],
    },
  },
  {
    title: "Remove /oups error-demo endpoint",
    description:
      "Drop the CrashController demo endpoint and any wiring/tests that reference it before shipping to production.",
    change_type: "remove",
    expected_hints: {
      components: ["CrashController"],
      files: ["tests", "documentation", "monitoring", "routes"],
      qualities: [{ attribute: "security", direction: "improves" }],
    },
  },
];
