import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Store, 
  Truck, 
  DollarSign, 
  Users, 
  Clock, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Plus, 
  Bell, 
  Check, 
  X,
  TrendingUp,
  Share2
} from 'lucide-react';
import { translations } from '../i18n/translations';

export default function AdminDashboard({
  currentUser,
  currentLang,
  token,
  onViewSlip
}) {
  const t = translations[currentLang] || translations.en;
  const [activeTab, setActiveTab] = useState('overview');

  // State
  const [stats, setStats] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [cbslData, setCbslData] = useState({ prices: [], reportDate: '2026-11-05' });
  const [cbslReports, setCbslReports] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // CBSL Price Editing Modal
  const [editingPrice, setEditingPrice] = useState(null);
  const [editPriceVal, setEditPriceVal] = useState('');
  const [editPrevPriceVal, setEditPrevPriceVal] = useState('');

  // Market Status Update Modal
  const [editingMarket, setEditingMarket] = useState(null);
  const [marketStatus, setMarketStatus] = useState('open');
  const [marketOpening, setMarketOpening] = useState('');
  const [marketClosing, setMarketClosing] = useState('');

  // New Announcement State
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [annMarketId, setAnnMarketId] = useState('1');
  const [annTitle, setAnnTitle] = useState('');
  const [annDesc, setAnnDesc] = useState('');
  const [annType, setAnnType] = useState('notice');
  const [annStart, setAnnStart] = useState(new Date().toISOString().slice(0, 10));
  const [annEnd, setAnnEnd] = useState(new Date(Date.now() + 3*86400000).toISOString().slice(0, 10));

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Overview Stats
      const statRes = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const statJson = await statRes.json();
      if (statJson.success) setStats(statJson.stats);

      // 2. Markets
      const mktRes = await fetch('/api/markets');
      const mktJson = await mktRes.json();
      if (mktJson.success) setMarkets(mktJson.markets || []);

      // 3. Users
      const usrRes = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const usrJson = await usrRes.json();
      if (usrJson.success) setUsers(usrJson.users || []);

      // 4. Connection Requests
      const reqRes = await fetch('/api/connections/admin/all-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const reqJson = await reqRes.json();
      if (reqJson.success) setRequests(reqJson.requests || []);

      // 5. CBSL Prices & Reports
      const cbslRes = await fetch('/api/cbsl/latest');
      const cbslJson = await cbslRes.json();
      if (cbslJson.success) setCbslData(cbslJson);

      const repRes = await fetch('/api/cbsl/admin/reports', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const repJson = await repRes.json();
      if (repJson.success) setCbslReports(repJson.reports || []);

      // 6. Deliveries
      const delivRes = await fetch('/api/deliveries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const delivJson = await delivRes.json();
      if (delivJson.success) setDeliveries(delivJson.deliveries || []);

      // 7. Payments
      const payRes = await fetch('/api/payments/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payJson = await payRes.json();
      if (payJson.success) setPayments(payJson.payments || []);

      // 8. Announcements
      const annRes = await fetch('/api/markets/announcements/all');
      const annJson = await annRes.json();
      if (annJson.success) setAnnouncements(annJson.announcements || []);

    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Facilitate Contact Sharing
  const handleShareContact = async (requestId) => {
    try {
      const res = await fetch(`/api/connections/admin/share-contact/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ admin_notes: 'Contact details shared with consent. Parties may now communicate.' })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg('Contact details shared with supplier and distributor.');
        setTimeout(() => setActionMsg(''), 2000);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Verify and Activate Partnership
  const handleVerifyActivate = async (requestId) => {
    try {
      const res = await fetch(`/api/connections/admin/verify-and-activate/${requestId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg('Mutual agreement verified! Official partnership activated.');
        setTimeout(() => setActionMsg(''), 2000);
        loadData();
      } else {
        setActionMsg(data.message || 'Error activating partnership.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reject Connection Request
  const handleRejectRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/connections/admin/reject/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: 'Connection request rejected after administrative verification.' })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg('Request rejected.');
        setTimeout(() => setActionMsg(''), 2000);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger CBSL Synchronization
  const handleSyncCBSL = async () => {
    setActionMsg('Checking Central Bank of Sri Lanka portal for new bulletins...');
    try {
      const res = await fetch('/api/cbsl/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setActionMsg(data.message || 'CBSL reports checked and verified.');
      setTimeout(() => setActionMsg(''), 3000);
      loadData();
    } catch (err) {
      setActionMsg('Error running CBSL sync check.');
    }
  };

  // Save Corrected CBSL Price
  const handleSavePriceEdit = async (e) => {
    e.preventDefault();
    if (!editingPrice) return;
    try {
      const res = await fetch(`/api/cbsl/admin/update-price/${editingPrice.price_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          price: editPriceVal,
          previous_price: editPrevPriceVal
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditingPrice(null);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Market Status
  const handleSaveMarketStatus = async (e) => {
    e.preventDefault();
    if (!editingMarket) return;
    try {
      const res = await fetch(`/api/markets/${editingMarket.market_id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          current_status: marketStatus,
          opening_time: marketOpening,
          closing_time: marketClosing
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditingMarket(null);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Publish Announcement
  const handlePublishAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/markets/${annMarketId}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: annTitle,
          description: annDesc,
          announcement_type: annType,
          start_date: annStart,
          end_date: annEnd
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAnnounceModal(false);
        setAnnTitle('');
        setAnnDesc('');
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-agri-dark to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30">
                {t.admin} Control Center
              </span>
              <span className="text-xs text-slate-400 font-mono">Central Administrative Authority</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Platform Governance & Supervision
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Monitor CBSL synchronization, oversee connection verification, and manage market operations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCBSL}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.sync_now}</span>
            </button>
            <button
              onClick={() => setShowAnnounceModal(true)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Publish Notice</span>
            </button>
          </div>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Nav Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200 text-xs font-bold">
        {[
          { id: 'overview', label: t.tab_overview, icon: ShieldCheck },
          { id: 'requests', label: `${t.tab_connections_review} (${requests.filter(r => r.request_status !== 'approved_and_connected' && r.request_status !== 'rejected').length})`, icon: Share2 },
          { id: 'markets', label: t.tab_market_management, icon: Store },
          { id: 'cbsl', label: t.tab_cbsl_admin, icon: TrendingUp },
          { id: 'deliveries', label: `${t.tab_deliveries} (${deliveries.length})`, icon: FileText },
          { id: 'payments', label: t.tab_payments, icon: DollarSign },
          { id: 'users', label: t.tab_users_management, icon: Users }
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
          SECTION A: PLATFORM OVERVIEW
      ========================================================================== */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Total Suppliers</span>
              <p className="text-2xl font-extrabold text-slate-800">{stats.totalSuppliers}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Vegetable & fruit growers</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Total Distributors</span>
              <p className="text-2xl font-extrabold text-slate-800">{stats.totalDistributors}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Wholesale centre traders</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Wholesale Markets</span>
              <p className="text-2xl font-extrabold text-slate-800">{stats.totalMarkets}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Dambulla, Manning, Meegoda</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Active Partnerships</span>
              <p className="text-2xl font-extrabold text-emerald-700">{stats.activeConnections}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">Strict 1:1 supplier rule</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Pending Requests</span>
              <p className="text-2xl font-extrabold text-blue-700">{stats.pendingConnectionRequests}</p>
              <p className="text-[10px] text-blue-600 mt-0.5">Requires facilitation</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Deliveries Logged</span>
              <p className="text-2xl font-extrabold text-slate-800">{stats.totalDeliveries}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Digital settlement slips</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Disputed Slips</span>
              <p className="text-2xl font-extrabold text-red-600">{stats.disputedSettlements}</p>
              <p className="text-[10px] text-red-500 mt-0.5">Under dispute mediation</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Total Paid Value</span>
              <p className="text-2xl font-extrabold text-emerald-700">Rs. {Number(stats.totalPaidAmount).toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">PayHere verified</p>
            </div>
          </div>

          {/* Pending Connection Review Banner */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-800">Connection Requests Requiring Admin Action</h3>
                <p className="text-xs text-slate-500">Contact details sharing and final activation supervision</p>
              </div>
              <button
                onClick={() => setActiveTab('requests')}
                className="text-xs text-emerald-700 font-bold hover:underline"
              >
                View All Requests
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {requests.slice(0, 3).map(req => (
                <div key={req.request_id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-800 text-sm">
                      {req.supplier_name} → {req.distributor_name}
                    </span>
                    <p className="text-slate-500 text-[11px]">
                      Market: {req.market_name} • Status: <strong className="text-blue-700">{req.request_status}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {req.request_status === 'pending_admin_review' && (
                      <button
                        onClick={() => handleShareContact(req.request_id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs"
                      >
                        Share Contact Details
                      </button>
                    )}
                    {req.request_status === 'awaiting_admin_verification' && (
                      <button
                        onClick={() => handleVerifyActivate(req.request_id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
                      >
                        Activate Partnership
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION E: CONNECTION REQUEST MANAGEMENT
      ========================================================================== */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-agri-dark">Supplier-Distributor Connection Workflow</h2>
              <p className="text-xs text-slate-500">
                Supervise contact sharing, verify mutual agreement, and activate connections ensuring strict single-distributor rule.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Req #</th>
                    <th className="py-3 px-3">Supplier (Farmer)</th>
                    <th className="py-3 px-3">Distributor</th>
                    <th className="py-3 px-3">Wholesale Market</th>
                    <th className="py-3 px-3">Workflow Status</th>
                    <th className="py-3 px-3 text-center">Confirmations</th>
                    <th className="py-3 px-4 text-right">Administrative Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map(req => (
                    <tr key={req.request_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        #{req.request_id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-slate-800 block">{req.supplier_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{req.supplier_phone}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-slate-800 block">{req.distributor_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{req.distributor_phone}</span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-600">
                        {req.market_name}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-800 border border-blue-200">
                          {req.request_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-2 text-[10px] font-bold">
                          <span className={req.supplier_confirmed ? 'text-emerald-700' : 'text-slate-400'}>
                            Supp: {req.supplier_confirmed ? '✓' : '—'}
                          </span>
                          <span className={req.distributor_confirmed ? 'text-emerald-700' : 'text-slate-400'}>
                            Dist: {req.distributor_confirmed ? '✓' : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {req.request_status === 'pending_admin_review' && (
                          <button
                            onClick={() => handleShareContact(req.request_id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs"
                          >
                            Share Contact
                          </button>
                        )}

                        {req.request_status === 'awaiting_admin_verification' && (
                          <button
                            onClick={() => handleVerifyActivate(req.request_id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs"
                          >
                            Verify & Activate
                          </button>
                        )}

                        {req.request_status !== 'approved_and_connected' && req.request_status !== 'rejected' && (
                          <button
                            onClick={() => handleRejectRequest(req.request_id)}
                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-bold text-xs"
                          >
                            Reject
                          </button>
                        )}

                        {req.request_status === 'approved_and_connected' && (
                          <span className="text-emerald-700 font-bold text-xs flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Active Connection</span>
                          </span>
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
          SECTION B: MARKET MANAGEMENT
      ========================================================================== */}
      {activeTab === 'markets' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_market_management}</h2>
              <p className="text-xs text-slate-500">Operating hours, open/closed operational status, and wholesale centres</p>
            </div>
            <button
              onClick={() => setShowAnnounceModal(true)}
              className="px-3.5 py-1.5 bg-agri-dark text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Publish Market Announcement</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {markets.map(m => (
              <div key={m.market_id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-800">{m.market_name}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    m.current_status === 'open' ? 'bg-emerald-100 text-emerald-800' :
                    m.current_status === 'closed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {m.current_status}
                  </span>
                </div>

                <p className="text-xs text-slate-500">{m.location}</p>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trading Hours:</span>
                    <strong className="text-slate-700">{m.opening_time} - {m.closing_time}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Registered Stalls:</span>
                    <strong className="text-slate-700">{m.distributor_count || 1} Distributors</strong>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditingMarket(m);
                    setMarketStatus(m.current_status);
                    setMarketOpening(m.opening_time);
                    setMarketClosing(m.closing_time);
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Update Hours & Status</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION F: CBSL PRICE MANAGEMENT & EXTRACTION AUDIT
      ========================================================================== */}
      {activeTab === 'cbsl' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_cbsl_admin}</h2>
              <p className="text-xs text-slate-500">
                Review extracted CBSL daily prices. Correct OCR or parsing errors before publishing to suppliers.
              </p>
            </div>
            <button
              onClick={handleSyncCBSL}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.sync_now}</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase">
                Extracted Commodities ({cbslData.prices?.length || 0}) • CBSL Report Date: {cbslData.reportDate}
              </span>
              <span className="text-slate-400 font-mono">Source: Central Bank of Sri Lanka</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Commodity</th>
                    <th className="py-3 px-3">Market</th>
                    <th className="py-3 px-3 text-right">Extracted Price</th>
                    <th className="py-3 px-3 text-right">Previous Price</th>
                    <th className="py-3 px-3 text-right">Price Change</th>
                    <th className="py-3 px-3 text-right">% Change</th>
                    <th className="py-3 px-4 text-center">Audit Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cbslData.prices?.map(p => (
                    <tr key={p.price_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {p.product_name}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {p.market_name}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                        Rs. {Number(p.price).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        Rs. {p.previous_price ? Number(p.previous_price).toFixed(2) : '-'}
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${
                        p.price_change > 0 ? 'text-emerald-700' : p.price_change < 0 ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {p.price_change > 0 ? `+${p.price_change}` : p.price_change}
                      </td>
                      <td className="py-3 px-3 text-right font-bold">
                        {p.percentage_change}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setEditingPrice(p);
                            setEditPriceVal(p.price);
                            setEditPrevPriceVal(p.previous_price || '');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px]"
                        >
                          Edit / Correct
                        </button>
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
          SECTION G & H: DELIVERIES & PAYMENTS SUPERVISION
      ========================================================================== */}
      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-lg font-extrabold text-agri-dark">Delivery & Settlement Supervision</h2>
            <p className="text-xs text-slate-500">Audit trail of all slips, mutual confirmations, and active disputes</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Slip #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Distributor</th>
                    <th className="py-3 px-3">Commodity</th>
                    <th className="py-3 px-3 text-right">Accepted Qty</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3">Settlement Status</th>
                    <th className="py-3 px-4 text-center">Slip Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.map(d => (
                    <tr key={d.delivery_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">#{d.delivery_id}</td>
                      <td className="py-3 px-3 text-slate-600">{d.delivery_date}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{d.supplier_name}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{d.distributor_name}</td>
                      <td className="py-3 px-3 font-extrabold text-slate-800">{d.product_name}</td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-700">{d.accepted_quantity} kg</td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900">Rs. {Number(d.total_amount).toLocaleString()}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.delivery_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                          d.delivery_status === 'settled' ? 'bg-blue-100 text-blue-800' :
                          d.delivery_status === 'disputed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {d.delivery_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onViewSlip(d)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-lg font-extrabold text-agri-dark">PayHere Payment Gateway Ledger</h2>
            <p className="text-xs text-slate-500">Transaction references, sandbox verification logs, and settlement status</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100 text-xs">
              {payments.map(p => (
                <div key={p.payment_id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800 text-sm">{p.product_name}</span>
                      <span className="font-mono text-slate-500">Ref: {p.transaction_reference}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {p.payment_status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Distributor: {p.distributor_name} → Supplier: {p.supplier_name} • Method: PayHere Sandbox
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-base text-emerald-700">
                      Rs. {Number(p.amount).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION C & D: USER ACCOUNT MANAGEMENT
      ========================================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_users_management}</h2>
            <p className="text-xs text-slate-500">Registered suppliers and wholesale distributors in Sri Lanka</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Business / Farm</th>
                    <th className="py-3 px-3">Contact Phone</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.user_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {u.full_name}
                        <span className="text-[10px] text-slate-400 block font-normal">{u.email}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">
                        {u.farm_name || u.distributor_business || 'Platform Administration'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {u.phone_number}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {u.account_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CBSL Price Correction Modal */}
      {editingPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">
              Audit & Correct Price Record
            </h3>
            <p className="text-xs text-slate-500">
              Correct extraction errors for <strong>{editingPrice.product_name}</strong> ({editingPrice.market_name})
            </p>

            <form onSubmit={handleSavePriceEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Price (Rs/kg) *</label>
                <input
                  type="number"
                  step="0.5"
                  value={editPriceVal}
                  onChange={(e) => setEditPriceVal(e.target.value)}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Previous Price (Rs/kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editPrevPriceVal}
                  onChange={(e) => setEditPrevPriceVal(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPrice(null)}
                  className="px-3 py-1.5 text-slate-600 bg-slate-100 rounded-lg font-bold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold shadow-sm"
                >
                  Save & Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Market Status Modal */}
      {editingMarket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">
              Update Market Status & Hours
            </h3>
            <p className="text-xs text-slate-500">{editingMarket.market_name}</p>

            <form onSubmit={handleSaveMarketStatus} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Operational Status *</label>
                <select
                  value={marketStatus}
                  onChange={(e) => setMarketStatus(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-bold"
                >
                  <option value="open">Open (Normal Operations)</option>
                  <option value="closed">Closed</option>
                  <option value="special_hours">Special Unloading Hours</option>
                  <option value="temporarily_closed">Temporarily Closed</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Opening Time</label>
                <input
                  type="text"
                  value={marketOpening}
                  onChange={(e) => setMarketOpening(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Closing Time</label>
                <input
                  type="text"
                  value={marketClosing}
                  onChange={(e) => setMarketClosing(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMarket(null)}
                  className="px-3 py-1.5 text-slate-600 bg-slate-100 rounded-lg font-bold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-agri-dark text-white rounded-lg font-bold"
                >
                  Update Market
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Announcement Modal */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">
              Publish Wholesale Market Notice
            </h3>

            <form onSubmit={handlePublishAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Market *</label>
                <select
                  value={annMarketId}
                  onChange={(e) => setAnnMarketId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                >
                  {markets.map(m => (
                    <option key={m.market_id} value={m.market_id}>{m.market_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  required
                  placeholder="e.g. Special Holiday Hours / Rain Advisory"
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Announcement Details *</label>
                <textarea
                  value={annDesc}
                  onChange={(e) => setAnnDesc(e.target.value)}
                  required
                  rows={3}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={annStart}
                    onChange={(e) => setAnnStart(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={annEnd}
                    onChange={(e) => setAnnEnd(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  className="px-3 py-1.5 text-slate-600 bg-slate-100 rounded-lg font-bold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold"
                >
                  Broadcast Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
