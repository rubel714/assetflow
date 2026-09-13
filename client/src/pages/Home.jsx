import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearAuth, homePath, isSiteAdmin, isActingAsOrganization } from "../lib/globalfunction";

const STEPS = [
  {
    title: "Register assets",
    body: "Create a tagged register with categories, locations, and photos so every item has a home.",
  },
  {
    title: "Assign to people",
    body: "Hand assets to employees with a recorded assignment so custody is always clear.",
  },
  {
    title: "Scan and track",
    body: "Look up an item by QR code and see who holds it, where it sits, and its current status.",
  },
  {
    title: "Maintain and warranties",
    body: "Open work orders and watch warranty windows before coverage or service slips.",
  },
  {
    title: "Transfer or return",
    body: "Move custody between people or return the asset to the pool when the job is done.",
  },
];

export default function Home({ user, onLogout }) {
  const navigate = useNavigate();
  const workspacePath = user ? homePath(user) : "/dashboard";
  const workspaceLabel =
    user && isSiteAdmin(user) && !isActingAsOrganization(user)
      ? "Go to organizations"
      : "Go to dashboard";

  function handleLogout() {
    clearAuth();
    if (typeof onLogout === "function") {
      onLogout();
    }
    navigate("/");
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-enter">
      <section className="grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted mb-3">Asset lifecycle management</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: "var(--text-main)" }}>
            Manage Every Asset. <span className="text-accent">Every Stage.</span>
          </h2>
          <p className="text-muted text-sm md:text-base max-w-xl mb-8">
            AssetFlow helps teams register equipment, assign and transfer custody, scan QR codes, track warranties,
            and run maintenance from one workspace — from first tag to return.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-5 py-3 rounded-xl bg-red-500/15 text-red-400 font-bold hover:bg-red-500/25 transition-colors"
                >
                  Logout
                </button>
                <Link
                  to={workspacePath}
                  className="px-5 py-3 rounded-xl bg-cyan-600 text-white font-bold shadow-lg hover:bg-cyan-500 transition-colors"
                >
                  {workspaceLabel}
                </Link>
              </>
            ) : (
              <Link
                to="/login"
                className="px-5 py-3 rounded-xl bg-cyan-600 text-white font-bold shadow-lg hover:bg-cyan-500 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
        <div className="glass rounded-2xl overflow-hidden border border-white/10">
          <img
            src="/home-hero.png"
            alt="AssetFlow workspace showing asset tracking, QR scan, and handover"
            className="w-full h-full object-cover min-h-[16rem]"
          />
        </div>
      </section>

      <section>
        <h3 className="text-xl md:text-2xl font-bold mb-2">How it works</h3>
        <p className="text-muted text-sm mb-6">A simple path from register to return.</p>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="glass rounded-2xl p-5 border border-white/10">
              <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-2">
                Step {index + 1}
              </p>
              <h4 className="font-semibold mb-2">{step.title}</h4>
              <p className="text-muted text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
