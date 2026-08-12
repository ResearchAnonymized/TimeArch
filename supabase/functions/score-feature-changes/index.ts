// Merit Scorer — neutral 5-criterion scoring for feature change proposals.
// Criteria (each 0-10, higher = more favorable to doing the change):
//   1. business_value      — user/business benefit if shipped
//   2. technical_feasibility — inverse of technical risk (10 = easy/safe)
//   3. effort_efficiency    — inverse of effort (10 = small/cheap)
//   4. dependency_clarity   — inverse of unknown dependencies (10 = self-contained)
//   5. urgency              — how time-sensitive is it
// Weighted score = mean of the five. Justification is one short paragraph.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callLlm, recoverJSON } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ok = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface FeatureChange {
  id: string;
  title: string;
  description: string | null;
  current_behavior: string | null;
  desired_behavior: string | null;
  change_type: string;
  priority: string;
}

interface Score {
  business_value: number;
  technical_feasibility: number;
  effort_efficiency: number;
  dependency_clarity: number;
  urgency: number;
  justification: string;
}

const SYSTEM = `You are a neutral, evidence-based software architecture assessor.
Score a proposed change on 5 criteria, each 0-10 (integers or one decimal).
Do NOT be optimistic or pessimistic; score strictly on the merits of the described change.
Return STRICT JSON matching this shape:
{
  "business_value": number,           // user/business benefit if delivered (10 = high)
  "technical_feasibility": number,    // 10 = easy/safe, 0 = very risky
  "effort_efficiency": number,        // 10 = small/cheap, 0 = huge undertaking
  "dependency_clarity": number,       // 10 = self-contained, 0 = many unknown dependencies
  "urgency": number,                  // 10 = must-do-now, 0 = can wait indefinitely
  "justification": string             // 2-3 sentences, plain English, explaining the scores
}`;

async function scoreOne(fc: FeatureChange): Promise<Score | null> {
  const userMsg = `Feature change proposal:
Title: ${fc.title}
Type: ${fc.change_type}
Stated priority: ${fc.priority}
Description: ${fc.description || "(none)"}
Current behavior: ${fc.current_behavior || "(none)"}
Desired behavior: ${fc.desired_behavior || "(none)"}

Score this proposal on the 5 criteria. Return JSON only.`;

  try {
    const res = await callLlm(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
      { json: true, temperature: 0.2 },
    );
    const parsed = recoverJSON<Score>(res.content);
    if (!parsed || typeof parsed.business_value !== "number") return null;
    return parsed;
  } catch (e) {
    console.error("scoreOne failed", (e as Error).message);
    return null;
  }
}

function weightedScore(s: Score): number {
  const avg = (s.business_value + s.technical_feasibility + s.effort_efficiency + s.dependency_clarity + s.urgency) / 5;
  return Math.round(avg * 10) / 10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { project_id, feature_change_ids } = await req.json().catch(() => ({}));
    if (!project_id) return ok({ error: "project_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let query = admin
      .from("feature_changes")
      .select("id,title,description,current_behavior,desired_behavior,change_type,priority")
      .eq("project_id", project_id);
    if (Array.isArray(feature_change_ids) && feature_change_ids.length > 0) {
      query = query.in("id", feature_change_ids);
    }
    const { data: changes, error } = await query;
    if (error) return ok({ error: error.message }, 500);
    if (!changes || changes.length === 0) return ok({ scored: 0, results: [] });

    const results: Array<{ id: string; score: number | null }> = [];
    for (const fc of changes as FeatureChange[]) {
      const score = await scoreOne(fc);
      if (!score) {
        results.push({ id: fc.id, score: null });
        continue;
      }
      const merit = weightedScore(score);
      const breakdown = {
        business_value: score.business_value,
        technical_feasibility: score.technical_feasibility,
        effort_efficiency: score.effort_efficiency,
        dependency_clarity: score.dependency_clarity,
        urgency: score.urgency,
      };
      const { error: upErr } = await admin
        .from("feature_changes")
        .update({
          merit_score: merit,
          merit_breakdown: breakdown,
          merit_justification: score.justification,
          merit_scored_at: new Date().toISOString(),
        })
        .eq("id", fc.id);
      if (upErr) console.error("update failed", upErr.message);
      results.push({ id: fc.id, score: merit });
    }

    return ok({ scored: results.filter((r) => r.score !== null).length, results });
  } catch (e) {
    return ok({ error: (e as Error).message }, 500);
  }
});
