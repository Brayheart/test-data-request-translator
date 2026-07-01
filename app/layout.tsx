import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Test Data Request Translator",
  description: "AI intake, deterministic validation, and human review for banking test-data requests."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
