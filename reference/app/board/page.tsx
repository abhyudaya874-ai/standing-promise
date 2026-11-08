"use client";
import dynamic from "next/dynamic";

// Studio is browser-only; keep it out of the server render.
const StudioBoard = dynamic(() => import("@/components/studio/StudioBoard").then((m) => m.StudioBoard), { ssr: false, loading: () => <p className="p-4">Loading…</p> });

export default function BoardPage() {
  return <StudioBoard />;
}
