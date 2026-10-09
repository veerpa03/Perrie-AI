"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { runBluejayToolAction, type BluejayRunState } from "@/actions/bluejay";
import type { BluejayTool } from "@/server/monitoring/bluejay/client";
import ResultView from "./ResultView";
import { FieldLabel, fieldClass, insetField, Pill, RainbowButton } from "./ui";

type Grouped = { family: string; tools: BluejayTool[] }[];

/** Pick any Bluejay tool, fill its inputs (form generated from its JSON schema), run it. */
export default function BluejayRunner({ groups, initialTool }: { groups: Grouped; initialTool?: string }) {
  const all = useMemo(() => groups.flatMap((g) => g.tools), [groups]);
  const [name, setName] = useState(initialTool && all.some((t) => t.name === initialTool) ? initialTool : all[0]?.name);
  const tool = all.find((t) => t.name === name);
  const [state, action, pending] = useActionState<BluejayRunState, FormData>(runBluejayToolAction, null);
  const props = Object.entries(tool?.inputSchema?.properties ?? {});
  const required = new Set(tool?.inputSchema?.required ?? []);

  if (!all.length) return <p className="text-sm text-[color:var(--color-slate)]/55">Bluejay didn&apos;t list any tools.</p>;

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel htmlFor="bj-tool">Bluejay tool</FieldLabel>
        <select id="bj-tool" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} style={insetField}>
          {groups.map((g) => (
            <optgroup key={g.family} label={g.family}>
              {g.tools.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.annotations?.title ?? t.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {tool?.description && <p className="mt-2 text-sm text-[color:var(--color-slate)]/65">{tool.description}</p>}
        {tool?.annotations?.destructiveHint && (
          <Pill tone="coral" className="mt-2">
            Changes or deletes data in Bluejay
          </Pill>
        )}
      </div>

      <form action={action} key={name} className="space-y-3" aria-label={`Run ${name}`}>
        <input type="hidden" name="__tool" value={name} />
        {props.length === 0 && <p className="text-xs text-[color:var(--color-slate)]/55">No inputs needed.</p>}
        {props.map(([key, schema]) => {
          const id = `bj-arg-${key}`;
          const type = Array.isArray(schema.type) ? schema.type.find((x) => x !== "null") : schema.type;
          const label = (
            <FieldLabel htmlFor={id} hint={[type, required.has(key) ? "required" : ""].filter(Boolean).join(" · ")}>
              {key}
            </FieldLabel>
          );
          const def = schema.default !== undefined ? String(typeof schema.default === "object" ? JSON.stringify(schema.default) : schema.default) : "";
          return (
            <div key={key}>
              {label}
              {schema.enum ? (
                <select id={id} name={`arg:${key}`} defaultValue={def} className={fieldClass} style={insetField}>
                  {!required.has(key) && <option value="">—</option>}
                  {schema.enum.map((v) => (
                    <option key={String(v)} value={String(v)}>
                      {String(v)}
                    </option>
                  ))}
                </select>
              ) : type === "boolean" ? (
                <select id={id} name={`arg:${key}`} defaultValue={def} className={fieldClass} style={insetField}>
                  <option value="">—</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : type === "object" || type === "array" ? (
                <textarea id={id} name={`arg:${key}`} rows={3} defaultValue={def} placeholder="JSON" className={`${fieldClass} font-mono`} style={insetField} />
              ) : (
                <input
                  id={id}
                  name={`arg:${key}`}
                  type={type === "number" || type === "integer" ? "number" : "text"}
                  defaultValue={def}
                  required={required.has(key)}
                  className={fieldClass}
                  style={insetField}
                />
              )}
              {schema.description && <p className="mt-1 text-xs text-[color:var(--color-slate)]/50">{schema.description}</p>}
            </div>
          );
        })}
        <RainbowButton type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          Run
        </RainbowButton>
      </form>

      {state && (
        <div className="rounded-3xl p-4" style={{ background: state.ok ? "rgba(221,245,236,0.6)" : "rgba(255,231,227,0.7)" }} aria-live="polite">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/55">
            {state.tool} {state.ok ? "· result" : "· failed"}
          </p>
          {state.message && <p className="mb-2 text-sm font-bold text-[#B5403A]">{state.message}</p>}
          <ResultView data={state.result} />
        </div>
      )}
    </div>
  );
}
