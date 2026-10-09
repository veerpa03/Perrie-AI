import { redirect } from "next/navigation";

/** Old address: Voice QA is now Monitoring. */
export default function VoiceQaRedirect() {
  redirect("/dashboard/monitoring");
}
