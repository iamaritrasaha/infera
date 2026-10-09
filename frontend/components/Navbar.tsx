"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { EngineIndicator } from "./EngineConnection";

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="site-nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <Image src="/infera-icon.svg" width={34} height={34} alt="" />
          <span>
            Infera<span className="brand-label">Open Source</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="nav-links">
          {[
            ["/", "Platform"],
            ["/dashboard", "Dashboard"],
            ["/docs", "Documentation"],
            ["/about", "About"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <EngineIndicator />
      </div>
    </header>
  );
}
