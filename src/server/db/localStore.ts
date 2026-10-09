import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../env";
import type { Insert, ListOptions, Patch, Row, Store, TableName } from "./types";

/**
 * Zero-setup development store: one JSON file in .perrie/ (gitignored).
 * Used automatically until Supabase credentials are configured, so the
 * dashboard and profile work straight after `pnpm dev`. Not for production.
 */

type Data = { [K in TableName]?: Row<K>[] };


export class LocalStore implements Store {
  readonly kind = "local" as const;
  private data: Data = {};
  private mtimeMs = -1;
  private readonly file = path.join(dataDir(), "dev-store.json");

  private load() {
    if (!existsSync(this.file)) return;
    const m = statSync(this.file).mtimeMs;
    if (m === this.mtimeMs) return;
    try {
      this.data = JSON.parse(readFileSync(this.file, "utf8")) as Data;
      this.mtimeMs = m;
    } catch {
      // A torn read during another process's write: keep the last good copy.
    }
  }

  private save() {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    renameSync(tmp, this.file);
    this.mtimeMs = statSync(this.file).mtimeMs;
  }

  private rows<T extends TableName>(table: T): Row<T>[] {
    this.load();
    const existing = this.data[table] as Row<T>[] | undefined;
    if (existing) return existing;
    const fresh: Row<T>[] = [];
    (this.data as Record<string, unknown>)[table] = fresh;
    return fresh;
  }

  async insert<T extends TableName>(table: T, row: Insert<T>): Promise<Row<T>> {
    const now = new Date().toISOString();
    const full = { created_at: now, ...row, id: row.id ?? randomUUID(), updated_at: now } as Row<T>;
    const rows = this.rows(table);
    if (rows.some((r) => r.id === full.id)) throw new Error(`${table}: duplicate id ${full.id}`);
    rows.push(full);
    this.save();
    return structuredClone(full);
  }

  async upsert<T extends TableName>(table: T, row: Insert<T> & { id: string }): Promise<Row<T>> {
    const rows = this.rows(table);
    const i = rows.findIndex((r) => r.id === row.id);
    if (i === -1) return this.insert(table, row);
    rows[i] = { ...rows[i], ...row, updated_at: new Date().toISOString() } as Row<T>;
    this.save();
    return structuredClone(rows[i]);
  }

  async update<T extends TableName>(table: T, id: string, patch: Patch<T>): Promise<Row<T>> {
    const rows = this.rows(table);
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) throw new Error(`${table}: no row ${id}`);
    rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() } as Row<T>;
    this.save();
    return structuredClone(rows[i]);
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const r = this.rows(table).find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }

  async list<T extends TableName>(table: T, opts: ListOptions<T> = {}): Promise<Row<T>[]> {
    let out = this.rows(table).filter((r) =>
      Object.entries(opts.where ?? {}).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v),
    );
    const key = opts.orderBy ?? "created_at";
    const dir = opts.ascending === false ? -1 : 1;
    out = [...out].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[key] as string | number;
      const bv = (b as unknown as Record<string, unknown>)[key] as string | number;
      return av === bv ? 0 : av > bv ? dir : -dir;
    });
    if (opts.limit) out = out.slice(0, opts.limit);
    return structuredClone(out);
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const rows = this.rows(table);
    const i = rows.findIndex((r) => r.id === id);
    if (i !== -1) {
      rows.splice(i, 1);
      this.save();
    }
  }
}
