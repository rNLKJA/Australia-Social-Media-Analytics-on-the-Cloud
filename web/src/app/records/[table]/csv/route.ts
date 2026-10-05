import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { allRows, getTable, tableParamsSchema } from "@/server/records";

export async function GET(request: NextRequest, ctx: RouteContext<"/records/[table]/csv">) {
  const { table } = await ctx.params;
  const t = await getTable(table);
  if (!t) return new Response("Unknown table", { status: 404 });
  const parsed = tableParamsSchema.pick({ q: true }).safeParse({ q: request.nextUrl.searchParams.get("q") ?? undefined });
  const q = parsed.success ? parsed.data.q : "";
  const rows = await allRows(t, q);
  const csv = toCsv(
    t.columns.map((c) => c.name),
    rows,
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="social-sense-${t.name}${q ? "-filtered" : ""}.csv"`,
      "Cache-Control": q ? "no-store" : "public, max-age=3600",
    },
  });
}
