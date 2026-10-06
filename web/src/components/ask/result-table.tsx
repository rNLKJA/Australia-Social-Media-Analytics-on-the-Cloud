"use client";

import { BarList } from "@/components/charts/bar-list";
import { ScatterPlot } from "@/components/charts/scatter-plot";
import { fmtInt } from "@/lib/format";
import type { Cell } from "@/lib/sql/compare";
import { cn } from "@/lib/utils";

function fmtCell(v: Cell): string {
  if (v === null) return "null";
  if (typeof v === "number") {
    // separators only from 10,000 up, so years and small counts stay as typed
    if (Number.isInteger(v)) return Math.abs(v) >= 10000 ? v.toLocaleString("en-AU") : String(v);
    return Number(v.toPrecision(6)).toString();
  }
  return v;
}

/** Query results with numbered rows (r1, r2, ...) that answers can cite. */
export function ResultTable({
  columns,
  rows,
  highlighted,
  idPrefix,
  caption,
}: {
  columns: string[];
  rows: Cell[][];
  highlighted?: Set<number>;
  idPrefix: string;
  caption: string;
}) {
  return (
    <div className="border-border bg-card relative max-h-[28rem] overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/80 sticky top-0 backdrop-blur">
          <tr>
            <th
              scope="col"
              className="text-muted-foreground w-10 px-2 py-2 text-left font-mono text-[11px] font-medium"
            >
              row
            </th>
            {columns.map((c, i) => (
              <th
                key={`${c}${i}`}
                scope="col"
                className="px-3 py-2 text-left font-mono text-xs font-medium whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              id={`${idPrefix}-r${i + 1}`}
              className={cn(
                "border-border/60 scroll-mt-24 border-t transition-colors",
                highlighted?.has(i + 1) && "bg-highlight/60",
              )}
            >
              <td className="text-muted-foreground px-2 py-1.5 font-mono text-[11px]">r{i + 1}</td>
              {r.map((v, j) => (
                <td
                  key={j}
                  className={cn(
                    "max-w-[24rem] px-3 py-1.5 align-top",
                    typeof v === "number" ? "num text-right whitespace-nowrap" : "break-words",
                    v === null && "text-muted-foreground/60",
                  )}
                >
                  {fmtCell(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const isNum = (v: Cell) => typeof v === "number";

/**
 * A chart chosen from the shape of the result: a single row becomes figures,
 * one label + one non-negative number becomes bars, two numbers become a
 * scatter. Anything else gets no chart rather than a misleading one.
 */
export function AutoChart({ columns, rows }: { columns: string[]; rows: Cell[][] }) {
  if (!rows.length || !columns.length) return null;
  const numericCols = columns.map(
    (_, j) => rows.every((r) => r[j] === null || isNum(r[j])) && rows.some((r) => isNum(r[j])),
  );
  const textCols = columns.map((_, j) => rows.every((r) => typeof r[j] === "string" || r[j] === null));

  if (rows.length === 1) {
    return (
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {columns.map((c, j) => (
          <div key={`${c}${j}`} className="border-border bg-card rounded-md border px-3 py-2">
            <dt className="text-muted-foreground truncate font-mono text-[11px]">{c}</dt>
            <dd className="num font-serif text-xl font-semibold break-words">
              {typeof rows[0][j] === "number" && Number.isInteger(rows[0][j])
                ? fmtInt(rows[0][j] as number)
                : fmtCell(rows[0][j])}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  const label = textCols.findIndex(Boolean);
  const value = numericCols.findIndex(Boolean);
  if (
    label >= 0 &&
    value >= 0 &&
    rows.length <= 30 &&
    rows.every((r) => r[value] === null || (r[value] as number) >= 0)
  ) {
    return (
      <BarList
        ariaLabel={`${columns[value]} by ${columns[label]}`}
        items={rows.map((r, i) => ({
          key: `${i}`,
          label: String(r[label] ?? "null"),
          value: (r[value] as number | null) ?? 0,
          display: r[value] === null ? "null" : fmtCell(r[value]),
          color: "var(--chart-1)",
        }))}
      />
    );
  }

  const nums = numericCols.map((b, j) => (b ? j : -1)).filter((j) => j >= 0);
  if (nums.length >= 2 && rows.length >= 3) {
    const [xj, yj] = nums;
    const pts = rows.map((r, i) => ({ r, i })).filter(({ r }) => isNum(r[xj]) && isNum(r[yj]));
    return (
      <ScatterPlot
        points={pts.map(({ r, i }) => ({
          id: String(i),
          x: r[xj] as number,
          y: r[yj] as number,
          n: 1,
          label: label >= 0 ? String(r[label]) : `r${i + 1}`,
          color: "var(--chart-1)",
        }))}
        xLabel={columns[xj]}
        yLabel={columns[yj]}
        xFormat={(v) => Number(v.toPrecision(3)).toLocaleString("en-AU")}
        yFormat={(v) => Number(v.toPrecision(3)).toLocaleString("en-AU")}
        ariaLabel={`Scatter plot of ${columns[yj]} against ${columns[xj]} for ${pts.length} rows.`}
        height={300}
      />
    );
  }
  return (
    <p className="text-muted-foreground text-sm">
      No chart for this shape of result; the table has everything.
    </p>
  );
}
