import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Component {
  name: string;
  disposition: string;
}

interface Props {
  components: Component[];
}

const DISPOSITIONS = [
  "retain", "rehost", "replatform", "refactor",
  "rearchitect", "rebuild", "retire",
] as const;

const COLORS: Record<string, string> = {
  retain: "hsl(142 71% 45%)",
  rehost: "hsl(199 89% 48%)",
  replatform: "hsl(217 91% 60%)",
  refactor: "hsl(38 92% 50%)",
  rearchitect: "hsl(25 95% 53%)",
  rebuild: "hsl(0 84% 60%)",
  retire: "hsl(220 9% 46%)",
};

export default function ComponentDispositionBar({ components }: Props) {
  const counts: Record<string, number> = {};
  for (const c of components || []) counts[c.disposition] = (counts[c.disposition] || 0) + 1;
  const data = [{
    name: "Components",
    ...DISPOSITIONS.reduce((acc, d) => ({ ...acc, [d]: counts[d] || 0 }), {}),
  }];

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {DISPOSITIONS.map((d) => (
            <Bar key={d} dataKey={d} stackId="a" fill={COLORS[d]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
