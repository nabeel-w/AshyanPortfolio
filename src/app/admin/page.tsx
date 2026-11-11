import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder overview. Real KPIs come from features/analytics (docs/04-analytics-dashboard.md).
const kpis = ["Visitors (7d)", "Video plays", "Avg. watch %", "New enquiries"];

export default function AdminOverview() {
  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Overview</p>
        <h1 className="font-serif text-4xl text-ivory">Good to see you.</h1>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k}>
            <CardHeader>
              <CardTitle className="label text-smoke">{k}</CardTitle>
            </CardHeader>
            <CardContent className="font-serif text-4xl text-ivory">—</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
