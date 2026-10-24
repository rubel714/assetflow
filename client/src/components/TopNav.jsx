import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  clearAuth,
  getActingOrganization,
  getSavedUser,
  hasPermission,
  isActingAsOrganization,
  isSiteAdmin,
  roleLabel,
  setActingOrganization,
} from "../lib/globalfunction";
import { ORG_SECTIONS } from "../lib/orgSections";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import { assetImageSrc } from "../lib/assetImage";

function dropdownButtonClass(active) {
  return `px-3 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1 ${
    active ? "text-accent bg-cyan-500/15" : "text-muted hover:opacity-80 hover:bg-white/5"
  }`;
}

function NavDropdown({ label, active, open, setOpen, onOpen, menuRef, items }) {
  return (
    <div className="relative z-[90]" ref={menuRef}>
      <button
        type="button"
        className={dropdownButtonClass(active)}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() =>
          setOpen((v) => {
            const next = !v;
            if (next && typeof onOpen === "function") onOpen();
            return next;
          })
        }
      >
        {label}
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="nav-dropdown absolute left-0 top-full mt-2 min-w-[13rem] max-h-[min(24rem,calc(100dvh-5rem))] overflow-y-auto rounded-xl py-1">
          {items.map((item) => (
            <NavLink
              key={item.key || item.to}
              to={item.to}
              end={item.end}
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
  );
}

export default function TopNav({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const orgMenuRef = useRef(null);
  const assetMenuRef = useRef(null);
  const user = getSavedUser();
  const acting = getActingOrganization();
  const siteAdmin = isSiteAdmin(user);
  const actingAsOrg = isActingAsOrganization(user);
  const orgWorkspace = Boolean(user) && !(siteAdmin && !actingAsOrg);
  const canSetup = hasPermission(user, "setup.manage");
  const orgSections = actingAsOrg || !siteAdmin
    ? ORG_SECTIONS.filter((item) => {
        if (item.permission) return hasPermission(user, item.permission);
        if (item.key === "settings") return hasPermission(user, "org.manage");
        return canSetup;
      })
    : [];
  const assetSections = orgWorkspace
    ? [
        { key: "my-assets", to: "/my-assets", label: "My Assets", show: hasPermission(user, "assets.accept") },
        { key: "requests", to: "/requests", label: "Requests", show: hasPermission(user, "requests.create") },
        { key: "assets", to: "/assets", label: "Assets", end: true, show: hasPermission(user, "assets.read") },
        { key: "scan", to: "/scan", label: "Scan", show: hasPermission(user, "assets.read") },
        { key: "add-asset", to: "/assets/new", label: "New Asset", show: hasPermission(user, "assets.manage") },
      ].filter((item) => item.show)
    : [];
  const orgActive = location.pathname.startsWith("/organization");
  const assetActive =
    location.pathname.startsWith("/my-assets") ||
    location.pathname.startsWith("/requests") ||
    location.pathname.startsWith("/assets") ||
    location.pathname.startsWith("/scan");
  const displayOrgName = acting?.Name || user?.OrganizationName;
  const displayOrgCode = acting?.Code || user?.OrganizationCode;
  const displayOrgLogo = acting?.LogoUrl || user?.OrganizationLogoUrl;

  const homeLink = { to: "/", label: "Home", end: true, show: true };
  const infoLinks = [
    { to: "/about", label: "About Us", show: true },
    { to: "/contact", label: "Contact Us", show: true },
  ];
  const leadingPaths = new Set(["/", "/dashboard"]);
  const trailingPaths = new Set(["/users", "/about", "/contact"]);
  const links = !user
    ? [homeLink, ...infoLinks]
    : siteAdmin && !actingAsOrg
    ? [homeLink, { to: "/admin/organizations", label: "Organizations", end: true, show: true }, ...infoLinks]
    : [
        homeLink,
        { to: "/dashboard", label: "Dashboard", end: true, show: true },
        { to: "/warranties", label: "Warranties", show: hasPermission(user, "assets.read") },
        { to: "/maintenance", label: "Maintenance", show: hasPermission(user, "maintenance.request") },
        { to: "/reports", label: "Reports", show: hasPermission(user, "reports.export") },
        { to: "/users", label: "Users", show: hasPermission(user, "users.read") },
        { to: "/admin/organizations", label: "Organizations", show: siteAdmin && hasPermission(user, "site.manage") },
        ...infoLinks,
      ].filter((link) => link.show);

  useEffect(() => {
    function handleClick(event) {
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target)) {
        setOrgOpen(false);
      }
      if (assetMenuRef.current && !assetMenuRef.current.contains(event.target)) {
        setAssetOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setOrgOpen(false);
    setAssetOpen(false);
    setOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    clearAuth();
    if (typeof onLogout === "function") {
      onLogout();
    }
    setOpen(false);
    setOrgOpen(false);
    setAssetOpen(false);
    navigate("/");
  }

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "text-accent bg-cyan-500/15"
        : "text-muted hover:opacity-80 hover:bg-white/5"
    }`;

  function handleExitOrganization() {
    setActingOrganization(null);
    setOpen(false);
    navigate("/admin/organizations");
  }

  return (
    <header className="sticky top-0 z-[80] glass border-b border-white/10">
      {actingAsOrg && (
        <div className="px-4 md:px-6 py-2 bg-amber-500/15 border-b border-amber-400/20 text-sm flex items-center justify-between gap-3">
          <p>
            Viewing <span className="font-semibold">{displayOrgName}</span> as site admin
          </p>
          <button
            type="button"
            onClick={handleExitOrganization}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold"
          >
            Exit organization
          </button>
        </div>
      )}
      <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          {displayOrgLogo ? (
            <img
              src={assetImageSrc(displayOrgLogo)}
              alt={displayOrgName || "Organization"}
              className="w-9 h-9 rounded-full object-contain bg-white/10 border border-white/10"
            />
          ) : (
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
          )}
          <div>
            <h1 className="font-bold text-base leading-tight">
              {import.meta.env.VITE_SITE_TITLE || "AssetFlow"}
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-muted">
              {!user
                ? "Asset Management"
                : siteAdmin && !actingAsOrg
                  ? "Site administration"
                  : displayOrgCode
                    ? `${displayOrgCode} · ${displayOrgName}`
                    : displayOrgName || "Asset Management"}
            </p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {links
            .filter((link) => leadingPaths.has(link.to))
            .map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          {assetSections.length > 0 && (
            <NavDropdown
              label="Asset"
              active={assetActive}
              open={assetOpen}
              setOpen={setAssetOpen}
              onOpen={() => setOrgOpen(false)}
              menuRef={assetMenuRef}
              items={assetSections}
            />
          )}
          {links
            .filter((link) => !leadingPaths.has(link.to) && !trailingPaths.has(link.to))
            .map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          {orgSections.length > 0 && (
            <NavDropdown
              label="Admin"
              active={orgActive}
              open={orgOpen}
              setOpen={setOrgOpen}
              onOpen={() => setAssetOpen(false)}
              menuRef={orgMenuRef}
              items={orgSections}
            />
          )}
          {links
            .filter((link) => trailingPaths.has(link.to))
            .map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
        </nav>

          <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <NotificationBell />
              {assetImageSrc(user?.ImageUrl) ? (
                <img
                  src={assetImageSrc(user.ImageUrl)}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover border border-white/10"
                />
              ) : null}
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">
                  {user?.FullName || user?.Email || "User"}
                </p>
                <p className="text-[11px] text-accent">{roleLabel(user?.Role, user?.RoleName)}</p>
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
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-bold hover:bg-cyan-500 transition-colors"
              >
                Login
              </Link>
            </>
          )}
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
            .filter((link) => leadingPaths.has(link.to))
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
          {assetSections.length > 0 && (
            <div className="pt-1">
              <p className={`px-3 py-2 text-xs uppercase tracking-widest ${assetActive ? "text-accent" : "text-muted"}`}>
                Asset
              </p>
              {assetSections.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `block ${linkClass({ isActive })}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
          {links
            .filter((link) => !leadingPaths.has(link.to) && !trailingPaths.has(link.to))
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
                Admin
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
            .filter((link) => trailingPaths.has(link.to))
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
          {actingAsOrg && (
            <button
              type="button"
              onClick={handleExitOrganization}
              className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold bg-amber-500/15"
            >
              Exit organization
            </button>
          )}
          <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  {assetImageSrc(user?.ImageUrl) ? (
                    <img
                      src={assetImageSrc(user.ImageUrl)}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover border border-white/10 shrink-0"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user?.FullName || user?.Email}</p>
                    <p className="text-[11px] text-accent">{roleLabel(user?.Role, user?.RoleName)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <NotificationBell />
                  <ThemeToggle />
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 text-sm rounded-lg bg-red-500/10 text-red-400"
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <>
                <ThemeToggle />
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 text-sm rounded-lg bg-cyan-600 text-white font-semibold"
                >
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
