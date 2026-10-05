"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineRequest, PipelineResponse } from "@/workers/pipeline.worker";

type Status = "loading" | "ready" | "error";

/** Score posts in a Web Worker; keeps only the latest response. */
export function usePipelineWorker() {
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<Extract<PipelineResponse, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("../workers/pipeline.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<PipelineResponse>) => {
      if (e.data.id !== seq.current) return;
      if (e.data.ok) {
        setResult(e.data);
        setStatus("ready");
        setError(null);
      } else {
        setStatus("error");
        setError(e.data.error);
      }
    };
    w.onerror = () => {
      setStatus("error");
      setError("The scoring worker could not start in this browser.");
    };
    return () => w.terminate();
  }, []);

  const score = useCallback((text: string, place: string) => {
    const id = ++seq.current;
    const msg: PipelineRequest = { id, text, place };
    worker.current?.postMessage(msg);
  }, []);

  return { status, result, error, score };
}
