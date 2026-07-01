import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";

interface Props {
  scores: Record<string, { score: number; evidence: string }>;
}

const LABELS: Record<string, string> = {
  business_fit: "Business Fit",
  technical_health: "Technical Health",
  change_velocity: "Change Velocity",
  operational_cost: "Operational Cost",
  risk: "Risk Posture",
  strategic_alignment: "Strategic Alignment",
};

export default function DimensionRadar({ scores }: Props) {
  const data = Object.entries(scores || {}).map(([k, v]) => ({
    dimension: LABELS[k] ?? k,
    score: Number(v?.score ?? 0),
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <PolarRadiusAxis domain={[0, 5]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.35}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
