import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChemLab",
  description:
    "A virtual chemistry lab shared by a human and an AI agent. The human has hands, the agent has WebMCP tools, both act on the same experiment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
