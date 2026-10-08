import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  authors: [{ name: "Aritra Saha", url: "https://github.com/iamaritrasaha" }],
  creator: "Aritra Saha",
  metadataBase: new URL("https://infera-omega.vercel.app"),
  openGraph: { title: "Infera", description: "Turn data into evidence.", images: [{ url: "/infera-icon.png", width: 512, height: 512, alt: "Infera" }] },
  twitter: { card: "summary", title: "Infera", images: ["/infera-icon.png"] },
  title: "Infera: Automated Data Science Platform | Turn Data Into Evidence",
  description:
    "Upload structured datasets and automatically profile quality, formulate problems, test hypotheses, compare machine learning models, and generate evidence-backed findings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Navbar />
        <main id="main-content" className="flex-1 min-w-0">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
