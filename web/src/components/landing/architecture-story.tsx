"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type NodeId = "twitter" | "mastodon" | "sudo" | "mpi" | "harvester" | "couch" | "views" | "flask" | "react" | "you";

interface Step {
  title: string;
  body: string;
  nodes: NodeId[];
  edges: string[];
  cloud?: boolean;
  stat: string;
}

const STEPS: Step[] = [
  {
    title: "Harvest",
    body: "MPI ranks split the 57 GB Twitter file by byte ranges and parse it line by line, while three Mastodon harvesters ask mastodon.social, mastodon.au and tictoc.social for the next 40 toots every ten minutes.",
    nodes: ["twitter", "mastodon", "mpi", "harvester"],
    edges: ["twitter-mpi", "mastodon-harvester"],
    stat: "37.8M tweets read · 1.66M toots",
  },
  {
    title: "Score and store",
    body: "Each post is cleaned, tokenised, lemmatised and scored by VADER on a 1-9 scale, matched to a suburb, then bulk-loaded 1,000 at a time into a CouchDB cluster replicated across three nodes.",
    nodes: ["mpi", "harvester", "couch"],
    edges: ["mpi-couch", "harvester-couch"],
    stat: "2.42M geotagged tweets",
  },
  {
    title: "Summarise with MapReduce",
    body: "CouchDB views emit every score keyed by suburb, once for all tweets and again for posts mentioning income or crime keywords, and a _stats reduce keeps count, sum, min and max.",
    nodes: ["couch", "views"],
    edges: ["couch-views"],
    stat: "3 views · 6,799 suburb summaries",
  },
  {
    title: "Serve and compare",
    body: "A Flask API joins the view results with SUDO income and crime tables and ABS boundaries, renders Plotly figures, gzips them, and a React dashboard draws them side by side.",
    nodes: ["views", "sudo", "flask", "react", "you"],
    edges: ["views-flask", "sudo-flask", "flask-react", "react-you"],
    stat: "37-46 MB of gzipped Plotly JSON per map",
  },
  {
    title: "Automate",
    body: "Ansible playbooks create the instances, volumes and security groups on the Melbourne Research Cloud, form the CouchDB cluster and deploy the services onto Docker Swarm, where they can be scaled with one script.",
    nodes: ["couch", "flask", "react", "harvester"],
    edges: [],
    cloud: true,
    stat: "8 vCPUs · 500 GB · 6 instances",
  },
];

const NODES: Record<NodeId, { x: number; y: number; w: number; label: string; sub: string }> = {
  twitter: { x: 20, y: 70, w: 128, label: "Twitter corpus", sub: "57 GB, via ADO" },
  mastodon: { x: 20, y: 200, w: 128, label: "Mastodon", sub: "3 public servers" },
  sudo: { x: 20, y: 380, w: 128, label: "SUDO", sub: "income · crime" },
  mpi: { x: 200, y: 70, w: 132, label: "MPI processors", sub: "mpi4py ranks" },
  harvester: { x: 200, y: 200, w: 132, label: "Harvesters", sub: "every 10 min" },
  couch: { x: 384, y: 128, w: 140, label: "CouchDB cluster", sub: "3 nodes, replicated" },
  views: { x: 384, y: 252, w: 140, label: "MapReduce views", sub: "_stats by suburb" },
  flask: { x: 384, y: 380, w: 140, label: "Flask API", sub: "Plotly JSON, gzip" },
  react: { x: 576, y: 380, w: 124, label: "React dashboard", sub: "maps + charts" },
  you: { x: 576, y: 252, w: 124, label: "You", sub: "any browser" },
};

const H_NODE = 52;
const mid = (id: NodeId, side: "l" | "r" | "t" | "b") => {
  const n = NODES[id];
  if (side === "l") return [n.x, n.y + H_NODE / 2];
  if (side === "r") return [n.x + n.w, n.y + H_NODE / 2];
  if (side === "t") return [n.x + n.w / 2, n.y];
  return [n.x + n.w / 2, n.y + H_NODE];
};

