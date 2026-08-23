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
import { setBranchAccessSession } from "../utils/branchAccessSession";
import BranchBilling from "./BranchBilling";

export default function BranchAccessRedeem() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
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
          setStatus("ready");
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
