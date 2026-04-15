import React from "react";
import { motion } from "framer-motion";
import { FaMobileAlt, FaPrint, FaTimes, FaUser } from "react-icons/fa";
import QRCode from "react-qr-code";

interface Employee {
  id: number;
  name: string;
  designation?: string;
  status?: string;
}

interface Props {
  employee: Employee;
  onClose: () => void;
}

const EmployeeQRModal: React.FC<Props> = ({ employee, onClose }) => {
  const baseUrl = window.location.origin;
  const qrToken = `EMP_${employee.id}_SECRET`;
  const attendanceUrl = `${baseUrl}/mark-attendance?token=${qrToken}`;

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=500,height=800");
    if (!printWindow) return;

    printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Corporate ID - ${employee.name}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Satoshi', -apple-system, sans-serif;
                        padding: 40px;
                        display: flex;
                        justify-content: center;
                        background: #f1f5f9;
                    }
                    .card {
                        width: 320px;
                        height: 500px;
                        border-radius: 24px;
                        overflow: hidden;
                        background: white;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                        position: relative;
                        border: 1px solid #e2e8f0;
                    }
                    .accent-bar {
                        height: 120px;
                        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                        position: relative;
                    }
                    .company-logo {
                        position: absolute;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        color: white;
                        font-weight: 800;
                        font-size: 14px;
                        letter-spacing: 2px;
                        text-transform: uppercase;
                    }
                    .photo-container {
                        width: 100px;
                        height: 100px;
                        background: #f8fafc;
                        border: 4px solid white;
                        border-radius: 50%;
                        position: absolute;
                        top: 70px;
                        left: 50%;
                        transform: translateX(-50%);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #cbd5e1;
                        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                    }
                    .body {
                        margin-top: 60px;
                        padding: 20px;
                        text-align: center;
                    }
                    .name {
                        font-size: 20px;
                        font-weight: 800;
                        color: #0f172a;
                        margin-bottom: 4px;
                        text-transform: uppercase;
                        letter-spacing: -0.5px;
                    }
                    .designation {
                        font-size: 13px;
                        color: #2563eb;
                        font-weight: 700;
                        margin-bottom: 24px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .qr-wrapper {
                        background: #f8fafc;
                        padding: 16px;
                        border-radius: 20px;
                        display: inline-block;
                        border: 1px solid #f1f5f9;
                        margin-bottom: 20px;
                    }
                    .footer {
                        position: absolute;
                        bottom: 0;
                        width: 100%;
                        padding: 16px;
                        background: #f8fafc;
                        border-top: 1px solid #e2e8f0;
                        display: flex;
                        justify-content: space-between;
                        font-size: 10px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                    }
                    .verified-badge {
                        position: absolute;
                        top: 130px;
                        right: 80px;
                        background: #2563eb;
                        color: white;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        border: 2px solid white;
                        z-index: 10;
                    }
                    @media print {
                        body { background: white; padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="accent-bar">
                        <div class="company-logo">TITAN CORP</div>
                    </div>
                    <div class="photo-container">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                    <div class="verified-badge">✓</div>
                    <div class="body">
                        <div class="name">${employee.name}</div>
                        <div class="designation">${employee.designation || "Executive"}</div>
                        <div class="qr-wrapper">
                            ${document.getElementById("qr-code-container")?.innerHTML || ""}
                        </div>
                        <div style="font-size: 10px; color: #94a3b8; font-weight: 600;">SCAN FOR VERIFICATION</div>
                    </div>
                    <div class="footer">
                        <span>ID: ${employee.id}</span>
                        <span>STATUS: ${employee.status || "ACTIVE"}</span>
                    </div>
                </div>
            </body>
            </html>
        `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(attendanceUrl);
    alert("Attendance link copied!");
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(8px)",
        display: "flex", justifyContent: "center", alignItems: "center", zIndex: 3000,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          background: "white", borderRadius: "32px", width: "420px",
          overflow: "hidden", position: "relative",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Preview Header */}
        <div style={{ background: "#f8fafc", padding: "24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#1e293b" }}>Employee ID Card</h3>
          <button onClick={onClose} style={{ border: "none", background: "#f1f5f9", borderRadius: "12px", padding: "10px", cursor: "pointer", color: "#64748b" }}><FaTimes /></button>
        </div>

        <div style={{ padding: "40px", textAlign: "center" }}>
          {/* Card Mockup */}
          <div style={{
            width: "280px", height: "400px", background: "white", margin: "0 auto", borderRadius: "24px",
            border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", position: "relative",
            overflow: "hidden", textAlign: "center"
          }}>
            <div style={{ height: "100px", background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", position: "relative" }}>
               <div style={{ paddingTop: "20px", color: "white", fontSize: "11px", fontWeight: 800, letterSpacing: "2px" }}>TITAN CORP</div>
            </div>
            <div style={{ width: "80px", height: "80px", background: "#f1f5f9", borderRadius: "50%", border: "4px solid white", position: "absolute", top: "60px", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1" }}>
              <FaUser size={30} />
            </div>
            <div style={{ marginTop: "50px", padding: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase" }}>{employee.name}</div>
              <div style={{ fontSize: "12px", color: "#2563eb", fontWeight: 700, marginBottom: "20px" }}>{employee.designation || "STAFF"}</div>
              <div id="qr-code-container" style={{ background: "#f8fafc", padding: "12px", borderRadius: "16px", display: "inline-block" }}>
                <QRCode value={attendanceUrl} size={110} level="M" />
              </div>
            </div>
          </div>

          <p style={{ marginTop: "24px", fontSize: "14px", color: "#64748b", fontWeight: 500 }}>
            This card is ready for printing. It contains a secure QR code for automated attendance tracking.
          </p>
        </div>

        {/* Actions */}
        <div style={{ padding: "24px", background: "#f8fafc", display: "flex", gap: "12px", borderTop: "1px solid #e2e8f0" }}>
          <button onClick={copyLink} style={{ flex: 1, padding: "14px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "white", fontWeight: 700, color: "#475569", cursor: "pointer" }}>
            Copy Link
          </button>
          <button onClick={handlePrint} style={{ flex: 1, padding: "14px", borderRadius: "14px", background: "#2563eb", color: "white", fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <FaPrint /> Print ID Card
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default EmployeeQRModal;

