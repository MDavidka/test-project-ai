import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cosmic Baker — Premium Cookie Clicker",
  description: "A highly addictive, beautiful, and feature-rich Cookie Clicker game built with Next.js, Framer Motion, and Web Audio API synthesis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased selection:bg-primary/30">
        {children}
      </body>
    </html>
  );
}
