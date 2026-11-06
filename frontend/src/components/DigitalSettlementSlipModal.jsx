import React, { useState } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  CreditCard, 
  Camera, 
  Scale, 
  DollarSign, 
  Calendar,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import { translations } from '../i18n/translations';

export default function DigitalSettlementSlipModal({
  isOpen,
  onClose,
  delivery,
  currentUser,
  currentLang,
  token,
  onStatusUpdated,
  onOpenPayHere
}) {
  if (!isOpen || !delivery) return null;

  const t = translations[currentLang] || translations.en;
  const isSupplier = currentUser?.role === 'supplier';
  const isDistributor = currentUser?.role === 'distributor';

  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Confirm Settlement
  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/deliveries/${delivery.delivery_id}/confirm`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        onStatusUpdated();
        onClose();
      } else {
        setErrorMsg(data.message || 'Failed to confirm settlement.');
      }
    } catch (err) {
      setErrorMsg('Network error while confirming settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Dispute
  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      setErrorMsg('Please specify the reason for disputing this delivery slip.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/deliveries/${delivery.delivery_id}/dispute`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dispute_reason: disputeReason })
      });
      const data = await res.json();
      if (data.success) {
        onStatusUpdated();
        onClose();
      } else {
        setErrorMsg(data.message || 'Failed to submit dispute.');
      }
    } catch (err) {
      setErrorMsg('Network error while disputing settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfirmed = delivery.settlement_status === 'mutually_confirmed' || delivery.delivery_status === 'settled' || delivery.delivery_status === 'paid';
  const isDisputed = delivery.settlement_status === 'disputed' || delivery.delivery_status === 'disputed';
  const isPaid = delivery.delivery_status === 'paid' || delivery.payment_status === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-8 overflow-hidden transition-all">
        
        {/* Header - Security & Digital Slip Badge */}
        <div className="bg-gradient-to-r from-agri-dark to-agri-emerald p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <FileText className="w-6 h-6 text-agri-mint" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{t.settlement_slip_title}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/20 text-white">
                  SLIP #{delivery.delivery_id}
                </span>
              </div>
              <p className="text-xs text-slate-200">{t.slip_subtitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Slip Body */}
        <div className="p-6 space-y-6">
          
          {/* Status Alert Banner */}
          {isPaid ? (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">{t.status_paid} via PayHere Sandbox</p>
                <p className="text-slate-600">Transaction Reference: {delivery.transaction_reference || 'N/A'}</p>
              </div>
            </div>
          ) : isDisputed ? (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">{t.status_disputed}</p>
                <p className="text-red-700 italic mt-0.5">"{delivery.dispute_reason || 'Supplier disagreed with quantity/damage deductions.'}"</p>
              </div>
            </div>
          ) : isConfirmed ? (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3 text-blue-900">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">{t.mutually_confirmed}</p>
                <p className="text-slate-600">Both parties verified accepted weight and agreed price. Awaiting distributor payment settlement.</p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-900">
              <Scale className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">{t.pending_supplier_review}</p>
                <p className="text-slate-600">Supplier review is required to confirm or dispute before final settlement.</p>
              </div>
            </div>
          )}

          {/* Supplier & Distributor Meta Details */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <p className="font-bold uppercase text-slate-400 text-[10px]">Supplier</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{delivery.supplier_name}</p>
              <p className="text-slate-500">{delivery.supplier_contact || 'Registered Supplier'}</p>
            </div>
            <div>
              <p className="font-bold uppercase text-slate-400 text-[10px]">Distributor</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{delivery.distributor_name}</p>
              <p className="text-slate-500">{delivery.market_name} {delivery.stall_number ? `(${delivery.stall_number})` : ''}</p>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-slate-600">
              <span><strong>Delivery Date:</strong> {delivery.delivery_date}</span>
              <span><strong>Product:</strong> <span className="font-bold text-slate-800">{delivery.product_name}</span></span>
            </div>
          </div>

          {/* Quantities & Financial Calculation Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Field</th>
                  <th className="py-2.5 px-3 text-right">Value</th>
                  <th className="py-2.5 px-3">Calculation Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-3 font-medium text-slate-600">{t.quantity_sent}</td>
                  <td className="py-2.5 px-3 font-bold text-right text-slate-800">{delivery.quantity_sent} kg</td>
                  <td className="py-2.5 px-3 text-slate-400">Recorded by supplier dispatch</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-slate-600">{t.quantity_received}</td>
                  <td className="py-2.5 px-3 font-bold text-right text-slate-800">{delivery.quantity_received} kg</td>
                  <td className="py-2.5 px-3 text-slate-400">Weighed at market arrival</td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="py-2.5 px-3 font-medium text-red-600 flex items-center gap-1">
                    <span>{t.damaged_quantity}</span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-right text-red-600">-{delivery.damaged_quantity} kg</td>
                  <td className="py-2.5 px-3 text-red-500 italic">Transit bruise or rot deduction</td>
                </tr>
                {Number(delivery.rejected_quantity) > 0 && (
                  <tr className="bg-red-50/50">
                    <td className="py-2.5 px-3 font-medium text-red-600">{t.rejected_quantity}</td>
                    <td className="py-2.5 px-3 font-bold text-right text-red-600">-{delivery.rejected_quantity} kg</td>
                    <td className="py-2.5 px-3 text-red-500 italic">Sub-standard grading rejected</td>
                  </tr>
                )}
                <tr className="bg-emerald-50/80 font-bold text-emerald-900 border-t border-emerald-200">
                  <td className="py-3 px-3 flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{t.accepted_quantity}</span>
                  </td>
                  <td className="py-3 px-3 text-right text-sm font-extrabold text-emerald-800">
                    {delivery.accepted_quantity} kg
                  </td>
                  <td className="py-3 px-3 text-[11px] text-emerald-700">
                    {t.calculation_formula}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-slate-600">{t.agreed_price}</td>
                  <td className="py-2.5 px-3 font-bold text-right text-slate-800">Rs. {Number(delivery.agreed_price).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-slate-400">Mutually negotiated wholesale rate</td>
                </tr>
                <tr className="bg-slate-900 text-white font-extrabold text-sm">
                  <td className="py-3.5 px-3">{t.total_payable}</td>
                  <td className="py-3.5 px-3 text-right text-emerald-400 text-base">
                    Rs. {Number(delivery.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-3 text-[11px] text-slate-300 font-normal">
                    {delivery.accepted_quantity} kg × Rs. {delivery.agreed_price}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Product Quality Photographic Evidence (if provided) */}
          {(delivery.quality_status || delivery.feedback_image) && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="font-bold text-xs text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-slate-500" />
                {t.quality_feedback}: <span className={`px-2 py-0.5 rounded text-[11px] ${
                  delivery.quality_status === 'Good' ? 'bg-emerald-100 text-emerald-800' :
                  delivery.quality_status === 'Average' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>{delivery.quality_status || 'Good'}</span>
              </p>
              {delivery.feedback_comments && (
                <p className="text-xs text-slate-600 italic mb-3">"{delivery.feedback_comments}"</p>
              )}
              {delivery.feedback_image && (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 max-h-48">
                  <img 
                    src={delivery.feedback_image} 
                    alt="Quality Evidence" 
                    className="w-full h-40 object-cover hover:scale-105 transition duration-300" 
                  />
                  <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                    Verified Photographic Evidence
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dispute Input Section (if supplier chooses to dispute) */}
          {showDisputeInput && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
              <label className="block text-xs font-bold text-red-800">
                {t.dispute_reason} *
              </label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder={t.dispute_placeholder}
                rows={3}
                className="w-full p-2.5 text-xs rounded-lg border border-red-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeInput(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDispute}
                  className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {isSubmitting ? t.loading : 'Submit Formal Dispute'}
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-red-600 font-semibold">{errorMsg}</p>
          )}

        </div>

        {/* Action Buttons in Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition"
          >
            {t.close}
          </button>

          <div className="flex items-center gap-2">
            
            {/* Supplier Actions: Confirm or Dispute */}
            {isSupplier && !isConfirmed && !isDisputed && (
              <>
                <button
                  onClick={() => setShowDisputeInput(true)}
                  className="px-3.5 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t.dispute_settlement}
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleConfirm}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isSubmitting ? t.loading : t.confirm_settlement}
                </button>
              </>
            )}

            {/* Distributor Action: Pay with PayHere when mutually confirmed and pending payment */}
            {isDistributor && isConfirmed && !isPaid && onOpenPayHere && (
              <button
                onClick={() => onOpenPayHere(delivery)}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-agri-dark hover:from-emerald-700 hover:to-agri-deep rounded-lg shadow-md transition flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4 text-agri-mint" />
                {t.pay_with_payhere} (Rs. {Number(delivery.total_amount).toLocaleString()})
              </button>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
