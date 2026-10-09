/**
 * Generic, readable rendering for JSON coming back from MCP tools (Bluejay):
 * arrays of records become tables, records become key/value lists, scores
 * get a coloured chip. Safe on server and client.
 */

const PREFERRED = ["name", "title", "status", "score", "result", "passed", "pass_rate", "success_rate", "latency", "created_at", "id"];
const isScalar = (v: unknown) => v == null || ["string", "number", "boolean"].includes(typeof v);

function findList(data: Record<string, unknown>): unknown[] | null {
  for (const k of ["items", "data", "results", "runs", "agents", "simulations", "monitors", "alerts", "metrics", "records"]) {
    if (Array.isArray(data[k])) return data[k] as unknown[];
  }
  const arrays = Object.values(data).filter(Array.isArray);
  return arrays.length === 1 ? (arrays[0] as unknown[]) : null;
}

function Cell({ k, v }: { k: string; v: unknown }) {
  if (typeof v === "boolean") {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: v ? "#DDF5EC" : "#FFE7E3", color: v ? "#1C7F62" : "#B5403A" }}>
        {v ? "yes" : "no"}
      </span>
    );
  }
  if (typeof v === "number" && /score|rate|accuracy|pass|percent|csat/i.test(k)) {
    const pct = v <= 1 ? v * 100 : v;
    const good = pct >= 80;
    const ok = pct >= 60;
    return (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-bold"
        style={{ background: good ? "#DDF5EC" : ok ? "#FFF0D6" : "#FFE7E3", color: good ? "#1C7F62" : ok ? "#A2620F" : "#B5403A" }}
      >
        {v <= 1 ? `${Math.round(pct)}%` : v}
      </span>
    );
  }
  if (typeof v === "string" && /status|state/i.test(k)) {
    const good = /pass|success|complete|healthy|up|ok|active/i.test(v);
    const bad = /fail|error|down|critical/i.test(v);
    return (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-bold"
        style={{ background: good ? "#DDF5EC" : bad ? "#FFE7E3" : "#EEE8FD", color: good ? "#1C7F62" : bad ? "#B5403A" : "#5E43C7" }}
      >
        {v}
      </span>
    );
  }
  const s = v == null ? "—" : String(v);
  return <span title={s.length > 60 ? s : undefined}>{s.length > 60 ? `${s.slice(0, 58)}…` : s}</span>;
}

function Table({ rows }: { rows: Record<string, unknown>[] }) {
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter((k) => isScalar(r[k])))));
  const cols = [...PREFERRED.filter((k) => keys.includes(k)), ...keys.filter((k) => !PREFERRED.includes(k))].slice(0, 6);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="whitespace-nowrap px-2 pb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 25).map((r, i) => (
            <tr key={i} className="border-t border-[color:var(--color-slate)]/[0.07]">
              {cols.map((c) => (
                <td key={c} className="px-2 py-2 align-top text-[color:var(--color-slate)]/85">
                  <Cell k={c} v={r[c]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 25 && <p className="mt-2 text-xs text-[color:var(--color-slate)]/50">+{rows.length - 25} more</p>}
    </div>
  );
}

export default function ResultView({ data }: { data: unknown }) {
  if (data == null || data === "") return <p className="text-sm text-[color:var(--color-slate)]/55">Nothing returned.</p>;
  if (typeof data === "string") {
    return <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm text-[color:var(--color-slate)]/85">{data}</pre>;
  }
  if (Array.isArray(data)) {
    if (!data.length) return <p className="text-sm text-[color:var(--color-slate)]/55">Empty list.</p>;
    if (data.every((r) => r && typeof r === "object" && !Array.isArray(r))) return <Table rows={data as Record<string, unknown>[]} />;
    return <pre className="text-sm">{JSON.stringify(data, null, 2)}</pre>;
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const list = findList(obj);
    if (list) return <ResultView data={list} />;
    const scalars = Object.entries(obj).filter(([, v]) => isScalar(v));
    const nested = Object.entries(obj).filter(([, v]) => !isScalar(v));
    return (
      <div className="space-y-3">
        {scalars.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {scalars.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-bold text-[color:var(--color-slate)]/55">{k.replace(/_/g, " ")}</dt>
                <dd className="text-[color:var(--color-slate)]/85">
                  <Cell k={k} v={v} />
                </dd>
              </div>
            ))}
          </dl>
        )}
        {nested.map(([k, v]) => (
          <details key={k} className="rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(245,239,231,0.8)" }}>
            <summary className="cursor-pointer font-bold text-[color:var(--color-slate)]/60">{k.replace(/_/g, " ")}</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(v, null, 2)}</pre>
          </details>
        ))}
      </div>
    );
  }
  return <span>{String(data)}</span>;
}
