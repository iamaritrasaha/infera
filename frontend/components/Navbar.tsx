"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchHealth } from "@/lib/api";
import { Activity, BarChart3, Binary, ShieldCheck } from "lucide-react";

export function Navbar() {
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(() => setIsBackendHealthy(true))
      .catch(() => setIsBackendHealthy(false));
  }, []);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Binary className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-white">Infera</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                SaaS MVP
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Turn data into evidence.</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-6 text-xs font-medium text-slate-300">
          <Link
            href="/"
            className="px-2.5 py-1.5 rounded-md hover:text-white hover:bg-slate-900 transition-colors"
          >
            New Analysis
          </Link>
          <Link
            href="/dashboard"
            className="px-2.5 py-1.5 rounded-md hover:text-white hover:bg-slate-900 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/docs"
            className="px-2.5 py-1.5 rounded-md hover:text-white hover:bg-slate-900 transition-colors"
          >
            Documentation
          </Link>
          <Link
            href="/about"
            className="px-2.5 py-1.5 rounded-md hover:text-white hover:bg-slate-900 transition-colors"
          >
            About
          </Link>
        </nav>

        {/* Engine Status indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
              isBackendHealthy === true
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : isBackendHealthy === false
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendHealthy === true
                  ? "bg-emerald-400 animate-pulse"
                  : isBackendHealthy === false
                  ? "bg-rose-400"
                  : "bg-slate-500"
              }`}
            />
            <span className="hidden sm:inline">
              {isBackendHealthy === true ? "Engine Online" : isBackendHealthy === false ? "Engine Offline" : "Connecting..."}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
