import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Truck, 
  DollarSign, 
  Users, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  Clock, 
  ShieldCheck, 
  Plus, 
  CreditCard,
  Upload,
  ArrowRight
} from 'lucide-react';
import { translations } from '../i18n/translations';

export default function DistributorDashboard({
  currentUser,
  currentLang,
  token,
  onViewSlip,
  onOpenPayHere
}) {
  const t = translations[currentLang] || translations.en;
  const [activeTab, setActiveTab] = useState('overview');

  // State
  const [connectionData, setConnectionData] = useState({ connectedSuppliers: [], incomingRequests: [] });
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [reliability, setReliability] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // New Delivery Settlement Form State
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formProduct, setFormProduct] = useState('Tomato');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formQtySent, setFormQtySent] = useState(100);
  const [formQtyReceived, setFormQtyReceived] = useState(100);
  const [formQtyDamaged, setFormQtyDamaged] = useState(5);
  const [formQtyRejected, setFormQtyRejected] = useState(0);
  const [formAgreedPrice, setFormAgreedPrice] = useState(200);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Quality Feedback Modal State
  const [feedbackDelivery, setFeedbackDelivery] = useState(null);
  const [feedbackQuality, setFeedbackQuality] = useState('Good');
  const [feedbackComments, setFeedbackComments] = useState('');
  const [feedbackImage, setFeedbackImage] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Automatic Calculation for Settlement Slip
  const calcAccepted = Math.max(0, Number(formQtyReceived) - Number(formQtyDamaged) - Number(formQtyRejected));
  const calcTotalAmount = (calcAccepted * Number(formAgreedPrice)).toFixed(2);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Connected Suppliers & Incoming Requests
      const connRes = await fetch('/api/connections/my-connection', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const connJson = await connRes.json();
      if (connJson.success) {
        setConnectionData(connJson);
        if (connJson.connectedSuppliers?.length > 0 && !formSupplierId) {
          setFormSupplierId(connJson.connectedSuppliers[0].supplier_id);
        }
      }

      // 2. Deliveries
      const delivRes = await fetch('/api/deliveries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const delivJson = await delivRes.json();
      if (delivJson.success) setDeliveries(delivJson.deliveries || []);

      // 3. Payments
      const payRes = await fetch('/api/payments/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payJson = await payRes.json();
      if (payJson.success) setPayments(payJson.payments || []);

      // 4. Market Announcements
      const annRes = await fetch('/api/markets/announcements/all');
      const annJson = await annRes.json();
      if (annJson.success) setAnnouncements(annJson.announcements || []);

      // 5. Reliability History
      const relRes = await fetch('/api/reliability/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const relJson = await relRes.json();
      if (relJson.success) setReliability(relJson);

    } catch (err) {
      console.error('Error fetching distributor dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Handle New Delivery Settlement Creation
  const handleCreateDelivery = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Validations
    if (!formSupplierId) {
      setFormError('Please select a connected supplier.');
      return;
    }
    if (Number(formQtyDamaged) + Number(formQtyRejected) > Number(formQtyReceived)) {
      setFormError('Damaged and rejected quantities cannot exceed received quantity.');
      return;
    }
    if (calcAccepted <= 0) {
      setFormError('Accepted quantity must be greater than zero.');
      return;
    }

    try {
      const res = await fetch('/api/deliveries/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          supplier_id: formSupplierId,
          product_name: formProduct,
          delivery_date: formDate,
          quantity_sent: formQtySent,
          quantity_received: formQtyReceived,
          damaged_quantity: formQtyDamaged,
          rejected_quantity: formQtyRejected,
          agreed_price: formAgreedPrice,
          notes: formNotes
        })
      });

      const data = await res.json();
      if (data.success) {
        setFormSuccess(`Digital Settlement Slip #${data.deliveryId} created! Total payable: Rs. ${Number(data.calculated.total_amount).toLocaleString()}`);
        loadData();
      } else {
        setFormError(data.message || 'Failed to record delivery.');
      }
    } catch (err) {
      setFormError('Network communication error.');
    }
  };

  // Submit Product Quality Feedback
  const handleQualityFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackDelivery) return;
    setFeedbackSubmitting(true);
    setFeedbackMsg('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          delivery_id: feedbackDelivery.delivery_id,
          quality_status: feedbackQuality,
          comments: feedbackComments,
          image_url_input: feedbackImage
        })
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackMsg('Feedback and photographic evidence recorded successfully!');
        setTimeout(() => {
          setFeedbackDelivery(null);
          setFeedbackMsg('');
          loadData();
        }, 1500);
      } else {
        setFeedbackMsg(data.message || 'Error saving feedback.');
      }
    } catch (err) {
      setFeedbackMsg('Network error.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Confirm incoming supplier request agreement
  const handleConfirmRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/connections/confirm-distributor/${requestId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pendingSettlements = deliveries.filter(d => d.delivery_status === 'pending_review');
  const confirmedAwaitingPayment = deliveries.filter(d => d.delivery_status === 'settled' && d.payment_status !== 'completed');
  const totalOutstandingPayment = confirmedAwaitingPayment.reduce((sum, d) => sum + Number(d.total_amount), 0);

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-agri-dark to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {t.distributor} Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentUser?.profile?.business_name} • {currentUser?.profile?.stall_number || 'Stall 42'}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {currentUser?.full_name}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Wholesale Market: {currentUser?.profile?.market_name || 'Dambulla Dedicated Economic Centre'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('new_delivery')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t.tab_new_delivery}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Nav Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200 text-xs font-bold">
        {[
          { id: 'overview', label: t.tab_overview, icon: Store },
          { id: 'suppliers', label: `${t.tab_connected_suppliers} (${connectionData.connectedSuppliers?.length || 0})`, icon: Users },
          { id: 'new_delivery', label: t.tab_new_delivery, icon: Plus },
          { id: 'deliveries', label: `${t.tab_deliveries} (${deliveries.length})`, icon: FileText },
          { id: 'payments', label: `${t.tab_payments} (Rs. ${totalOutstandingPayment.toLocaleString()})`, icon: DollarSign },
          { id: 'reliability', label: t.tab_reliability, icon: ShieldCheck },
          { id: 'market', label: t.tab_market_status, icon: Clock }
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3.5 py-2 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition ${
                isActive
                  ? 'bg-agri-dark text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-agri-mint' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          SECTION A: OVERVIEW
      ========================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Active Suppliers</span>
              <p className="text-2xl font-extrabold text-slate-800">{connectionData.connectedSuppliers?.length || 0}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Direct vegetable & fruit farmers</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Deliveries Received</span>
              <p className="text-2xl font-extrabold text-slate-800">{deliveries.length}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Digital slips recorded</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Pending Slips</span>
              <p className="text-2xl font-extrabold text-amber-700">{pendingSettlements.length}</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Awaiting supplier review</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Payable Balance</span>
              <p className="text-2xl font-extrabold text-blue-700">Rs. {totalOutstandingPayment.toLocaleString()}</p>
              <p className="text-[11px] text-blue-600 mt-0.5">Ready for PayHere checkout</p>
            </div>

          </div>

          {/* Quick PayHere Payout Banner */}
          {confirmedAwaitingPayment.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div>
                <span className="text-xs font-bold uppercase text-blue-300">Ready for PayHere Settlement</span>
                <h3 className="font-extrabold text-base mt-0.5">
                  {confirmedAwaitingPayment.length} Mutually Confirmed Deliveries Awaiting Payment
                </h3>
                <p className="text-xs text-blue-200">
                  Total outstanding settlement to suppliers: <strong>Rs. {totalOutstandingPayment.toLocaleString()}</strong>
                </p>
              </div>

              <button
                onClick={() => onOpenPayHere(confirmedAwaitingPayment[0])}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay Next Settlement (Slip #{confirmedAwaitingPayment[0].delivery_id})</span>
              </button>
            </div>
          )}

          {/* Incoming Supplier Discussion Requests */}
          {connectionData.incomingRequests?.length > 0 && (
            <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wide">
                  Incoming Connection Inquiries
                </h3>
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full">
                  {connectionData.incomingRequests.length} Requests
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {connectionData.incomingRequests.map(req => (
                  <div key={req.request_id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{req.supplier_name} • {req.farm_name}</p>
                      <p className="text-slate-500">
                        Crops: {req.primary_crop_types || 'Vegetables'} • Location: {req.farm_location}
                      </p>
                      <p className="text-emerald-700 font-mono mt-0.5">
                        Phone: <strong>{req.supplier_phone}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        Status: {req.request_status}
                      </span>
                      {req.request_status === 'contact_details_shared' && req.distributor_confirmed === 0 && (
                        <button
                          onClick={() => handleConfirmRequest(req.request_id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition"
                        >
                          Confirm Mutual Agreement
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Deliveries List */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-extrabold text-base text-slate-800">Recent Deliveries Recorded</h3>
            <div className="divide-y divide-slate-100 text-xs">
              {deliveries.slice(0, 4).map(d => (
                <div key={d.delivery_id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{d.product_name}</span>
                      <span className="text-slate-500">From {d.supplier_name}</span>
                      <span className="font-mono text-slate-400">Slip #{d.delivery_id}</span>
                    </div>
                    <p className="text-slate-500 mt-0.5">
                      Recv: {d.quantity_received}kg • Damaged: {d.damaged_quantity}kg • <strong>Accepted: {d.accepted_quantity}kg</strong> @ Rs. {d.agreed_price}/kg
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-sm text-slate-900">
                      Rs. {Number(d.total_amount).toLocaleString()}
                    </span>
                    <button
                      onClick={() => onViewSlip(d)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                    >
                      View Slip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          SECTION B: MANAGE SUPPLIERS
      ========================================================================== */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_connected_suppliers}</h2>
              <p className="text-xs text-slate-500">Officially connected suppliers delivering to your wholesale stall</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {connectionData.connectedSuppliers?.length || 0} Connected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectionData.connectedSuppliers?.map(supp => (
              <div key={supp.supplier_id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-800">{supp.farm_name}</h3>
                    <p className="text-xs text-slate-500">Farmer: <strong>{supp.supplier_name}</strong></p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    Active Partner
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Location</span>
                    <span className="text-slate-700 font-medium">{supp.farm_location || 'Nuwara Eliya / Welimada'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Contact Phone</span>
                    <span className="text-slate-800 font-mono font-bold">{supp.phone_number}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/50">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Primary Crops</span>
                    <span className="text-slate-700 font-semibold">{supp.primary_crop_types || 'Tomatoes, Cabbage, Green Chilli'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500">
                    Deliveries Recorded: <strong>{supp.total_deliveries || 0}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setFormSupplierId(supp.supplier_id);
                      setActiveTab('new_delivery');
                    }}
                    className="px-3.5 py-1.5 bg-agri-dark hover:bg-agri-emerald text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Record Delivery
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION C & D: RECORD DELIVERY & DIGITAL SETTLEMENT SLIP GENERATOR
      ========================================================================== */}
      {activeTab === 'new_delivery' && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-lg font-extrabold text-agri-dark">Record Incoming Delivery & Generate Digital Slip</h2>
            <p className="text-xs text-slate-500">
              Enter arrived produce weights. Accepted quantity and total payable amount are calculated automatically with strict validation.
            </p>
          </div>

          <form onSubmit={handleCreateDelivery} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
            
            {/* Supplier & Commodity Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Connected Supplier *
                </label>
                <select
                  value={formSupplierId}
                  onChange={(e) => setFormSupplierId(e.target.value)}
                  required
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                >
                  <option value="">Select supplier...</option>
                  {connectionData.connectedSuppliers?.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.farm_name} ({s.supplier_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product / Commodity *
                </label>
                <select
                  value={formProduct}
                  onChange={(e) => setFormProduct(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                >
                  {['Tomato', 'Carrot', 'Green Chilli', 'Beans (Green)', 'Cabbage', 'Leeks', 'Brinjal', 'Pumpkin', 'Lime', 'Banana (Ambul)', 'Papaya', 'Pineapple'].map(crop => (
                    <option key={crop} value={crop}>{crop}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Date *
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Agreed Price (Rs. per kg) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={formAgreedPrice}
                  onChange={(e) => setFormAgreedPrice(e.target.value)}
                  required
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-800"
                />
              </div>
            </div>

            {/* Weights and Damage Calculations */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-bold uppercase text-slate-600 block">
                Weights Breakdown & Inspection (kg)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">Qty Sent (kg)</label>
                  <input
                    type="number"
                    min="1"
                    value={formQtySent}
                    onChange={(e) => setFormQtySent(e.target.value)}
                    required
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Qty Received (kg)</label>
                  <input
                    type="number"
                    min="1"
                    value={formQtyReceived}
                    onChange={(e) => setFormQtyReceived(e.target.value)}
                    required
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-medium text-red-600 mb-1">Damaged Qty (kg)</label>
                  <input
                    type="number"
                    min="0"
                    value={formQtyDamaged}
                    onChange={(e) => setFormQtyDamaged(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-red-300 bg-white font-bold text-red-600"
                  />
                </div>

                <div>
                  <label className="block font-medium text-red-600 mb-1">Rejected Qty (kg)</label>
                  <input
                    type="number"
                    min="0"
                    value={formQtyRejected}
                    onChange={(e) => setFormQtyRejected(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-red-300 bg-white font-bold text-red-600"
                  />
                </div>
              </div>
            </div>

            {/* Automatic Real-Time Calculated Summary Banner */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase block">Automatic Calculation</span>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Accepted Qty = {formQtyReceived} - {formQtyDamaged || 0} - {formQtyRejected || 0} = <strong className="text-emerald-950 font-extrabold text-sm">{calcAccepted} kg</strong>
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-emerald-800 uppercase block">Total Payable Amount</span>
                <span className="text-xl font-black text-emerald-900">
                  Rs. {Number(calcTotalAmount).toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Batch Observations / Transit Notes
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Standard plastic crates arrived at 7:00 AM, minimal bottom crate bruising..."
                rows={2}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {formError && (
              <p className="text-xs text-red-600 font-bold bg-red-50 p-2.5 rounded-lg border border-red-200">
                {formError}
              </p>
            )}

            {formSuccess && (
              <p className="text-xs text-emerald-800 font-bold bg-emerald-100 p-2.5 rounded-lg border border-emerald-300">
                {formSuccess}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-agri-dark hover:bg-agri-emerald text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-agri-mint" />
              <span>Generate Digital Settlement Slip & Notify Supplier</span>
            </button>

          </form>
        </div>
      )}

      {/* =========================================================================
          SECTION D & E: DELIVERIES & PRODUCT QUALITY FEEDBACK
      ========================================================================== */}
      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_deliveries}</h2>
              <p className="text-xs text-slate-500">Review mutual confirmations, attach quality photos, and process payouts</p>
            </div>
            <button
              onClick={() => setActiveTab('new_delivery')}
              className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Slip</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Slip #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Commodity</th>
                    <th className="py-3 px-3 text-right">Accepted Qty</th>
                    <th className="py-3 px-3 text-right">Total Amount</th>
                    <th className="py-3 px-3">Mutual Status</th>
                    <th className="py-3 px-3">Quality Feedback</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.map(deliv => (
                    <tr key={deliv.delivery_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        #{deliv.delivery_id}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {deliv.delivery_date}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {deliv.supplier_name}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-slate-800">
                        {deliv.product_name}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                        {deliv.accepted_quantity} kg
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm">
                        Rs. {Number(deliv.total_amount).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          deliv.delivery_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                          deliv.delivery_status === 'settled' ? 'bg-blue-100 text-blue-800' :
                          deliv.delivery_status === 'disputed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {deliv.delivery_status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {deliv.quality_status ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            deliv.quality_status === 'Good' ? 'bg-emerald-100 text-emerald-800' :
                            deliv.quality_status === 'Average' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {deliv.quality_status}
                          </span>
                        ) : (
                          <button
                            onClick={() => setFeedbackDelivery(deliv)}
                            className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                          >
                            <Camera className="w-3 h-3" />
                            <span>Add Photo</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => onViewSlip(deliv)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition"
                        >
                          Slip
                        </button>

                        {deliv.delivery_status === 'settled' && deliv.payment_status !== 'completed' && (
                          <button
                            onClick={() => onOpenPayHere(deliv)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition"
                          >
                            Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION F: PAYMENT MANAGEMENT
      ========================================================================== */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_payments}</h2>
              <p className="text-xs text-slate-500">PayHere Sandbox payment processing and settlement confirmation</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-700 uppercase">
              Settlements Pending Distributor Payout
            </div>
            
            {confirmedAwaitingPayment.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400 font-medium">
                No confirmed delivery settlements pending payment. All accounts up to date!
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {confirmedAwaitingPayment.map(d => (
                  <div key={d.delivery_id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-sm">Delivery #{d.delivery_id} • {d.product_name}</span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                          Mutually Confirmed
                        </span>
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        Supplier: <strong>{d.supplier_name}</strong> • Accepted: {d.accepted_quantity} kg @ Rs. {d.agreed_price}/kg
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-base text-slate-900">
                        Rs. {Number(d.total_amount).toLocaleString()}
                      </span>
                      <button
                        onClick={() => onOpenPayHere(d)}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-agri-dark text-white rounded-xl font-bold text-xs shadow-sm hover:opacity-95 transition flex items-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-agri-mint" />
                        <span>Pay via PayHere</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION G & H: RELIABILITY & MARKET INFO
      ========================================================================== */}
      {activeTab === 'reliability' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-lg font-extrabold text-agri-dark">{t.reliability_title}</h2>
            <p className="text-xs text-slate-500">Distributor verified settlement audit history and trust score</p>
          </div>

          {reliability?.summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Settlement Completion</span>
                <p className="text-3xl font-extrabold text-emerald-700 mt-1">{reliability.summary.settlementRate}%</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{reliability.summary.completedSettlements} completed settlements</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Dispute Count</span>
                <p className="text-3xl font-extrabold text-slate-800 mt-1">{reliability.summary.disputedSettlements}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Recorded delivery disputes</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Platform Standing</span>
                <p className="text-2xl font-extrabold text-agri-dark mt-1">{reliability.summary.trustLevel}</p>
                <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Verified PayHere merchant</p>
              </div>
            </div>
          )}

          {/* Audit Trail Log */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h3 className="font-extrabold text-sm text-slate-800 mb-3">{t.activity_timeline}</h3>
            <div className="space-y-2.5">
              {(reliability?.auditLog || []).map(log => (
                <div key={log.history_id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{log.description}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{log.created_at}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Verified Record
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'market' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_market_status}</h2>
            <p className="text-xs text-slate-500">Official opening hours, cleaning cycles, and administrative notices</p>
          </div>

          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.announcement_id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 text-sm">{ann.title}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                    {ann.announcement_type}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{ann.description}</p>
                <p className="text-[11px] text-emerald-700 font-semibold">{ann.market_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Quality Feedback Modal */}
      {feedbackDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">
              Submit Product Quality Feedback
            </h3>
            <p className="text-xs text-slate-500">
              Delivery #{feedbackDelivery.delivery_id} ({feedbackDelivery.product_name} from {feedbackDelivery.supplier_name})
            </p>

            <form onSubmit={handleQualityFeedbackSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quality Assessment Grade *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Good', 'Average', 'Poor'].map(grade => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setFeedbackQuality(grade)}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        feedbackQuality === grade
                          ? 'bg-agri-dark text-white border-agri-dark shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Photo Evidence (Image URL)
                </label>
                <input
                  type="url"
                  value={feedbackImage}
                  onChange={(e) => setFeedbackImage(e.target.value)}
                  placeholder="https://images.unsplash.com/... or paste image link"
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detailed Observations *
                </label>
                <textarea
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  placeholder="e.g. Crisp texture, size classification accurate..."
                  rows={3}
                  required
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>

              {feedbackMsg && (
                <p className="text-xs font-semibold text-emerald-700">{feedbackMsg}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFeedbackDelivery(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={feedbackSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  {feedbackSubmitting ? t.loading : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
