"use client";

import { useState } from "react";
import { Bot, Send, Info } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

interface Message {
  role: "user" | "assistant";
  text: string;
}

// Always sent to the backend in English, since the copilot's rule-based
// intent matching is keyword-based on English phrases.
const EXAMPLES_EN = [
  "Which hotspot should I prioritize?",
  "How much money can be saved?",
  "Show the top emerging hotspots",
  "Which zones are critical?",
  "What's the total economic loss?",
  "What's next week's forecast?",
];

export default function CopilotPage() {
  const { t } = useTranslation();
  const examplesLocalized: string[] = t("copilot.examples");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: t("copilot.welcome") },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/copilot?question=${encodeURIComponent(question)}`
      );
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Couldn't reach the backend - is it running?" }]);
    }
    setLoading(false);
  };

  return (
    <div>
      <PageHeader title={t("copilot.title")} subtitle={t("copilot.subtitle")} icon={<Bot size={18} />} />

      <div className="px-8">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-2 border border-border mb-5 text-[11.5px] text-text-muted">
          <Info size={14} className="shrink-0 mt-0.5 text-cyan" />
          {t("copilot.infoText")}
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="h-[420px] overflow-y-auto p-5 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3.5 py-2.5 rounded-xl text-[13px] ${
                  m.role === "user" ? "bg-amber text-bg" : "bg-surface-2 border border-border"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div className="text-[12px] text-text-muted font-mono">{t("copilot.thinking")}</div>}
          </div>

          <div className="border-t border-border p-3 flex flex-wrap gap-2">
            {EXAMPLES_EN.map((q, i) => (
              <button key={q} onClick={() => ask(q)} className="text-[11px] px-3 py-1.5 rounded-full bg-surface-2 border border-border hover:border-amber/40 transition-colors">
                {examplesLocalized[i] || q}
              </button>
            ))}
          </div>

          <div className="border-t border-border p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask(input)}
              placeholder={t("copilot.inputPlaceholder")}
              className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-amber/50"
            />
            <button onClick={() => ask(input)} className="px-4 rounded-lg bg-amber text-bg flex items-center justify-center hover:bg-amber/90 transition-colors">
              <Send size={15} />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
