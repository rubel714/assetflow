import React from "react";
import { Link } from "react-router-dom";

const PILLARS = [
  {
    title: "One register",
    body: "Tag every laptop, vehicle, and tool so the organization can search, filter, and export what it owns.",
  },
  {
    title: "Clear custody",
    body: "Assign, transfer, and return with a recorded trail so you always know who holds an asset.",
  },
  {
    title: "Keep them running",
    body: "Scan QR codes, watch warranties, and open maintenance work so service happens before an item is lost.",
  },
];

export default function About() {
  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-enter">
      <section className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-muted mb-3">About us</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: "var(--text-main)" }}>
          Built for the full <span className="text-accent">asset lifecycle</span>
        </h2>
        <p className="text-muted text-sm md:text-base leading-relaxed">
          AssetFlow is a multi-tenant asset management workspace for SMEs, factories, NGOs, and project-based
          teams. We help organizations register equipment, assign it to people, and follow it through scan, service,
          and return — from the first tag to the last handover.
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {PILLARS.map((item) => (
          <div key={item.title} className="glass rounded-2xl p-6 border border-white/10">
            <h3 className="font-semibold mb-2">{item.title}</h3>
            <p className="text-muted text-sm leading-relaxed">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="glass rounded-2xl p-6 md:p-8 border border-white/10">
        <h3 className="text-xl font-bold mb-3">Who we serve</h3>
        <p className="text-muted text-sm md:text-base leading-relaxed mb-6">
          Operations, asset managers, and employees share one system with roles that match the work: organization
          admins run the tenant, managers keep the register current, and employees see what is assigned to them.
        </p>
        <Link
          to="/contact"
          className="inline-flex px-5 py-3 rounded-xl bg-cyan-600 text-white font-bold shadow-lg hover:bg-cyan-500 transition-colors"
        >
          Contact us
        </Link>
      </section>
    </div>
  );
}
