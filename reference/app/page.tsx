import Link from "next/link";
import { Composer } from "@/components/Composer";
import { getEnv } from "@/lib/env";
import { capabilityReport, isOn } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

export default function Home() {
  const caps = capabilityReport();
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Standing Promise</h1>
      <p className="mb-6 text-neutral-500">One promise, one condition, one verdict computed in code.</p>
      <Composer />
      <nav className="mt-8 flex gap-4 text-sm">
        <Link href="/board" className="underline">Dashboard</Link>
        <Link href="/timeline" className="underline">Timeline</Link>
        {isOn("astropods") && (
          <a href={getEnv().ASTROPODS_AGENT_URL} target="_blank" rel="noreferrer" className="underline">Ask the Promise concierge</a>
        )}
      </nav>
      <ul className="mt-4 flex flex-wrap gap-2 text-[11px]" aria-label="Capabilities">
        {caps.map((c) => (
          <li key={c.id} title={c.note} className={`rounded px-2 py-0.5 ${c.on ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-500"}`}>
            {c.id} {c.on ? "on" : "off"}
          </li>
        ))}
      </ul>
    </main>
  );
}
