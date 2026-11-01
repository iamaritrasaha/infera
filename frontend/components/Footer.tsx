import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-900 bg-slate-950 py-8 text-xs text-slate-500">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span>Infera · Developed by Aritra Saha · MIT License</span>
        </div>
        <div className="flex items-center gap-6">
          <span>Real Python computations · Transparent evidence</span>
          <a
            href="https://github.com/iamaritrasaha/infera"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-slate-300 transition-colors"
          >
            Repository <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
    </footer>
  );
}
