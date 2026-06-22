"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, LayoutDashboard, Siren, Map, TrendingUp, Gauge, Route, IndianRupee,
  Car, History, ShieldCheck, Radio, Bot, Search, Theater, Sun, Moon, Languages, Compass,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useLanguage, LANG_LABELS, Lang } from "./LanguageProvider";
import { useTranslation } from "@/lib/useTranslation";

const NAV = [
  { href: "/", key: "nav.home", icon: Home },
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/alerts", key: "nav.alerts", icon: Siren },
  { href: "/map", key: "nav.map", icon: Map },
  { href: "/forecast", key: "nav.forecast", icon: TrendingUp },
  { href: "/congestion", key: "nav.congestion", icon: Gauge },
  { href: "/patrol", key: "nav.patrol", icon: Route },
  { href: "/economic", key: "nav.economic", icon: IndianRupee },
  { href: "/offenders", key: "nav.offenders", icon: Car },
  { href: "/evolution", key: "nav.evolution", icon: History },
  { href: "/trust", key: "nav.trust", icon: ShieldCheck },
  { href: "/copilot", key: "nav.copilot", icon: Bot },
  { href: "/how-it-works", key: "nav.howItWorks", icon: Compass },
];

const TOOLS = [
  { href: "/investigate", key: "nav.investigate", icon: Search },
  { href: "/scenarios", key: "nav.scenarios", icon: Theater },
];

const LANGS: Lang[] = ["en", "hi", "kn"];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { lang, setLang } = useLanguage();
  const { t } = useTranslation();

  const cycleLang = () => {
    const idx = LANGS.indexOf(lang);
    setLang(LANGS[(idx + 1) % LANGS.length]);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 shrink-0 border-r border-border bg-sidebar-bg flex flex-col" style={{ boxShadow: "1px 0 0 var(--border)" }}>
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-amber/15 flex items-center justify-center">
              <Radio size={16} className="text-amber" />
            </div>
            <div>
              <div className="font-display font-semibold text-[15px] leading-tight tracking-tight">{t("common.brand")}</div>
              <div className="text-[10px] text-text-muted font-mono tracking-wider">{t("common.brandSub")}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                  active
                    ? "bg-amber/10 text-amber font-medium"
                    : "text-text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Icon size={16} strokeWidth={2} />
                {t(item.key)}
              </Link>
            );
          })}

          <div className="pt-3 mt-3 border-t border-border">
            <div className="px-3 pb-1.5 text-[10px] text-text-muted uppercase tracking-wide">{t("nav.demoTools")}</div>
            {TOOLS.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                    active ? "bg-amber/10 text-amber font-medium" : "text-text-muted hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                  {t(item.key)}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="px-4 py-4 border-t border-border">
          <div className="text-[10px] text-text-muted font-mono leading-relaxed">
            {t("common.footer1")}
            <br />
            {t("common.footer2")}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 shrink-0 border-b border-border bg-sidebar-bg/70 backdrop-blur flex items-center justify-between px-6">
          <div className="text-[13px] text-text-muted">
            {t("nav.tagline")}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[11px] font-mono text-teal">
              <span className="w-1.5 h-1.5 rounded-full bg-teal live-blink" />
              {t("common.live")} &middot; {t("common.hotspotsTracked")}
            </div>
            <button
              onClick={cycleLang}
              className="h-8 px-2.5 rounded-lg border border-border flex items-center gap-1.5 text-[11px] font-medium hover:bg-surface-2 transition-colors"
              aria-label="Change language"
            >
              <Languages size={13} />
              {LANG_LABELS[lang]}
            </button>
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-surface-2 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-bg">{children}</main>
      </div>
    </div>
  );
}
