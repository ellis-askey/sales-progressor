import Link from "next/link";

// Command Centre → Settings. A lean tools + pointers page. The read-only engine
// reference (milestones + reminder rules) now lives on its own /command/rules
// page; agency fees live on /command/agencies. What remains here is the
// occasional-use tooling and signposts to where config moved.

function Tile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 hover:border-neutral-700 transition-colors block"
    >
      <p className="text-sm font-semibold text-neutral-100">{title}</p>
      <p className="text-[12.5px] text-neutral-500 mt-1 leading-relaxed">{body}</p>
      <span className="text-xs text-blue-400 mt-2 inline-block">Open →</span>
    </Link>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">Occasional tools, and where the platform&rsquo;s configuration lives.</p>
      </div>

      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Tile
            href="/admin/migrate"
            title="Migrate a sale"
            body="Move an existing sale onto the platform and set its milestones to where it really is."
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Tile
            href="/command/rules"
            title="Rules"
            body="The steps of a sale and the reminder rules. Read-only reference for how the engine is set up."
          />
          <Tile
            href="/command/agencies"
            title="Agency fees"
            body="Set a per-agency legacy fee override, or leave an agency on the standard sliding scale."
          />
          <Tile
            href="/command/audit"
            title="Activity log"
            body="Every milestone, note, status and message change across files."
          />
        </div>
      </section>
    </div>
  );
}
