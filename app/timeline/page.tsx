"use client";
import dynamic from "next/dynamic";

const PromiseTimeline = dynamic(() => import("@/components/PromiseTimeline"), { ssr: false, loading: () => <p className="p-4">Loading…</p> });

export default function TimelinePage() {
  return (
    <main className="h-screen w-full p-2">
      <PromiseTimeline />
    </main>
  );
}
