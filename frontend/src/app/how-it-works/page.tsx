"use client";

import { useState } from "react";
import { Compass, ChevronDown } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

interface Section {
  title: string;
  what: string;
  how: string;
  detail?: string;
}

export default function HowItWorksPage() {
  const { t } = useTranslation();
  const sections: Section[] = t("howItWorks.sections");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div>
      <PageHeader title={t("howItWorks.title")} subtitle={t("howItWorks.subtitle")} icon={<Compass size={18} />} />

      <div className="px-8 mb-5">
        <Card className="p-4 border-amber/20 bg-amber/[0.04]">
          <p className="text-[12.5px] text-text-muted leading-relaxed">{t("howItWorks.intro")}</p>
        </Card>
      </div>

      <div className="px-8 mb-8 grid grid-cols-2 gap-4">
        {sections.map((s, i) => {
          const isOpen = openIndex === i;
          const hasDetail = !!s.detail;
          return (
            <Card key={i} className="p-5">
              <button
                onClick={() => hasDetail && setOpenIndex(isOpen ? null : i)}
                className={`w-full text-left flex items-start justify-between gap-2 ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="font-display font-semibold text-[15px]">{s.title}</div>
                {hasDetail && (
                  <ChevronDown
                    size={16}
                    className={`shrink-0 mt-0.5 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              <div className="mb-2 mt-2">
                <span className="text-[10px] text-amber uppercase tracking-wide font-medium">What</span>
                <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">{s.what}</p>
              </div>
              <div>
                <span className="text-[10px] text-cyan uppercase tracking-wide font-medium">How</span>
                <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">{s.how}</p>
              </div>
              {hasDetail && isOpen && (
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-[10px] text-teal uppercase tracking-wide font-medium">The Details</span>
                  <p className="text-[12px] text-text-muted leading-relaxed mt-0.5">{s.detail}</p>
                </div>
              )}
              {hasDetail && !isOpen && (
                <button
                  onClick={() => setOpenIndex(i)}
                  className="text-[11px] text-amber mt-3 hover:underline"
                >
                  See exact details &rarr;
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
