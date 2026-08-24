// frontend/src/pages/BranchAccessRedeem.tsx
//
// Landing page for the one-click "Open Branch Billing" link. Deliberately
// NOT nested under AdminRoute/HostRoute/WorkspaceRoute in App.tsx, and does
// not modify BranchBilling.tsx at all — it just redeems the one-time token
// into a tab-scoped session (see branchAccessSession.ts) and then renders
// the existing BranchBilling component unchanged.
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { getBranchAccessToken, setBranchAccessSession } from "../utils/branchAccessSession";
import BranchBilling from "./BranchBilling";

export default function BranchAccessRedeem() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    // App-root state (useAuthUser's `user`, TenantContext's `activeBranch`)
    // resolves identity synchronously on first mount — before this effect's
    // async redeem call below could ever finish. Without this reload, those
    // stay frozen on whatever was already in localStorage (the admin's own
    // session), never picking up the branch-access session at all. If it's
    // already in sessionStorage, this is that reload — skip straight to
    // rendering (re-POSTing would fail anyway: the token is single-use).
    if (getBranchAccessToken()) {
      setStatus("ready");
      return;
    }

    if (!token) {
      setStatus("error");
      setError("Missing access token.");
      return;
    }
    (async () => {
      try {
        const res = await apiFetch("/branch-access/redeem", {
          method: "POST",
          body: { token },
        });
        const data = await res.json();
        if (data.success && data.token) {
          setBranchAccessSession(data.token, data.expires_in_ms || 4 * 60 * 60 * 1000);
          window.location.reload();
        } else {
          setStatus("error");
          setError(data.error || "Invalid or expired access link.");
        }
      } catch {
        setStatus("error");
        setError("Failed to authenticate branch access.");
      }
    })();
  }, [token]);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", color: "#475569" }}>
        Opening branch billing…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ color: "#dc2626", fontWeight: 700 }}>{error}</div>
        <a href="/company-login" style={{ color: "#4f46e5", fontWeight: 600 }}>Back to login</a>
      </div>
    );
  }

  return <BranchBilling />;
}
