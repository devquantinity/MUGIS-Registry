import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MUGIS — Upper GI Cancer Registry",
  description:
    "National registry for upper gastrointestinal cancer: structured data capture, secure role-based access, audit trail and reporting for MUGIS centres.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / home indicator; the shell pads with safe-area insets.
  viewportFit: "cover",
  themeColor: "#875F0A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // One fixed look: light, with the yellow accent (see src/lib/theme.tsx).
    <html lang="en" data-accent="amber" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
