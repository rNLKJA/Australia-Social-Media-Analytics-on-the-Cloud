import type { Geometry, Position } from "geojson";

/** Project a (Multi)Polygon into an SVG path string. */
export function toSvgPath(g: Geometry, project: (p: Position) => [number, number]): string {
  const rings: Position[][] =
    g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];
  return rings
    .map(
      (ring) =>
        ring
          .map(
            (p, i) =>
              `${i ? "L" : "M"}${project(p)
                .map((v) => v.toFixed(1))
                .join(",")}`,
          )
          .join("") + "Z",
    )
    .join("");
}
