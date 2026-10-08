import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Shield, Lock } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-900 bg-slate-950/80 text-xs text-slate-400 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-2 font-bold text-slate-200 text-sm tracking-tight"><Image src="/infera-icon.svg" width={24} height={24} alt="" />Infera</span>
            <p className="text-slate-400">
              The automated empirical data science platform. Infera doesn&apos;t guess. It computes, validates, and explains.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <Link href="/docs" className="hover:text-slate-200 transition-colors">Documentation</Link>
            <Link href="/about" className="hover:text-slate-200 transition-colors">About</Link>
            <a
              href="https://github.com/iamaritrasaha/infera"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-900/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1 text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> In-Memory Processing &bull; Zero Permanent Storage
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <Lock className="w-3.5 h-3.5 text-blue-400" /> ₹0 Zero-Budget Stack
            </span>
          </div>
          <div>
            Created and maintained independently by Aritra Saha · MIT License · Python + FastAPI
          </div>
        </div>
      </div>
    </footer>
  );
}
