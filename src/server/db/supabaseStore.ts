import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Insert, ListOptions, Patch, Row, Store, TableName } from "./types";

/**
 * Supabase backend. Uses the server-only secret (service-role) key; every
 * table has RLS enabled with no policies, so nothing is reachable with the
 * public key. This client must never be created in the browser.
 */
export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, key: string) {
    this.db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private fail(table: string, op: string, error: { message: string } | null): never {
    throw new Error(`Supabase ${op} ${table}: ${error?.message ?? "unknown error"}`);
  }

  async insert<T extends TableName>(table: T, row: Insert<T>): Promise<Row<T>> {
    const { data, error } = await this.db.from(table).insert(row as never).select().single();
    if (error || !data) this.fail(table, "insert", error);
    return data as Row<T>;
  }

  async upsert<T extends TableName>(table: T, row: Insert<T> & { id: string }): Promise<Row<T>> {
    const { data, error } = await this.db.from(table).upsert(row as never).select().single();
    if (error || !data) this.fail(table, "upsert", error);
    return data as Row<T>;
  }

  async update<T extends TableName>(table: T, id: string, patch: Patch<T>): Promise<Row<T>> {
    const { data, error } = await this.db.from(table).update(patch as never).eq("id", id).select().single();
    if (error || !data) this.fail(table, "update", error);
    return data as Row<T>;
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const { data, error } = await this.db.from(table).select().eq("id", id).maybeSingle();
    if (error) this.fail(table, "get", error);
    return (data as Row<T> | null) ?? null;
  }

  async list<T extends TableName>(table: T, opts: ListOptions<T> = {}): Promise<Row<T>[]> {
    let q = this.db.from(table).select();
    for (const [k, v] of Object.entries(opts.where ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v as never);
    q = q.order(opts.orderBy ?? "created_at", { ascending: opts.ascending !== false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) this.fail(table, "list", error);
    return (data ?? []) as Row<T>[];
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const { error } = await this.db.from(table).delete().eq("id", id);
    if (error) this.fail(table, "delete", error);
  }
}
