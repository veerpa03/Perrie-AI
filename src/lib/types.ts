export type SequenceName = "ascent" | "descent";

export interface SequenceManifest {
  sequence: SequenceName;
  count: number;
  sourceWidth: number;
  sourceHeight: number;
  aspect: number;
  tiers: Record<"lg" | "sm", { width: number; height: number; path: string }>;
  frames: string[];
}
