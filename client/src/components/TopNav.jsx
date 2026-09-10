import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getSavedUser, hasPermission, roleLabel } from "../lib/globalfunction";
import { ORG_SECTIONS } from "../lib/orgSections";
import ThemeToggle from "./ThemeToggle";
import { assetImageSrc } from "../lib/assetImage";

export default function TopNav({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const orgMenuRef = useRef(null);
  const user = getSavedUser();
  const canSetup = hasPermission(user, "setup.manage");
  const orgSections = ORG_SECTIONS.filter((item) => {
    if (item.key === "settings") return hasPermission(user, "org.manage");
    return canSetup;
  });
  const orgActive = location.pathname.startsWith("/organization");

  const links = [
    { to: "/", label: "Dashboard", end: true, show: true },
    { to: "/assets", label: "Assets", end: true, show: hasPermission(user, "assets.read") },
    { to: "/assets/new", label: "Add Asset", show: hasPermission(user, "assets.manage") },
    { to: "/organization/audit", label: "Audit", show: hasPermission(user, "setup.manage") },
    { to: "/users", label: "Users", show: hasPermission(user, "users.read") },
  ].filter((link) => link.show);

  useEffect(() => {
    function handleClick(event) {
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target)) {
        setOrgOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setOrgOpen(false);
    setOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    clearAuth();
    if (typeof onLogout === "function") {
      onLogout();
    }
    setOpen(false);
    setOrgOpen(false);
    navigate("/login");
  }

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "text-accent bg-cyan-500/15"
        : "text-muted hover:opacity-80 hover:bg-white/5"
    }`;

  const orgButtonClass = `px-3 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1 ${
    orgActive
      ? "text-accent bg-cyan-500/15"
      : "text-muted hover:opacity-80 hover:bg-white/5"
  }`;

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--text-accent)",
            }}
          >
            <svg
              className="w-5 h-5 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">
              {import.meta.env.VITE_SITE_TITLE || "AssetFlow"}
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-muted">
              {user?.OrganizationName || "Asset Management"}
            </p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {links
            .filter((link) => link.to !== "/users")
            .map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          {orgSections.length > 0 && (
            <div className="relative" ref={orgMenuRef}>
              <button
                type="button"
                className={orgButtonClass}
                aria-expanded={orgOpen}
                aria-haspopup="true"
                onClick={() => setOrgOpen((v) => !v)}
              >
                Organization
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {orgOpen && (
                <div className="absolute left-0 top-full mt-2 min-w-[13rem] max-h-[min(24rem,calc(100dvh-5rem))] overflow-y-auto glass rounded-xl py-1 shadow-lg z-[60]">
                  {orgSections.map((item) => (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      className={({ isActive }) =>
                        `block px-4 py-2 text-sm ${
                          isActive ? "text-accent bg-cyan-500/15" : "text-muted hover:bg-white/5"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
          {links
            .filter((link) => link.to === "/users")
            .map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
        </nav>

          <div className="hidden md:flex items-center gap-3">
          {assetImageSrc(user?.ImageUrl) ? (
            <img
              src={assetImageSrc(user.ImageUrl)}
              alt=""
              className="h-9 w-9 rounded-full object-cover border border-white/10"
            />
          ) : null}
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">
              {user?.FullName || user?.Username || "User"}
            </p>
            <p className="text-[11px] text-accent">{roleLabel(user?.Role)}</p>
          </div>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-full text-red-400 transition-colors"
            aria-label="Log out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>

        <button
          className="md:hidden p-2 rounded-lg hover:bg-white/10"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 px-4 py-3 space-y-1">
          {links
            .filter((link) => link.to !== "/users")
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `block ${linkClass({ isActive })}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          {orgSections.length > 0 && (
            <div className="pt-1">
              <p className={`px-3 py-2 text-xs uppercase tracking-widest ${orgActive ? "text-accent" : "text-muted"}`}>
                Organization
              </p>
              {orgSections.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) => `block ${linkClass({ isActive })}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
          {links
            .filter((link) => link.to === "/users")
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `block ${linkClass({ isActive })}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {assetImageSrc(user?.ImageUrl) ? (
                <img
                  src={assetImageSrc(user.ImageUrl)}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover border border-white/10 shrink-0"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.FullName || user?.Username}</p>
                <p className="text-[11px] text-accent">{roleLabel(user?.Role)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm rounded-lg bg-red-500/10 text-red-400"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
