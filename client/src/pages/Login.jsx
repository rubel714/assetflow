import React, { useState } from "react";
import axios from "axios";
import { homePath, saveAuth } from "../lib/globalfunction";
import { API_BASE } from "../lib/apiBase";
import { useNavigate } from "react-router-dom";
import { showSnackbar } from "../lib/snackbar";

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showSnackbar("Please fill in all fields", { type: "validation" });
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE}/login`,
        { email: email.trim().toLowerCase(), password }
      );

      if (response.data.status) {
        saveAuth(response.data.user, response.data.token);
        if (typeof onLogin === "function") {
          onLogin(response.data.user);
        }
        showSnackbar("Signed in successfully");
        navigate(homePath(response.data.user));
      } else {
        showSnackbar(response.data.message || "Login failed", { type: "error" });
      }
    } catch (err) {
      showSnackbar(
        err?.response?.data?.message || err.message || "Login failed. Please try again.",
        { type: "error" }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-8rem)] flex items-center">
          <div className="w-full grid md:grid-cols-2 gap-10 items-center animate-enter">
            <div className="text-center md:text-left">
              <h2
                className="text-4xl md:text-5xl font-bold tracking-tight mb-3"
                style={{ color: "var(--text-main)" }}
              >
                Asset<span className="text-accent">Flow</span>
              </h2>
              <p className="text-xs uppercase tracking-[0.3em] text-muted mb-4">
                Sign in to continue
              </p>
              <p className="text-muted text-sm md:text-base max-w-md mx-auto md:mx-0">
                Track and manage assets from a full desktop workspace.
              </p>
            </div>

            <div className="w-full space-y-5 glass p-6 md:p-8 rounded-2xl">
            <div>
              <label className="input-label">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="input-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-12"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors p-1"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 mt-4 rounded-xl bg-cyan-600 text-white font-bold shadow-lg hover:bg-cyan-500 transition-transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "AUTHENTICATING..." : "LOGIN"}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </button>
            <p className="pt-2 text-center text-[10px] text-muted opacity-50">v1.0.0</p>
            </div>
          </div>
    </div>
  );
}
