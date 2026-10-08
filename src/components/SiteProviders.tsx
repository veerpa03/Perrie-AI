"use client";

import { AudioProvider } from "./AudioProvider";
import { DemoModalProvider } from "./DemoModal";

/**
 * Client providers shared across the landing page: the ambient audio
 * controller and the interactive demo dialog. Kept in one client boundary so
 * the page itself can stay a server component.
 */
export default function SiteProviders({ children }: { children: React.ReactNode }) {
  return (
    <AudioProvider>
      <DemoModalProvider>{children}</DemoModalProvider>
    </AudioProvider>
  );
}
