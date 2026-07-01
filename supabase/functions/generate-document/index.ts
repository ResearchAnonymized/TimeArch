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
    const [projectRes, reqsRes, driversRes, artifactsRes, approvalsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project_id).single(),
      supabase.from("requirements").select("*").eq("project_id", project_id).order("created_at"),
      supabase.from("architecture_drivers").select("*").eq("project_id", project_id).order("created_at"),
      supabase.from("architecture_artifacts").select("*").eq("project_id", project_id).order("stage, created_at"),
      supabase.from("stage_approvals").select("*").eq("project_id", project_id).order("stage"),
    ]);

    const project = projectRes.data;
    const requirements = reqsRes.data || [];
    const drivers = driversRes.data || [];
    const artifacts = artifactsRes.data || [];
    const approvals = approvalsRes.data || [];

    // Group artifacts by stage (latest per stage)
    const artifactsByStage: Record<number, any> = {};
    for (const a of artifacts) {
      if (!artifactsByStage[a.stage] || new Date(a.created_at) > new Date(artifactsByStage[a.stage].created_at)) {
        artifactsByStage[a.stage] = a;
      }
    }

    // Build context summary for AI
    const contextSummary = {
      project: { name: project?.name, description: project?.description, current_stage: project?.current_stage },
      requirements_count: requirements.length,
      functional_requirements: requirements.filter(r => r.type === "functional").map(r => ({ id: r.requirement_id, title: r.title, description: r.description, priority: r.priority })),
      non_functional_requirements: requirements.filter(r => r.type === "non_functional").map(r => ({ id: r.requirement_id, title: r.title, description: r.description, priority: r.priority })),
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

    // Define document templates
    const docTemplates: Record<string, string> = {
      srs: `Generate a comprehensive Software Requirements Specification (SRS) document following IEEE 830 standard structure. Include:
1. Introduction (1.1 Purpose, 1.2 Scope, 1.3 Definitions/Acronyms/Abbreviations, 1.4 References, 1.5 Overview)
2. Overall Description (2.1 Product Perspective, 2.2 Product Functions, 2.3 User Characteristics, 2.4 Constraints, 2.5 Assumptions and Dependencies)
3. Specific Requirements (3.1 External Interface Requirements, 3.2 Functional Requirements with full detail, 3.3 Performance Requirements, 3.4 Logical Database Requirements, 3.5 Design Constraints, 3.6 Software System Attributes)
4. Appendices (Traceability Matrix, Glossary)
Use REAL data from the project context. Generate comprehensive content for each section.`,

      sad: `Generate a comprehensive Software Architecture Document (SAD) following IEEE 1471/ISO 42010 and the 4+1 View Model. Include:
1. Introduction (Purpose, Scope, Definitions, References)
2. Architectural Representation (Views used, rationale)
3. Architectural Goals and Constraints
4. Use-Case View (Key use cases, sequence descriptions)
5. Logical View (Package/component structure, class relationships)
6. Process View (Concurrency, threading, process interactions)
7. Deployment View (Physical nodes, network topology, deployment mapping)
8. Implementation View (Source organization, build structure)
9. Data View (ER model, data flow, storage strategy)
10. Size and Performance (Capacity, throughput, latency targets)
11. Quality Attributes (Availability, Scalability, Security, Maintainability analysis)
12. Architecture Decisions (ADRs with context, decision, rationale, consequences)
13. Cross-Cutting Concerns (Logging, Security, Error Handling, Caching)
14. Infrastructure & Deployment Strategy
Use REAL data from the project context including all artifacts from architecture design stages.`,

      assessment: `Generate a comprehensive Architecture Assessment Report based on ATAM (Architecture Tradeoff Analysis Method). Include:
1. Executive Summary
2. Assessment Methodology (ATAM overview, stakeholders involved)
3. Business Drivers and Quality Attribute Requirements
4. Architectural Approach Summary
5. Quality Attribute Utility Tree
6. Quality Attribute Scenarios and Analysis
7. Sensitivity Points (architectural decisions sensitive to quality attributes)
8. Tradeoff Points (decisions affecting multiple quality attributes)
9. Risk Assessment (identified risks with severity, likelihood, mitigation)
10. Non-Risks (areas of architectural soundness)
11. Findings and Recommendations
12. Compliance Assessment (against identified standards)
13. Appendix: Traceability Matrix
Use REAL data from the project context including quality evaluation, risk analysis, and validation artifacts.`,

      full_package: `Generate a complete Architecture Package document — the definitive deliverable for this project. Include ALL of the following 21 sections:
1. Executive Summary
2. System Goal and Context
3. Requirement Summary (functional, non-functional, constraints)
4. Architectural Drivers
5. Style Recommendation and Justification
6. Alternatives Considered
7. Tradeoff Analysis
8. Decision Rationale
9. System Decomposition (components, responsibilities, interfaces)
10. Architectural Viewpoints (4+1 View Model, ISO 42010, TOGAF views)
11. Data Architecture (entities, relationships, storage strategy)
12. Interface and API Design (endpoints, contracts, integration patterns)
13. Cross-Cutting Concerns Strategy (security, observability, caching, resilience)
14. Infrastructure and Deployment Design (topology, CI/CD, scaling, environments)
15. Diagram Set (describe key diagrams: system context, container, component, deployment, ER, sequence)
16. Architecture Decision Records (ADRs)
17. Traceability Matrix (requirements → components → decisions)
18. Quality Attribute Evaluation
19. Validation and Governance Report
20. Risks, Assumptions, and Dependencies
21. Handoff Notes and Implementation Guidance
Use ALL available project data to create a comprehensive, production-ready architecture document.`,
    };

    const systemPrompt = `You are a senior enterprise architect generating formal architecture documentation. 
You produce professional, standards-compliant documents with proper section numbering, detailed analysis, and actionable content.
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

CRITICAL: Use REAL data from the provided project context. Do NOT use placeholder text. Every section must contain substantive, project-specific content.
If certain data is not available, note it as "Data not yet generated for this stage" rather than making up content.
CRITICAL: Include mermaid_code diagrams wherever visual representation adds value — system context, component diagrams, ER diagrams, sequence diagrams, deployment diagrams, etc.`;

    const { resolvePrompt } = await import("../_shared/prompts.ts");
    const systemPromptResolved = await resolvePrompt(
      supabase,
      "generate-document.system",
      systemPrompt,
    );

    const userPrompt = `${docTemplates[document_type] || docTemplates.full_package}

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
