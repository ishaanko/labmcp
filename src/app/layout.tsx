import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChemLab",
  description:
    "A virtual chemistry lab shared by a human and an AI agent. The human has hands, the agent has WebMCP tools, both act on the same experiment.",
};

// Runs before hydration so the first paint is never light-then-dark. Dark is the default;
// only an explicit "light" in localStorage (set by `useTheme`'s toggle) opts out.
const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("chemlab-theme")!=="light")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
