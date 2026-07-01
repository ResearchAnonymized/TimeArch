import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Props {
  effort: Record<string, number>;
}

const ORDER = ["S", "M", "L", "XL"];
const COLORS: Record<string, string> = {
  S: "hsl(142 71% 45%)",
  M: "hsl(217 91% 60%)",
  L: "hsl(38 92% 50%)",
  XL: "hsl(0 84% 60%)",
};

export default function EffortBar({ effort }: Props) {
  const data = ORDER.map((k) => ({ band: k, count: Number(effort?.[k] ?? 0) }));

  return (
    <div className="w-full h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="band" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8, fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={COLORS[d.band]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
