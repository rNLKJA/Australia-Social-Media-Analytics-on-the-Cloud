"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { forgetKeys, getKey, maskKey, saveSettings, setKey } from "@/lib/ai/settings";
import { ANTHROPIC_MODELS, type AiSettings, DEFAULT_OPENAI_MODEL, type Provider } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "social-sense:open-ai-settings";

/** Open the AI settings dialog from anywhere on the page. */
export function openAiSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Header button + dialog. Mounted once, in the site header. */
export function AiSettingsDialog() {
  const { settings, hasKey } = useAiSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground relative gap-1.5"
        onClick={() => setOpen(true)}
        aria-label={hasKey ? "AI settings (your key is set)" : "AI settings (optional, bring your own key)"}
        title="AI settings"
      >
        <KeyRound className="size-4" aria-hidden />
        <span className="hidden xl:inline">AI</span>
        {hasKey && <span className="bg-sent-pos absolute top-1 right-1 size-1.5 rounded-full" aria-hidden />}
      </Button>
      {open && <SettingsBody initial={settings} onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

function SettingsBody({ initial, onDone }: { initial: AiSettings; onDone: () => void }) {
  const ids = { key: useId(), model: useId(), remember: useId(), keyHelp: useId() };
  const [draft, setDraft] = useState<AiSettings>(initial);
  const [keyDraft, setKeyDraft] = useState("");
  // only ever rendered in the browser, after the dialog opens
  const [stored, setStored] = useState<Record<Provider, string | null>>(() => ({
    anthropic: getKey("anthropic"),
    openai: getKey("openai"),
  }));
  const [status, setStatus] = useState<string | null>(null);

  const current = stored[draft.provider];

  const save = () => {
    const next = { ...draft, openaiModel: draft.openaiModel.trim() || DEFAULT_OPENAI_MODEL };
    saveSettings(next);
    if (keyDraft.trim()) setKey(next.provider, keyDraft, next.remember);
    else if (current) setKey(next.provider, current, next.remember); // re-file under the new "remember" choice
    setKeyDraft("");
    setStored({ anthropic: getKey("anthropic"), openai: getKey("openai") });
    setStatus("Saved.");
    onDone();
  };

  const forget = () => {
    forgetKeys();
    setStored({ anthropic: null, openai: null });
    setKeyDraft("");
    setStatus("Keys removed from this browser.");
  };

  return (
    <DialogContent aria-describedby={ids.keyHelp}>
      <DialogHeader>
        <p className="kicker">Optional · bring your own key</p>
        <DialogTitle>AI settings</DialogTitle>
        <DialogDescription id={ids.keyHelp}>
          The AI features use your own API key. It stays in this browser and is sent only to the provider you
          pick, directly from your browser. This site&apos;s server never receives it. Everything else on the
          site works without a key.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Provider</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["anthropic", "openai"] as const).map((p) => (
            <label
              key={p}
              className={cn(
                "border-border hover:border-primary/60 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                draft.provider === p && "border-primary bg-primary/5",
              )}
            >
              <input
                type="radio"
                name="provider"
                value={p}
                checked={draft.provider === p}
                onChange={() => setDraft({ ...draft, provider: p })}
                className="accent-[var(--primary)]"
              />
              {p === "anthropic" ? "Anthropic (default)" : "OpenAI"}
            </label>
          ))}
        </div>
      </fieldset>

      {draft.provider === "anthropic" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Model</legend>
          {ANTHROPIC_MODELS.map((m) => (
            <label
              key={m.id}
              className="border-border hover:border-primary/60 flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="anthropic-model"
                value={m.id}
                checked={draft.anthropicModel === m.id}
                onChange={() => setDraft({ ...draft, anthropicModel: m.id })}
                className="mt-1 accent-[var(--primary)]"
              />
              <span>
                <span className="font-medium">{m.label}</span>{" "}
                <span className="text-muted-foreground font-mono text-xs">{m.id}</span>
                <span className="text-muted-foreground block text-xs">{m.note}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor={ids.model} className="text-sm font-medium">
            Model id
          </label>
          <input
            id={ids.model}
            value={draft.openaiModel}
            onChange={(e) => setDraft({ ...draft, openaiModel: e.target.value })}
            spellCheck={false}
            autoComplete="off"
            className="border-input bg-card focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <p className="text-muted-foreground text-xs">
            Any chat model your key can use that supports structured outputs (default{" "}
            <code>{DEFAULT_OPENAI_MODEL}</code>).
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={ids.key} className="text-sm font-medium">
          {draft.provider === "anthropic" ? "Anthropic" : "OpenAI"} API key
        </label>
        <input
          id={ids.key}
          type="password"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder={
            current ? `Stored: ${maskKey(current)}` : draft.provider === "anthropic" ? "sk-ant-…" : "sk-…"
          }
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          className="border-input bg-card focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <label htmlFor={ids.remember} className="flex items-start gap-2 pt-1 text-sm">
          <input
            id={ids.remember}
            type="checkbox"
            checked={draft.remember}
            onChange={(e) => setDraft({ ...draft, remember: e.target.checked })}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span>
            Remember on this device
            <span className="text-muted-foreground block text-xs">
              Off: kept for this tab only (sessionStorage). On: kept in this browser profile (localStorage)
              until you forget it.
            </span>
          </span>
        </label>
      </div>

      <div className="border-border bg-muted/40 flex gap-2 rounded-md border p-3 text-xs leading-relaxed">
        <ShieldCheck className="text-sent-pos mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-muted-foreground">
          Calls are billed to your key by the provider. One question makes two calls (writing the SQL, then
          explaining the rows). Every call is recorded in an{" "}
          <Link className="link" href="/ai-log">
            audit log
          </Link>{" "}
          kept only in this browser, without the key. Read the{" "}
          <Link className="link" href="/methods#ai-use">
            AI use statement
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="destructive"
          size="sm"
          onClick={forget}
          disabled={!stored.anthropic && !stored.openai}
        >
          Forget key
        </Button>
        <div className="flex items-center gap-3">
          {status && (
            <span role="status" className="text-muted-foreground text-xs">
              {status}
            </span>
          )}
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </DialogContent>
  );
}
