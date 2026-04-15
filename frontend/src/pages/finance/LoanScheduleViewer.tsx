import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Finance.css";

const LoanScheduleViewer: React.FC<{ loanId: number; onClose: () => void }> = ({
  loanId,
  onClose,
}) => {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await axios.get(
          `http://localhost:5001/api/finance/loans/${loanId}/schedule`,
        );
        setSchedule(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [loanId]);

  return (
    <div className="modal-overlay">
      <div className="modal-content card max-w-4xl">
        <div className="flex justify-between items-center mb-4">
          <h2>Repayment Schedule - Loan #{loanId}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {loading ? (
          <p>Loading schedule...</p>
        ) : (
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Due Date</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>Total Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((item, i) => (
                  <tr key={i}>
                    <td>{item.due_date}</td>
                    <td>₹ {item.principal_component.toLocaleString()}</td>
                    <td>₹ {item.interest_component.toLocaleString()}</td>
                    <td className="font-bold">
                      ₹ {item.total_due.toLocaleString()}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${item.status.toLowerCase()}`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanScheduleViewer;