const EDGES: Record<string, string> = (() => {
  const line = (a: number[], b: number[]) => `M${a[0]},${a[1]} C${(a[0] + b[0]) / 2},${a[1]} ${(a[0] + b[0]) / 2},${b[1]} ${b[0]},${b[1]}`;
  const v = (a: number[], b: number[]) => `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
  return {
    "twitter-mpi": line(mid("twitter", "r"), mid("mpi", "l")),
    "mastodon-harvester": line(mid("mastodon", "r"), mid("harvester", "l")),
    "mpi-couch": line(mid("mpi", "r"), mid("couch", "l")),
    "harvester-couch": line(mid("harvester", "r"), mid("couch", "l")),
    "couch-views": v(mid("couch", "b"), mid("views", "t")),
    "views-flask": v(mid("views", "b"), mid("flask", "t")),
    "sudo-flask": line(mid("sudo", "r"), mid("flask", "l")),
    "flask-react": line(mid("flask", "r"), mid("react", "l")),
    "react-you": v(mid("react", "t"), mid("you", "b")),
  };
})();

function Diagram({ step }: { step: Step }) {
  const on = (id: NodeId) => step.nodes.includes(id);
  return (
    <svg viewBox="0 0 720 470" className="h-auto w-full" role="img" aria-label={`System diagram, highlighting: ${step.title}`}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--muted-foreground)" />
        </marker>
        <marker id="arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--primary)" />
        </marker>
      </defs>
      {/* Melbourne Research Cloud boundary */}
      <rect
        x={184}
        y={22}
        width={528}
        height={428}
        rx={14}
        fill={step.cloud ? "color-mix(in oklab, var(--primary) 7%, transparent)" : "none"}
        stroke={step.cloud ? "var(--primary)" : "var(--rule)"}
        strokeDasharray="6 5"
        strokeWidth={step.cloud ? 2 : 1}
        className="transition-all duration-500"
      />
      <text x={200} y={44} className={cn("font-sans text-[12px] font-semibold tracking-wider uppercase", step.cloud ? "fill-primary" : "fill-muted-foreground")}>
        Melbourne Research Cloud
      </text>
      <text x={700} y={44} textAnchor="end" className={cn("font-sans text-[11px]", step.cloud ? "fill-primary" : "fill-muted-foreground")}>
        Ansible · Docker Swarm
      </text>

      {Object.entries(EDGES).map(([id, d]) => {
        const active = step.edges.includes(id);
        return (
          <path
            key={id}
            d={d}
            fill="none"
            stroke={active ? "var(--primary)" : "var(--rule)"}
            strokeWidth={active ? 2.4 : 1.4}
            markerEnd={`url(#${active ? "arrow-on" : "arrow"})`}
            className={cn("transition-[stroke] duration-500", active && "flow")}
          />
        );
      })}

      {(Object.keys(NODES) as NodeId[]).map((id) => {
        const n = NODES[id];
        const active = on(id);
        return (
          <g key={id} className="transition-opacity duration-500" opacity={active ? 1 : 0.55}>
            <rect
              x={n.x}
              y={n.y}
              width={n.w}
              height={H_NODE}
              rx={9}
              fill={active ? "var(--card)" : "var(--muted)"}
              stroke={active ? "var(--primary)" : "var(--border)"}
              strokeWidth={active ? 2 : 1}
            />
            {id === "couch" &&
              [0, 1, 2].map((i) => (
                <circle
                  key={i}
                  cx={n.x + n.w - 18 - i * 12}
                  cy={n.y + 14}
                  r={4}
                  fill={active ? "var(--sent-8)" : "var(--rule)"}
                  className={cn(active && "pulse")}
                  style={{ animationDelay: `${i * 0.25}s` }}
                />
              ))}
            <text x={n.x + 12} y={n.y + 23} className="fill-foreground font-sans text-[13px] font-semibold">
              {n.label}
            </text>
            <text x={n.x + 12} y={n.y + 40} className="fill-muted-foreground font-sans text-[11px]">
              {n.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const FLOW: NodeId[][] = [["twitter", "mastodon"], ["mpi", "harvester"], ["couch"], ["views"], ["sudo", "flask"], ["react"]];

/** Small screens: the same highlighting as a readable chain of chips. */
function MobileFlow({ step }: { step: Step }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 sm:hidden" aria-label={`System components, highlighting: ${step.title}`}>
      {FLOW.map((group, gi) => (
        <li key={gi} className="flex items-center gap-1.5">
          {group.map((id) => (
            <span
              key={id}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors duration-300",
                step.nodes.includes(id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {NODES[id].label}
            </span>
          ))}
          {gi < FLOW.length - 1 && <span className="text-muted-foreground" aria-hidden>→</span>}
        </li>
      ))}
      <li className={cn("w-full text-[11px]", step.cloud ? "font-semibold text-primary" : "text-muted-foreground")}>
        All inside the Melbourne Research Cloud, deployed with Ansible and Docker Swarm
      </li>
    </ol>
  );
}

export function ArchitectureStory() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
      <div className="sticky top-14 z-10 -mx-4 self-start border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-3 lg:top-24 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="hidden sm:block">
          <Diagram step={STEPS[active]} />
        </div>
        <MobileFlow step={STEPS[active]} />
        <p className="mt-1 hidden text-center text-xs text-muted-foreground lg:block">
          Step {active + 1} of {STEPS.length}: {STEPS[active].title}
        </p>
      </div>
      <ol className="space-y-[34vh] pt-[4vh] pb-[20vh] lg:space-y-[38vh] lg:pt-[14vh]">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-step={i}
            className={cn(
              "rounded-lg border bg-card p-6 shadow-sm transition-all duration-500",
              i === active ? "border-primary/60 opacity-100" : "border-border opacity-50",
            )}
          >
            <p className="kicker">
              {String(i + 1).padStart(2, "0")} · {s.title}
            </p>
            <p className="mt-3 text-[1.05rem] leading-relaxed">{s.body}</p>
            <p className="num mt-4 font-serif text-lg font-semibold text-primary">{s.stat}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
