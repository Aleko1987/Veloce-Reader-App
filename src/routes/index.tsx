import { createFileRoute } from "@tanstack/react-router";
import { veloceHeadMeta } from "@/lib/site-meta";
import { SpeedReader } from "@/components/SpeedReader";
import { HomeScreen } from "@/components/HomeScreen";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";
import { useReaderStore } from "@/store/reader-store";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: veloceHeadMeta(),
    links: [{ rel: "manifest", href: "/manifest.json" }],
  }),
});

function Index() {
  const view = useReaderStore((s) => s.view);

  return (
    <main className="min-h-screen bg-black text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <h1 className="text-sm font-mono tracking-widest uppercase">
            Veloce Reader
          </h1>
        </div>
        <span className="text-xs text-zinc-600 font-mono uppercase tracking-widest">
          {view} · v0.2
        </span>
      </header>
      <section className="flex-1 flex items-start justify-center px-6 py-12 md:py-16">
        {view === "home" && <HomeScreen />}
        {view === "dashboard" && <AnalysisDashboard />}
        {view === "reader" && <SpeedReader />}
      </section>
    </main>
  );
}
