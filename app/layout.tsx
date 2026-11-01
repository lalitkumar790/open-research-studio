import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Research Studio",
  description: "An independent workspace for scientific writing and research projects."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}