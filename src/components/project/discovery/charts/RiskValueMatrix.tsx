import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

interface Point {
  name: string;
  x: number; // business value
  y: number; // technical risk
  disposition: string;
  effort: string;
}

interface Props {
  points: Point[];
}

const COLORS: Record<string, string> = {
  retain: "hsl(142 71% 45%)",
  rehost: "hsl(199 89% 48%)",
  replatform: "hsl(217 91% 60%)",
  refactor: "hsl(38 92% 50%)",
  rearchitect: "hsl(25 95% 53%)",
  rebuild: "hsl(0 84% 60%)",
  retire: "hsl(220 9% 46%)",
};

export default function RiskValueMatrix({ points }: Props) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number" dataKey="x" name="Business Value" domain={[0, 5]}
            label={{
              value: "Business Value →", position: "insideBottom", offset: -8,
              fill: "hsl(var(--muted-foreground))", fontSize: 11,
            }}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="y" name="Technical Risk" domain={[0, 5]}
            label={{
              value: "Technical Risk →", angle: -90, position: "insideLeft",
              fill: "hsl(var(--muted-foreground))", fontSize: 11,
            }}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <ZAxis range={[80, 80]} />
          <ReferenceLine x={2.5} stroke="hsl(var(--border))" />
          <ReferenceLine y={2.5} stroke="hsl(var(--border))" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8, fontSize: 12,
            }}
            formatter={(value: any, name: any) => [value, name]}
            labelFormatter={() => ""}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="rounded-md border bg-card px-2 py-1.5 text-xs">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground">
                    {p.disposition} · effort {p.effort}
                  </p>
                  <p className="text-muted-foreground">
                    Value {p.x} · Risk {p.y}
                  </p>
                </div>
              );
            }}
          />
          <Scatter data={points}>
            {points.map((p, i) => (
              <Cell key={i} fill={COLORS[p.disposition] || "hsl(var(--primary))"} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
