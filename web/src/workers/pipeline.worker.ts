/**
 * Runs the ported 2023 pipeline off the main thread. Loading the WordNet noun
 * list (~118k lemmas) and the Punkt parameters takes ~100-300 ms; scoring a
 * post is well under a millisecond after that.
 */
import { fetchEngine } from "@/lib/nlp/engine";
import {
  geocodePlace,
  scorePost,
  type GeocodeResult,
  type NlpEngine,
  type PipelineTrace,
} from "@/lib/nlp/pipeline";

export type PipelineRequest = { id: number; text: string; place: string };
export type PipelineResponse =
  | { id: number; ok: true; trace: PipelineTrace; geo: GeocodeResult | null; ms: number }
  | { id: number; ok: false; error: string };

let engine: Promise<NlpEngine> | null = null;

self.onmessage = async (e: MessageEvent<PipelineRequest>) => {
  const { id, text, place } = e.data;
  try {
    engine ??= fetchEngine("/data/nlp/");
    const eng = await engine;
    const t0 = performance.now();
    const trace = scorePost(eng, text);
    const geo = place.trim() ? geocodePlace(eng.salLookup, place) : null;
    const res: PipelineResponse = { id, ok: true, trace, geo, ms: performance.now() - t0 };
    (self as unknown as Worker).postMessage(res);
  } catch (err) {
    engine = null;
    const res: PipelineResponse = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(res);
  }
};
