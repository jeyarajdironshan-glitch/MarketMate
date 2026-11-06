import React, { useState } from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, X, AlertCircle } from 'lucide-react';
import { translations } from '../i18n/translations';

export default function PayHereModal({
  isOpen,
  onClose,
  delivery,
  token,
  currentLang,
  onPaymentSuccess
}) {
  if (!isOpen || !delivery) return null;

  const t = translations[currentLang] || translations.en;
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedInfo, setCompletedInfo] = useState(null);

  const orderId = `MM-DEL-${delivery.delivery_id}-${Date.now().toString().slice(-5)}`;
  const amount = Number(delivery.total_amount).toFixed(2);

  const handleSimulatePayment = async () => {
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/payments/sandbox-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: orderId,
          payment_id: `PH-SANDBOX-${Date.now()}`
        })
      });

      const data = await res.json();
      if (data.success) {
        setCompletedInfo(data.result);
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
      } else {
        setErrorMsg(data.message || 'Payment processing failed in sandbox.');
      }
    } catch (err) {
      setErrorMsg('Network error communicating with payment server.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden transition-all">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-xs tracking-wider">
              PH
            </div>
            <div>
              <h3 className="font-bold text-base">PayHere Payment Gateway</h3>
              <p className="text-[11px] text-blue-200">{t.payhere_sandbox_badge}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {completedInfo ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-base text-slate-800">Payment Verified & Settled!</h4>
              <p className="text-xs text-slate-600">
                Payment of <strong>Rs. {amount}</strong> for Delivery #{delivery.delivery_id} has been recorded in the supplier account and audited.
              </p>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
                Ref: {orderId}
              </div>
              <button
                onClick={onClose}
                className="w-full mt-2 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition"
              >
                {t.close}
              </button>
            </div>
          ) : (
            <>
              {/* Transaction Summary Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Payable To Supplier:</span>
                  <strong className="text-slate-800">{delivery.supplier_name}</strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Delivery Item:</span>
                  <strong className="text-slate-800">{delivery.product_name} ({delivery.accepted_quantity} kg)</strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Merchant ID:</span>
                  <strong className="text-slate-800 font-mono">1220000 (Sandbox)</strong>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-800">
                  <span>Total Amount:</span>
                  <span className="text-blue-700 text-base font-extrabold">Rs. {Number(amount).toLocaleString()}</span>
                </div>
              </div>

              {/* Sandbox Card Details */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-blue-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>PayHere Official Sandbox Card Simulation</span>
                </div>
                <p className="text-[11px] text-blue-800">
                  Card No: <span className="font-mono font-bold">4111 2222 3333 4444</span> • Exp: 12/28 • CVV: 123
                </p>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-600 font-semibold">{errorMsg}</p>
              )}

              {/* Action Button */}
              <button
                disabled={isProcessing}
                onClick={handleSimulatePayment}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                {isProcessing ? t.loading : `${t.simulate_success_payment} (Rs. ${amount})`}
              </button>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
