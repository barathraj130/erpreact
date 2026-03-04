import React, { useState, useRef } from 'react';
import { financeApi } from './financeApi';

const CashReceipts: React.FC = () => {
    const [partyName, setPartyName] = useState('');
    const [amount, setAmount] = useState(0);
    const [purpose, setPurpose] = useState('');
    const [loading, setLoading] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const companyId = 1;

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const canvas = canvasRef.current;
        const signatureBase64 = canvas ? canvas.toDataURL() : null;

        try {
            const res = await financeApi.createCashReceipt({
                company_id: companyId,
                party_name: partyName,
                amount,
                purpose,
                signature_base64: signatureBase64,
                created_by: 1
            });
            alert('Cash Receipt Generated!');
            window.open(financeApi.getReceiptPdfUrl(res.data.id), '_blank');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Simple canvas drawing logic
    let drawing = false;
    const startDrawing = (e: any) => {
        drawing = true;
        draw(e);
    };
    const endDrawing = () => {
        drawing = false;
        const canvas = canvasRef.current;
        if (canvas) canvas.getContext('2d')?.beginPath();
    };
    const draw = (e: any) => {
        if (!drawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    return (
        <div className="finance-container">
            <div className="finance-header">
                <h1>Cash Receipt Voucher</h1>
            </div>

            <div className="receipt-form-card card">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Party Name</label>
                        <input type="text" className="form-control" required value={partyName} onChange={e => setPartyName(e.target.value)} />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Amount (₹)</label>
                            <input type="number" className="form-control" required value={amount} onChange={e => setAmount(Number(e.target.value))} />
                        </div>
                        <div className="form-group">
                            <label>Purpose</label>
                            <input type="text" className="form-control" required value={purpose} onChange={e => setPurpose(e.target.value)} />
                        </div>
                    </div>

                    <div className="signature-section">
                        <label>Digital Signature (Draw below)</label>
                        <div className="canvas-container">
                            <canvas 
                                ref={canvasRef} 
                                width={400} 
                                height={200}
                                onMouseDown={startDrawing}
                                onMouseUp={endDrawing}
                                onMouseMove={draw}
                                onTouchStart={startDrawing}
                                onTouchEnd={endDrawing}
                                onTouchMove={draw}
                            />
                        </div>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={clearSignature}>Clear Signature</button>
                    </div>

                    <div className="form-actions mt-4">
                        <button type="submit" className="btn btn-lg btn-success w-100" disabled={loading}>
                            {loading ? 'Processing...' : 'Generate Receipt & Post Entry'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CashReceipts;
