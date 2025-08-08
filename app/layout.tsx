import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Lang Trainer", description: "Drag-and-drop sentence builder" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="cs"><body>{children}</body></html>);
}