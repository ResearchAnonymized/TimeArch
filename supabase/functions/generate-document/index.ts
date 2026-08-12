import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id, document_type, user_id } = await req.json();
    if (!project_id || !document_type) {
      return new Response(JSON.stringify({ error: "project_id and document_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ─── AUTH: verify JWT and project membership ──────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claimsData, error: userErr } = await authedClient.auth.getClaims(token);
    const authedUserId = claimsData?.claims?.sub;
    if (userErr || !authedUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (user_id && authedUserId !== user_id) {
      return new Response(JSON.stringify({ error: "Forbidden: user_id mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isMember } = await authedClient.rpc("is_project_member", {
      _user_id: authedUserId, _project_id: project_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden: not a project member" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all project data
    const [projectRes, reqsRes, driversRes, artifactsRes, approvalsRes, featureChangesRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project_id).single(),
      supabase.from("requirements").select("*").eq("project_id", project_id).order("created_at"),
      supabase.from("architecture_drivers").select("*").eq("project_id", project_id).order("created_at"),
      supabase.from("architecture_artifacts").select("*").eq("project_id", project_id).order("stage, created_at"),
      supabase.from("stage_approvals").select("*").eq("project_id", project_id).order("stage"),
      supabase.from("feature_changes").select("*").eq("project_id", project_id).order("created_at"),
    ]);

    const project = projectRes.data;
    const requirements = reqsRes.data || [];
    const drivers = driversRes.data || [];
    const artifacts = artifactsRes.data || [];
    const approvals = approvalsRes.data || [];
    const featureChanges = featureChangesRes.data || [];

    // Group artifacts by stage (latest per stage)
    const artifactsByStage: Record<number, any> = {};
    for (const a of artifacts) {
      if (!artifactsByStage[a.stage] || new Date(a.created_at) > new Date(artifactsByStage[a.stage].created_at)) {
        artifactsByStage[a.stage] = a;
      }
    }

    // ─── Discovery wizard outputs — matched by title substring across all stages ──
    const findWizardArtifact = (patterns: string[]) => {
      const lowerPatterns = patterns.map((p) => p.toLowerCase());
      const matches = artifacts.filter((a: any) => {
        const t = String(a.title || "").toLowerCase();
        return lowerPatterns.some((p) => t.includes(p));
      });
      return matches.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]?.content ?? null;
    };

    const wizardOutputs: Record<string, any> = {
      change_impact_scores: featureChanges.length > 0 ? featureChanges.map((f: any) => ({
        title: f.title, change_type: f.change_type, impact_score: f.impact_score,
        blast_radius: f.blast_radius, effort: f.effort_estimate, risk: f.risk_level,
        rationale: f.rationale,
      })) : null,
      component_mapping: findWizardArtifact(["component mapping", "feature mapping", "map feature"]),
      ripple_analysis: findWizardArtifact(["ripple", "blast radius"]),
      quality_impact: findWizardArtifact(["quality impact", "quality assessment"]),
      alternatives: findWizardArtifact(["alternative", "options considered"]),
      implementation_plan: findWizardArtifact(["implementation plan", "plan feature", "delivery plan"]),
      adr_draft: findWizardArtifact(["adr", "decision record"]),
      lineage: findWizardArtifact(["lineage", "traceability"]),
    };
    const hasWizardOutputs = Object.values(wizardOutputs).some((v) => v !== null);

    // Determine project mode (greenfield / brownfield / hybrid) — drives template variant selection
    const rawMode = String((project as any)?.mode ?? "greenfield").toLowerCase();
    const projectMode: "greenfield" | "brownfield" | "hybrid" =
      rawMode === "brownfield" ? "brownfield" : rawMode === "hybrid" ? "hybrid" : "greenfield";

    // ─── Brownfield / hybrid discovery data (present when the project imported an existing system) ─
    const [
      importsRes,
      dispositionRes,
      gapsRes,
      modernizationRes,
      styleRes,
    ] = projectMode !== "greenfield"
      ? await Promise.all([
          supabase.from("project_imports").select("*").eq("project_id", project_id),
          supabase.from("system_disposition_reports").select("*").eq("project_id", project_id),
          supabase.from("architecture_gaps").select("*").eq("project_id", project_id),
          supabase.from("modernization_items").select("*").eq("project_id", project_id),
          supabase.from("system_style").select("*").eq("project_id", project_id).maybeSingle(),
        ])
      : [null, null, null, null, null] as any;

    const deltaRequirements = requirements.filter((r: any) => r.change_type);
    const preserveReqs = deltaRequirements.filter((r: any) => r.change_type === "preserve");
    const deprecateReqs = deltaRequirements.filter((r: any) => r.change_type === "deprecate");
    const changeReqs = deltaRequirements.filter((r: any) => r.change_type === "change");

    // Build context summary for AI
    const contextSummary: Record<string, any> = {
      project: {
        name: project?.name,
        description: project?.description,
        current_stage: project?.current_stage,
        mode: projectMode,
      },
      requirements_count: requirements.length,
      functional_requirements: requirements.filter(r => r.type === "functional").map(r => ({ id: r.requirement_id, title: r.title, description: r.description, priority: r.priority, change_type: r.change_type })),
      non_functional_requirements: requirements.filter(r => r.type === "non_functional").map(r => ({ id: r.requirement_id, title: r.title, description: r.description, priority: r.priority, change_type: r.change_type })),
      user_stories: requirements.filter(r => r.type === "user_story").map(r => ({ id: r.requirement_id, title: r.title, description: r.description })),
      constraints: requirements.filter(r => r.type === "constraint").map(r => ({ id: r.requirement_id, title: r.title, description: r.description })),
      drivers: drivers.map(d => ({ label: d.label, description: d.description, category: d.category, priority: d.priority })),
      artifacts_by_stage: Object.fromEntries(
        Object.entries(artifactsByStage).map(([stage, artifact]) => [
          stage,
          { title: artifact.title, type: artifact.type, content: artifact.content, status: artifact.status }
        ])
      ),
      locked_stages: [...new Set(approvals.filter(a => a.action === "locked").map(a => a.stage))].sort((a, b) => a - b),
    };

    if (projectMode !== "greenfield") {
      contextSummary.brownfield = {
        preserved_requirements: preserveReqs.map((r: any) => ({ id: r.requirement_id, title: r.title, description: r.description })),
        deprecated_requirements: deprecateReqs.map((r: any) => ({ id: r.requirement_id, title: r.title, description: r.description })),
        changed_requirements: changeReqs.map((r: any) => ({ id: r.requirement_id, title: r.title, description: r.description })),
        imported_sources: (importsRes?.data || []).map((i: any) => ({ kind: i.kind, filename: i.filename, size: i.size_bytes, status: i.status })),
        disposition_reports: (dispositionRes?.data || []).map((d: any) => ({
          component: d.component_name, disposition: d.disposition, rationale: d.rationale, risk: d.risk_level, effort: d.effort_estimate,
        })),
        architecture_gaps: (gapsRes?.data || []).map((g: any) => ({
          area: g.area, gap_type: g.gap_type, current: g.current_state, target: g.target_state, severity: g.severity, remediation: g.remediation,
        })),
        modernization_items: (modernizationRes?.data || []).map((m: any) => ({
          title: m.title, type: m.item_type, priority: m.priority, wave: m.wave, effort: m.effort_estimate,
        })),
        legacy_style: styleRes?.data ? { style: (styleRes.data as any).style, confidence: (styleRes.data as any).confidence, rationale: (styleRes.data as any).rationale } : null,
      };
    }

    if (hasWizardOutputs) {
      contextSummary.discovery_wizard_outputs = wizardOutputs;
    }


    // ─────────────────────────────────────────────────────────────────
    // Document templates — one variant per document type × project mode
    // ─────────────────────────────────────────────────────────────────
    const greenfieldTemplates: Record<string, string> = {
      srs: `Generate a comprehensive Software Requirements Specification (SRS) for a GREENFIELD (new-build) project, following IEEE 830. Include:
1. Introduction (Purpose, Scope, Definitions, References, Overview)
2. Overall Description (Product Perspective — brand new system, Product Functions, User Characteristics, Constraints, Assumptions and Dependencies)
3. Specific Requirements (External Interfaces, Functional Requirements, Performance, Data, Design Constraints, Software System Attributes)
4. Appendices (Traceability Matrix, Glossary)
Frame every section as the design of a NEW system — do not reference legacy components.`,

      sad: `Generate a comprehensive Software Architecture Document (SAD) for a GREENFIELD project, following IEEE 1471 / ISO 42010 and the 4+1 View Model. Include:
1. Introduction · 2. Architectural Representation · 3. Architectural Goals and Constraints
4. Use-Case View · 5. Logical View · 6. Process View · 7. Deployment View · 8. Implementation View · 9. Data View
10. Size and Performance · 11. Quality Attributes · 12. Architecture Decisions (ADRs) · 13. Cross-Cutting Concerns · 14. Infrastructure & Deployment Strategy
Present ONE target architecture — no as-is/to-be comparisons.`,

      assessment: `Generate a comprehensive Architecture Assessment Report (AAR) for a GREENFIELD project based on ATAM. Include:
1. Executive Summary · 2. Assessment Methodology · 3. Business Drivers and QA Requirements
4. Architectural Approach Summary · 5. Quality Attribute Utility Tree · 6. QA Scenarios and Analysis
7. Sensitivity Points · 8. Tradeoff Points · 9. Risk Assessment · 10. Non-Risks · 11. Findings and Recommendations
12. Compliance Assessment · Appendix: Traceability Matrix`,

      full_package: `Generate a complete Full Architecture Package (FAP) for a GREENFIELD project. Include ALL 21 sections:
1. Executive Summary · 2. System Goal and Context · 3. Requirement Summary · 4. Architectural Drivers
5. Style Recommendation and Justification · 6. Alternatives Considered · 7. Tradeoff Analysis · 8. Decision Rationale
9. System Decomposition · 10. Architectural Viewpoints (4+1, ISO 42010) · 11. Data Architecture · 12. Interface and API Design
13. Cross-Cutting Concerns · 14. Infrastructure and Deployment · 15. Diagram Set · 16. ADRs
17. Traceability Matrix · 18. Quality Attribute Evaluation · 19. Validation and Governance Report
20. Risks, Assumptions, Dependencies · 21. Handoff Notes and Implementation Guidance`,
    };

    const brownfieldTemplates: Record<string, string> = {
      srs: `Generate a Software Requirements Specification (SRS) for a BROWNFIELD MODERNIZATION project. Do NOT use a blank-slate greenfield structure. Include:
1. Introduction (Purpose, Modernization Scope, Definitions, References)
2. As-Is System Inventory (existing components, integrations, data stores — draw from context.brownfield.imported_sources and disposition_reports)
3. Legacy Pain Points (what hurts today — reference architecture_gaps)
4. Preserved vs Deprecated Requirements (side-by-side table: which behaviors survive, which retire — use context.brownfield.preserved_requirements and deprecated_requirements)
5. Changed Requirements (what changes, and why)
6. New Requirements added by this modernization
7. Backward-Compatibility Contracts (APIs, data formats, integrations that MUST remain stable during coexistence)
8. Migration Constraints (regulatory, downtime, data-migration, dual-run windows)
9. Non-Functional Requirements (framed as deltas from current state where possible)
10. Traceability Matrix (as-is component → requirement change → to-be component)
11. Glossary
Every section must ground itself in the existing system context, not invent a green field.`,

      sad: `Generate a Software Architecture Document (SAD) for a BROWNFIELD MODERNIZATION project. Do NOT present a single target architecture in isolation. Include:
1. Introduction and Modernization Objectives
2. Current-State Architecture (4+1 views of the EXISTING system — logical, process, deployment, data, use-case)
3. Target-State Architecture (same 4+1 views for the TO-BE system)
4. Gap Analysis (As-Is vs To-Be, per view — reference context.brownfield.architecture_gaps)
5. Strangler-Fig / Phased Migration Plan (waves, sequencing, exit criteria per wave)
6. Integration Seams with Legacy (adapters, anti-corruption layers, façade services)
7. Data Migration Strategy (extract, transform, backfill, dual-write, cutover)
8. Coexistence Period Design (how old and new run in parallel, traffic routing, fallback)
9. Refactoring & Replacement Decisions (per component — keep / refactor / replace / retire, from disposition_reports)
10. Architecture Decision Records (ADRs) — especially replacement rationale
11. Cross-Cutting Concerns during Migration (observability of both stacks, security across seams, error handling on fallback paths)
12. Deployment & Rollback Strategy
Do not assume greenfield freedoms — every choice must respect the As-Is constraints.`,

      assessment: `Generate an Architecture Assessment Report (AAR) for a BROWNFIELD MODERNIZATION project. Center it on migration risk, not on a fresh ATAM utility tree alone. Include:
1. Executive Summary (modernization posture)
2. Technical Debt Register (categorized debt in the current system, with impact and remediation cost)
3. Legacy Risk Assessment (operational, security, knowledge, vendor, compliance risks in the existing system)
4. Migration Risk Matrix per Wave (likelihood × impact × mitigation, per proposed wave from modernization_items)
5. Rollback Strategy (per wave — what triggers rollback, what state we return to, data reconciliation)
6. Cutover Risk Matrix (blast radius, blackout windows, dependency ordering)
7. Regression Surface Area (which existing behaviors are most at risk of breaking, from preserved_requirements)
8. Quality Attribute Scenarios (framed as: how does the to-be architecture protect or improve each QA vs the as-is baseline?)
9. Sensitivity and Tradeoff Points that emerge specifically from coexistence and dual-run
10. Non-Risks (as-is behaviors and integrations that are demonstrably safe)
11. Findings and Recommendations (prioritized modernization actions)
12. Compliance Delta (regulatory changes between as-is and to-be)`,

      full_package: `Generate a Full Architecture Package (FAP) for a BROWNFIELD MODERNIZATION project. Merge modernization-planning sections with the classic build package. Include:
1. Executive Summary (modernization thesis)
2. As-Is System Overview (components, tech stack, integrations, style — from context.brownfield)
3. Business Drivers for Modernization
4. Modernization Roadmap (waves, timeline, dependencies)
5. Wave / Phase Plan (per wave: scope, exit criteria, success metrics — from modernization_items)
6. Decommissioning Schedule (per legacy component: retire-by, prerequisites, data handling)
7. Parallel-Run Playbook (traffic split, shadow reads, comparison harness)
8. Requirement Delta Summary (preserved / changed / deprecated / new)
9. Target-State Architectural Drivers
10. Style Recommendation and Replacement Rationale
11. Alternatives Considered (including "do nothing" and "lift-and-shift")
12. Tradeoff Analysis (specific to migration paths)
13. System Decomposition (to-be) with Boundary Design against legacy
14. Architectural Viewpoints (4+1) for the to-be state
15. Data Architecture and Data Migration Design
16. Interface & API Design (including backward-compat contracts)
17. Cross-Cutting Concerns during Coexistence
18. Infrastructure and Deployment (as-is → to-be transition)
19. Diagram Set (as-is context, to-be context, migration seams, wave sequence, deployment)
20. ADRs (especially replacement decisions)
21. Traceability Matrix (as-is component → requirement change → to-be component → wave)
22. Quality Attribute Evaluation (as-is baseline vs to-be target)
23. Risks, Assumptions, Dependencies · 24. Cutover & Rollback Playbook · 25. Handoff Notes for Delivery Teams`,

      discovery: `Generate a Brownfield Discovery Report — the definitive record of "what did we learn about the existing system before we redesigned it". Include:
1. Executive Summary of Discovery Findings
2. Source Inventory (repos, files, specs, schemas ingested — from context.brownfield.imported_sources)
3. Reverse-Engineered System Overview (components, responsibilities, technology per component)
4. System Disposition / Suitability Matrix (per component: keep / refactor / replace / retire, with rationale, risk, effort — from disposition_reports)
5. Detected Architectural Style (from context.brownfield.legacy_style — style, confidence, rationale)
6. Architecture Gaps (per area: current vs target, severity, remediation direction — from architecture_gaps)
7. Modernization Backlog (proposed items with priority and wave assignment — from modernization_items)
8. Integration and Dependency Map (external systems, protocols, data flows)
9. Data Landscape (stores, ownership, PII, migration difficulty)
10. Preserved-Behavior Contracts (what MUST NOT change — from preserved_requirements)
11. Deprecation Candidates (what is safe to retire and why — from deprecated_requirements)
12. Assumptions, Unknowns, and Follow-up Investigations
13. Recommended Next Steps into Requirement Definition and Architecture Design
This is a brownfield/hybrid deliverable; do not include greenfield-style vision or blue-sky sections.`,
    };

    const hybridTemplates: Record<string, string> = {
      srs: `${brownfieldTemplates.srs}

HYBRID PROJECT NOTE: This project both modernizes an existing system AND introduces net-new modules. In every section, clearly separate:
(a) Requirements that apply to LEGACY modules being modernized
(b) Requirements for NEW modules being built alongside
(c) Requirements at the BOUNDARY between the two (integration contracts, data ownership handoffs)`,

      sad: `${brownfieldTemplates.sad}

HYBRID PROJECT NOTE: The system is a mix of modernized legacy and new-build modules. Explicitly design:
- Target architecture for the NEW modules (greenfield-style choices)
- Migration plan for the LEGACY modules (strangler-fig-style choices)
- The BOUNDARY design between them (contracts, event flows, data ownership, security perimeter)
Every ADR should state which side of the boundary it governs.`,

      assessment: `${brownfieldTemplates.assessment}

HYBRID PROJECT NOTE: Assess risk on BOTH sides:
- ATAM-style utility tree and QA scenarios for the NEW modules
- Migration/cutover risk matrix for the LEGACY modules
- Boundary risks (contract drift, dual-ownership of data, cross-stack observability gaps)`,

      full_package: `${brownfieldTemplates.full_package}

HYBRID PROJECT NOTE: Treat this as two coordinated tracks with a shared boundary:
- Build-package sections (decomposition, viewpoints, data, APIs, infra) must distinguish NEW-module design from LEGACY-modernization design.
- Add an explicit "Boundary Design" section covering integration contracts, data ownership, event flows, and cross-track observability.
- Wave plan and roadmap must interleave new-build milestones with legacy-modernization waves.`,

      discovery: brownfieldTemplates.discovery,
    };

    const templateSet =
      projectMode === "brownfield"
        ? brownfieldTemplates
        : projectMode === "hybrid"
          ? hybridTemplates
          : greenfieldTemplates;

    const docTemplates = templateSet;

    const systemPrompt = `You are a senior enterprise architect generating formal architecture documentation. 
You produce professional, standards-compliant documents with proper section numbering, detailed analysis, and actionable content.
The project mode is "${projectMode}". Tailor terminology, section titles, and analytical framing to that mode — do NOT emit greenfield content for a brownfield/hybrid project or vice versa.

Your output must be structured JSON with a "sections" array where each section has:
- "number": section number (e.g., "1", "1.1", "2.3")
- "title": section heading
- "content": detailed content (can include multiple paragraphs separated by \\n\\n)
- "subsections": optional array of sub-sections with same structure
- "table": optional object with "headers" (string[]) and "rows" (string[][]) for tabular data
- "diagram_description": optional string describing a diagram that should accompany this section
- "mermaid_code": optional valid Mermaid.js diagram code for visual diagrams. Use simple syntax. For flowcharts use "graph TD" or "graph LR". For ER diagrams use "erDiagram". For sequence diagrams use "sequenceDiagram". IMPORTANT MERMAID RULES:
  * Use simple single-word node IDs with labels in brackets: A["User Service"]
  * Do NOT use special characters, parentheses, or slashes in node IDs
  * For ER diagrams, attribute types must be single words (use varchar not varchar_255, use string not Enum)
  * Keep diagrams focused with max 15-20 nodes per diagram
  * Always include at least 3-5 diagrams per document for key architectural views

Also include top-level fields:
- "document_title": full document title
- "document_type": type identifier
- "standard_reference": applicable standard (e.g., "IEEE 830", "ISO/IEC/IEEE 42010")
- "version": "1.0"
- "date": current date
- "project_name": project name
- "executive_summary": 2-3 paragraph executive summary
- "project_mode": one of "greenfield" | "brownfield" | "hybrid"

CRITICAL: Use REAL data from the provided project context. Do NOT use placeholder text. Every section must contain substantive, project-specific content.
For brownfield/hybrid projects, ground every claim in context.brownfield (imported sources, disposition reports, gaps, modernization items, preserved/deprecated requirements). If a brownfield section has no supporting data, say "No data ingested yet for this area — recommend running Discovery again" rather than inventing content.
CRITICAL: Include mermaid_code diagrams wherever visual representation adds value — system context, component diagrams, ER diagrams, sequence diagrams, deployment diagrams, and (for brownfield/hybrid) as-is vs to-be comparisons and migration wave sequence diagrams.`;

    const { resolvePrompt } = await import("../_shared/prompts.ts");
    const systemPromptResolved = await resolvePrompt(
      supabase,
      "generate-document.system",
      systemPrompt,
    );

    const wizardOrderDirective = hasWizardOutputs ? `

═══════════════════════════════════════════════════════════════════
MANDATORY: DISCOVERY WIZARD OUTPUTS MUST BE INSERTED IN THIS ORDER
═══════════════════════════════════════════════════════════════════
The user has completed the Discovery Wizard. Its outputs are in context.discovery_wizard_outputs.
You MUST weave them into the document as dedicated sections IN THIS EXACT ORDER, using the
real data (not summaries or placeholders). Preserve numeric scores, tables, and rationale.

1. "Change Impact Scorecard"         ← discovery_wizard_outputs.change_impact_scores
   Render as a table: Feature | Change Type | Impact | Blast Radius | Effort | Risk | Rationale

2. "Feature → Component Mapping"     ← discovery_wizard_outputs.component_mapping
   Render as a table of features mapped to affected components with confidence.

3. "Ripple / Blast-Radius Analysis"  ← discovery_wizard_outputs.ripple_analysis
   Include the ripple graph (mermaid), affected components, upstream/downstream reach.

4. "Quality Attribute Impact"        ← discovery_wizard_outputs.quality_impact
   Table of QA (perf/security/scalability/etc.) with delta vs baseline and rationale.

5. "Alternatives Considered"         ← discovery_wizard_outputs.alternatives
   For each alternative: name, description, pros, cons, chosen? (Y/N), rationale.

6. "Implementation Plan"             ← discovery_wizard_outputs.implementation_plan
   Phased plan: waves/milestones, work items, sequencing, exit criteria.

7. "ADR — Change Decision"           ← discovery_wizard_outputs.adr_draft
   Full ADR structure: Context, Decision, Rationale, Alternatives, Consequences.
   Add this ADR to the document's ADR list AND as its own numbered section here.

8. "Traceability & Lineage"          ← discovery_wizard_outputs.lineage
   Table linking requirement → component → decision → wave.

These 8 sections come AFTER the standard document structure's core-design sections and BEFORE
the final appendices/handoff. If a wizard output is null, insert the section heading with a
one-line note "Not yet generated — run the Discovery Wizard step for this artifact." Do not
omit the heading — the ordering must be visible so reviewers know what is missing.
═══════════════════════════════════════════════════════════════════
` : "";

    const userPrompt = `${docTemplates[document_type] || docTemplates.full_package || greenfieldTemplates.full_package}
${wizardOrderDirective}
PROJECT CONTEXT:
${JSON.stringify(contextSummary, null, 2)}`;


    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPromptResolved },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_document",
            description: "Generate a structured architecture document",
            parameters: {
              type: "object",
              properties: {
                document_title: { type: "string" },
                document_type: { type: "string" },
                standard_reference: { type: "string" },
                version: { type: "string" },
                date: { type: "string" },
                project_name: { type: "string" },
                executive_summary: { type: "string" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      number: { type: "string" },
                      title: { type: "string" },
                      content: { type: "string" },
                      subsections: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            number: { type: "string" },
                            title: { type: "string" },
                            content: { type: "string" },
                            table: {
                              type: "object",
                              properties: {
                                headers: { type: "array", items: { type: "string" } },
                                rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                              },
                            },
                            diagram_description: { type: "string" },
                            mermaid_code: { type: "string" },
                          },
                          required: ["number", "title", "content"],
                        },
                      },
                      table: {
                        type: "object",
                        properties: {
                          headers: { type: "array", items: { type: "string" } },
                          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                        },
                      },
                      diagram_description: { type: "string" },
                      mermaid_code: { type: "string" },
                    },
                    required: ["number", "title", "content"],
                  },
                },
              },
              required: ["document_title", "document_type", "standard_reference", "version", "date", "project_name", "executive_summary", "sections"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_document" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        error: `AI generation failed (${aiResponse.status}): ${errorText.slice(0, 500)}`,
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let documentContent;

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        documentContent = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback: try to parse from content
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          documentContent = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No structured output from AI");
        }
      }
    } catch (parseErr) {
      console.error("Parse error:", parseErr);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ document: documentContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Document generation error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
