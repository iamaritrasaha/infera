import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div>
          <Link href="/" className="brand">
            <Image src="/infera-icon.svg" width={28} height={28} alt="" />
            <span>Infera</span>
          </Link>
          <p>
            Turn data into evidence.
            <br />
            Independent, open-source, Python-first.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/dashboard">Workspace</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/about">About</Link>
          <a
            href="https://github.com/iamaritrasaha/infera"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={12} />
          </a>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>Created and developed by Aritra Saha.</span>
        <span>
          MIT License <span className="mx-3">/</span> Real calculations.
          Transparent evidence.
        </span>
      </div>
    </footer>
  );
}
