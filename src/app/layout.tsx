import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { DemoProvider } from "@/state/DemoProvider";

export const metadata: Metadata = {
  title: "S-Compass · competition prototype",
  description: "Shared local knowledge for better last-mile delivery decisions. Business Challenge 2026, team BCE004.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#ee4d2d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoProvider>
          <AppShell>{children}</AppShell>
        </DemoProvider>
      </body>
    </html>
  );
}
