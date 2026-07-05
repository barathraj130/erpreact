import React, { useState } from "react";
import { FaBuilding, FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useTenant } from "../../context/TenantContext";
import "./Topbar.css";

interface TopbarProps {
  mode: "HOST" | "ADMIN" | "USER";
}

/** Branch selector, lifted out of the sidebar into its own top header bar. */
const Topbar: React.FC<TopbarProps> = ({ mode }) => {
  const { user } = useAuthUser();
  const { activeBranch, branches, setActiveBranch } = useTenant();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isBranchUser = user?.role !== "admin" && user?.branch_id;
  const showBranchSelector =
    mode !== "HOST" && !isBranchUser && (branches.length > 1 || user?.role === "admin");

  if (!showBranchSelector) return null;

  return (
    <header className="topbar">
      <div className="topbar-branch" style={{ position: "relative" }}>
        <button className="topbar-branch-btn" onClick={() => setOpen(o => !o)}>
          <FaBuilding size={12} style={{ opacity: 0.55 }} />
          <span>{activeBranch?.branch_name || "Select branch…"}</span>
          <FaChevronDown
            size={9}
            style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
          />
        </button>

        {open && (
          <div className="topbar-branch-menu">
            {branches.length === 0 ? (
              <div className="topbar-branch-empty">No branches found</div>
            ) : (
              <>
                {user?.role === "admin" && (
                  <button
                    className={`topbar-branch-item ${String(activeBranch?.id) === "all" ? "active" : ""}`}
                    onClick={() => {
                      setActiveBranch({ id: "all", branch_name: "All Branches", branch_code: "ALL" } as any);
                      setOpen(false);
                    }}
                  >
                    <FaBuilding size={12} style={{ opacity: 0.6 }} />
                    <div>
                      <div>All Branches (Consolidated)</div>
                      <div className="topbar-branch-item-sub">GLOBAL VIEW</div>
                    </div>
                  </button>
                )}
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    className={`topbar-branch-item ${activeBranch?.id === branch.id ? "active" : ""}`}
                    onClick={() => {
                      setActiveBranch(branch);
                      setOpen(false);
                      if (user?.role === "admin" || user?.role === "superadmin") {
                        navigate(`/admin/branches/${branch.id}`);
                      }
                    }}
                  >
                    <div
                      className="topbar-branch-dot"
                      style={{ background: activeBranch?.id === branch.id ? "#10b981" : "#d1d5db" }}
                    />
                    <div>
                      <div>{branch.branch_name}</div>
                      <div className="topbar-branch-item-sub">{branch.branch_code}</div>
                    </div>
                  </button>
                ))}
              </>
            )}
            <button
              className="topbar-branch-manage"
              onClick={() => { setOpen(false); navigate("/admin/branches"); }}
            >
              <FaBuilding size={11} /> Manage Branches
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
