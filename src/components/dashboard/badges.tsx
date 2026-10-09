import { Pill, type Accent } from "./ui";

const ROLE: Record<string, { tone: Accent; label: string }> = {
  owner: { tone: "lilac", label: "You" },
  guest: { tone: "sky", label: "Caller" },
  delegate: { tone: "amber", label: "On your behalf" },
  unverified: { tone: "slate", label: "Unverified" },
};

export function RoleBadge({ role }: { role: string }) {
  const r = ROLE[role] ?? ROLE.unverified;
  return <Pill tone={r.tone}>{r.label}</Pill>;
}

const TASK: Record<string, { tone: Accent; label: string }> = {
  planning: { tone: "sky", label: "Planning" },
  awaiting_approval: { tone: "amber", label: "Needs your OK" },
  running: { tone: "lilac", label: "Running" },
  waiting: { tone: "pink", label: "On a call" },
  completed: { tone: "mint", label: "Done" },
  failed: { tone: "coral", label: "Stopped" },
  canceled: { tone: "slate", label: "Canceled" },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const s = TASK[status] ?? { tone: "slate" as Accent, label: status };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

const STEP: Record<string, { tone: Accent; label: string }> = {
  pending: { tone: "slate", label: "Up next" },
  running: { tone: "lilac", label: "Working" },
  waiting: { tone: "pink", label: "Waiting for call" },
  succeeded: { tone: "mint", label: "Done" },
  failed: { tone: "coral", label: "Failed" },
  skipped: { tone: "slate", label: "Skipped" },
};

export function StepStatusBadge({ status }: { status: string }) {
  const s = STEP[status] ?? { tone: "slate" as Accent, label: status };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function CallStatusBadge({ status }: { status: string }) {
  const tone: Accent =
    status === "completed"
      ? "mint"
      : status === "in-progress"
        ? "lilac"
        : ["busy", "no-answer", "failed", "canceled"].includes(status)
          ? "coral"
          : "sky";
  return <Pill tone={tone}>{status.replace(/[-_]/g, " ")}</Pill>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone: Accent = severity === "block" ? "coral" : severity === "warn" ? "amber" : "sky";
  return <Pill tone={tone}>{severity === "block" ? "Blocked" : severity === "warn" ? "Warning" : "Info"}</Pill>;
}
