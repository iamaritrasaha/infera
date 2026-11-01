"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { checkEngineHealth } from "@/lib/api";

export function Navbar() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const verifyHealth = async () => {
      const ok = await checkEngineHealth();
      if (active) setIsOnline(ok);
    };

    verifyHealth();
    const interval = setInterval(verifyHealth, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/infera-icon.svg" width={30} height={30} alt="Infera Logo" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg text-slate-100">Infera</span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/60">
              Open Source
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline === true
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                  : isOnline === false
                    ? "bg-rose-500"
                    : "bg-amber-400 animate-pulse"
              }`}
            />
            <span>{isOnline === true ? "Engine Connected" : isOnline === false ? "Engine Offline" : "Connecting..."}</span>
          </div>

          <a
            href="https://github.com/iamaritrasaha/infera"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            GitHub <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
    </header>
  );
}
