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
  themeColor: "#006C38",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans">
        {/* Apply the saved appearance before first paint — no light/dark flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=JSON.parse(localStorage.getItem("mugis.theme.v1")||"{}");var r=document.documentElement;if(t.mode==="dark")r.classList.add("dark");r.setAttribute("data-accent",t.accent||"forest");}catch(e){}})();',
          }}
        />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
