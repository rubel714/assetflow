import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getSavedUser, clearAuth, hasPermission } from "./lib/globalfunction";
import { ThemeProvider } from "./lib/ThemeContext";
import LoginPage from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import Users from "./pages/Users";
import Departments from "./pages/Departments";
import Designations from "./pages/Designations";
import Locations from "./pages/Locations";
import Projects from "./pages/Projects";
import Categories from "./pages/Categories";
import OrganizationSettings from "./pages/OrganizationSettings";
import AuditLogs from "./pages/AuditLogs";
import Manufacturers from "./pages/Manufacturers";
import Suppliers from "./pages/Suppliers";
import ConfirmDialog from "./components/ConfirmDialog";
import Snackbar from "./components/Snackbar";

function Protected({ user, onLogout, permission, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (permission && !hasPermission(user, permission)) {
    return (
      <Layout onLogout={onLogout}>
        <p className="text-red-400">You do not have access to this page.</p>
      </Layout>
    );
  }
  return <Layout onLogout={onLogout}>{children}</Layout>;
}

export default function App() {
  const [user, setUser] = useState(getSavedUser());

  useEffect(() => {
    function refresh() {
      setUser(getSavedUser());
    }
    window.addEventListener("assetflow-auth-updated", refresh);
    return () => window.removeEventListener("assetflow-auth-updated", refresh);
  }, []);

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              user ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />
            }
          />
          <Route
            path="/"
            element={
              <Protected user={user} onLogout={handleLogout} permission="dashboard.read">
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/assets"
            element={
              <Protected user={user} onLogout={handleLogout} permission="assets.read">
                <Assets />
              </Protected>
            }
          />
          <Route
            path="/assets/new"
            element={
              <Protected user={user} onLogout={handleLogout} permission="assets.manage">
                <Assets />
              </Protected>
            }
          />
          <Route
            path="/assets/:id/edit"
            element={
              <Protected user={user} onLogout={handleLogout} permission="assets.manage">
                <Assets />
              </Protected>
            }
          />
          <Route
            path="/assets/:id"
            element={
              <Protected user={user} onLogout={handleLogout} permission="assets.read">
                <AssetDetail />
              </Protected>
            }
          />
          <Route
            path="/organization"
            element={
              <Navigate
                to={hasPermission(user, "org.manage") ? "/organization/settings" : "/organization/departments"}
                replace
              />
            }
          />
          <Route
            path="/organization/settings"
            element={
              <Protected user={user} onLogout={handleLogout} permission="org.manage">
                <OrganizationSettings />
              </Protected>
            }
          />
          <Route
            path="/organization/audit"
            element={
              <Protected user={user} onLogout={handleLogout} permission="setup.manage">
                <AuditLogs />
              </Protected>
            }
          />
          <Route
            path="/organization/departments"
            element={
              <Protected user={user} onLogout={handleLogout} permission="setup.manage">
                <Departments />
              </Protected>
            }
          />
          <Route
            path="/organization/designations"
            element={
              <Protected user={user} onLogout={handleLogout} permission="setup.manage">
                <Designations />
              </Protected>
            }
          />
          <Route
            path="/organization/locations"
            element={
              <Protected user={user} onLogout={handleLogout} permission="setup.manage">
                <Locations />
              </Protected>
            }
          />
          <Route
            path="/organization/projects"
            element={
              <Protected user={user} onLogout={handleLogout} permission="setup.manage">
                <Projects />
              </Protected>
            }
          />
          <Route
            path="/organization/categories"
            element={
              <Protected user={user} onLogout={handleLogout} permission="setup.manage">
                <Categories />
              </Protected>
            }
          />
          <Route
            path="/organization/manufacturers"
            element={
              <Protected user={user} onLogout={handleLogout} permission="setup.manage">
                <Manufacturers />
              </Protected>
            }
          />
          <Route
            path="/organization/suppliers"
            element={
              <Protected user={user} onLogout={handleLogout} permission="setup.manage">
                <Suppliers />
              </Protected>
            }
          />
          <Route
            path="/users"
            element={
              <Protected user={user} onLogout={handleLogout} permission="users.read">
                <Users />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ConfirmDialog />
        <Snackbar />
      </BrowserRouter>
    </ThemeProvider>
  );
}
