import {
  Activity,
  AudioLines,
  Brain,
  CalendarDays,
  Contact,
  Database,
  Phone,
  Plug,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  calendar: CalendarDays,
  contacts: Contact,
  phone: Phone,
  waves: AudioLines,
  brain: Brain,
  database: Database,
  activity: Activity,
  sparkles: Sparkles,
};

export const integrationIcon = (key: string): LucideIcon => ICONS[key] ?? Plug;
