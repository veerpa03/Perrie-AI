import {
  Activity,
  AudioLines,
  Brain,
  CalendarDays,
  Contact,
  Database,
  FileText,
  Github,
  Mail,
  Phone,
  Plug,
  Sheet,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/** Icon keys used by app integrations and voice-stack services. */
const ICONS: Record<string, LucideIcon> = {
  // app integrations (current + ready for the next ones)
  calendar: CalendarDays,
  contacts: Contact,
  spreadsheet: Sheet,
  github: Github,
  mail: Mail,
  document: FileText,
  // voice stack / monitoring
  phone: Phone,
  waves: AudioLines,
  brain: Brain,
  database: Database,
  activity: Activity,
  sparkles: Sparkles,
};

export const integrationIcon = (key: string): LucideIcon => ICONS[key] ?? Plug;
