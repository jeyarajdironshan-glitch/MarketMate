import React, { useState, useEffect } from 'react';
import { 
  Sprout, 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  Store, 
  Truck, 
  DollarSign, 
  Camera, 
  Clock, 
  ShieldCheck, 
  Mic, 
  Search, 
  AlertCircle, 
  ArrowRight, 
  FileText, 
  RefreshCw,
  Info,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import { translations } from '../i18n/translations';
import PriceChart from '../components/PriceChart';

export default function SupplierDashboard({
  currentUser,
  currentLang,
  token,
  onOpenVoice,
  onViewSlip
}) {
  const t = translations[currentLang] || translations.en;
  const [activeTab, setActiveTab] = useState('overview');

  // State
  const [connectionData, setConnectionData] = useState(null);
  const [cbslData, setCbslData] = useState({ prices: [], reportDate: '2026-11-05', sourceName: 'CBSL', lastSynchronizedAt: '' });
  const [priceFilter, setPriceFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [reliability, setReliability] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Distributor Change Request state
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [availableDistributors, setAvailableDistributors] = useState([]);
  const [selectedNewDistributor, setSelectedNewDistributor] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changeMsg, setChangeMsg] = useState('');

  // Fetch all initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Connection
      const connRes = await fetch('/api/connections/my-connection', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const connJson = await connRes.json();
      if (connJson.success) setConnectionData(connJson);

      // 2. CBSL Prices
      const cbslRes = await fetch('/api/cbsl/latest');
      const cbslJson = await cbslRes.json();
      if (cbslJson.success) setCbslData(cbslJson);

      // 3. Price Alerts
      const alertsRes = await fetch('/api/cbsl/alerts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const alertsJson = await alertsRes.json();
      if (alertsJson.success) setAlerts(alertsJson.alerts || []);

      // 4. Deliveries
      const delivRes = await fetch('/api/deliveries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const delivJson = await delivRes.json();
      if (delivJson.success) setDeliveries(delivJson.deliveries || []);

      // 5. Payments
      const payRes = await fetch('/api/payments/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payJson = await payRes.json();
      if (payJson.success) setPayments(payJson.payments || []);

      // 6. Market Announcements
      const annRes = await fetch('/api/markets/announcements/all');
      const annJson = await annRes.json();
      if (annJson.success) setAnnouncements(annJson.announcements || []);

      // 7. Reliability History
      const relRes = await fetch('/api/reliability/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const relJson = await relRes.json();
      if (relJson.success) setReliability(relJson);

    } catch (err) {
      console.error('Error fetching supplier dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Load available distributors when opening change modal
  const openDistributorChangeModal = async () => {
    try {
      const res = await fetch('/api/distributors');
      const data = await res.json();
      if (data.success) {
        setAvailableDistributors(data.distributors || []);
        setShowChangeModal(true);
      }
    } catch (err) {
      console.error('Failed to load distributors:', err);
    }
  };

  // Submit Distributor Change Request
  const handleSubmitChange = async (e) => {
    e.preventDefault();
    if (!selectedNewDistributor) return;
    try {
      const res = await fetch('/api/connections/change-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          proposed_distributor_id: selectedNewDistributor,
          reason: changeReason
        })
      });
      const data = await res.json();
      if (data.success) {
        setChangeMsg('Distributor change request submitted for administrative review.');
        setTimeout(() => {
          setShowChangeModal(false);
          setChangeMsg('');
          loadData();
        }, 1800);
      } else {
        setChangeMsg(data.message || 'Error submitting request.');
      }
    } catch (err) {
      setChangeMsg('Network error.');
    }
  };

  // Filtered CBSL Prices
  const filteredPrices = (cbslData.prices || []).filter(item => {
    const matchesMarket = priceFilter === 'All' || item.market_name.toLowerCase().includes(priceFilter.toLowerCase());
    const matchesSearch = item.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMarket && matchesSearch;
  });

  // Calculate totals
  const totalSettled = deliveries.filter(d => d.delivery_status === 'paid' || d.delivery_status === 'settled')
    .reduce((acc, cur) => acc + Number(cur.total_amount), 0);
  const totalPending = deliveries.filter(d => d.delivery_status === 'pending_review' || (d.delivery_status === 'settled' && d.payment_status !== 'completed'))
    .reduce((acc, cur) => acc + Number(cur.total_amount), 0);

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Welcome with Quick Voice Assistant Launch */}
      <div className="bg-gradient-to-r from-agri-dark via-agri-emerald to-agri-dark rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {t.supplier} Dashboard
              </span>
              <span className="text-xs text-slate-300 font-mono">ID: SUP-00{currentUser?.profile?.supplier_id || 1}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Welcome back, {currentUser?.full_name}!
            </h1>
            <p className="text-xs text-slate-200 mt-1 max-w-xl">
              {currentUser?.profile?.business_name} • Farm: {currentUser?.profile?.farm_location || 'Welimada & Dambulla'}
            </p>
          </div>

          {/* Quick Voice Bar Button */}
          <button
            onClick={onOpenVoice}
            className="px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center gap-3 backdrop-blur-xs transition shadow-sm"
          >
            <div className="w-9 h-9 rounded-full bg-agri-mint text-agri-dark flex items-center justify-center font-bold">
              <Mic className="w-5 h-5 text-agri-dark" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold leading-tight">{t.voice_assistant}</span>
              <span className="text-[10px] text-slate-200">Tap to speak in Tamil, Sinhala or English</span>
            </div>
          </button>
        </div>
      </div>

      {/* Navigation Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200 text-xs font-bold">
        {[
          { id: 'overview', label: t.tab_overview, icon: Layers },
          { id: 'prices', label: t.tab_cbsl_prices, icon: TrendingUp },
          { id: 'alerts', label: `${t.tab_price_alerts} (${alerts.length})`, icon: Bell },
          { id: 'distributor', label: t.tab_my_distributor, icon: Store },
          { id: 'deliveries', label: `${t.tab_deliveries} (${deliveries.length})`, icon: FileText },
          { id: 'payments', label: t.tab_payments, icon: DollarSign },
          { id: 'quality', label: t.tab_quality, icon: Camera },
          { id: 'market', label: t.tab_market_status, icon: Clock },
          { id: 'reliability', label: t.tab_reliability, icon: ShieldCheck }
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
          
          {/* Active Distributor Quick Banner */}
          {connectionData?.activeConnection ? (
            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">{t.current_distributor}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-slate-800">
                    {connectionData.activeConnection.distributor_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {connectionData.activeConnection.market_name} • {connectionData.activeConnection.stall_number} • Phone: <strong className="text-slate-700 font-mono">{connectionData.activeConnection.phone_number}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('distributor')}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  {t.view_details}
                </button>
                <button
                  onClick={openDistributorChangeModal}
                  className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                >
                  {t.request_change_distributor}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">No Active Distributor Connection</h4>
                  <p className="text-xs text-amber-800">
                    {connectionData?.activeRequest 
                      ? `Ongoing Request: ${connectionData.activeRequest.request_status} (${connectionData.activeRequest.proposed_distributor_name})`
                      : 'You do not have an active wholesale distributor. Browse wholesale markets and submit a connection request.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('distributor')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Find Distributor
              </button>
            </div>
          )}

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Deliveries</span>
                <Truck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">{deliveries.length}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Recorded with digital settlement slips</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Paid Value</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-700">Rs. {totalSettled.toLocaleString()}</p>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Verified PayHere settlements</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Pending Settlements</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-extrabold text-amber-700">Rs. {totalPending.toLocaleString()}</p>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Awaiting review or payment</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Smart Price Alerts</span>
                <Bell className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-extrabold text-blue-700">{alerts.length}</p>
              <p className="text-[11px] text-blue-600 font-medium mt-0.5">Latest CBSL market movements</p>
            </div>

          </div>

          {/* Quick CBSL Price Highlights Row */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-800">Today's CBSL Key Commodities</h3>
                <p className="text-xs text-slate-500">Official Wholesale Prices • {cbslData.reportDate}</p>
              </div>
              <button
                onClick={() => setActiveTab('prices')}
                className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
              >
                <span>View Full CBSL Board</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {cbslData.prices.slice(0, 3).map((item, idx) => (
                <PriceChart 
                  key={idx}
                  productName={item.product_name}
                  currentPrice={item.price}
                  previousPrice={item.previous_price}
                  percentageChange={item.percentage_change}
                  reportDate={cbslData.reportDate}
                />
              ))}
            </div>
          </div>

          {/* Recent Deliveries Overview */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-800">Recent Delivery Settlements</h3>
              <button
                onClick={() => setActiveTab('deliveries')}
                className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
              >
                <span>View All Deliveries</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {deliveries.slice(0, 3).map(deliv => (
                <div key={deliv.delivery_id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{deliv.product_name}</span>
                      <span className="text-xs text-slate-500 font-mono">Slip #{deliv.delivery_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        deliv.delivery_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                        deliv.delivery_status === 'settled' ? 'bg-blue-100 text-blue-800' :
                        deliv.delivery_status === 'disputed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {deliv.delivery_status === 'paid' ? 'Paid' : deliv.delivery_status === 'settled' ? 'Confirmed' : deliv.delivery_status === 'disputed' ? 'Disputed' : 'Pending Review'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {deliv.delivery_date} • {deliv.accepted_quantity} kg accepted (Sent: {deliv.quantity_sent} kg) • Rs. {deliv.agreed_price}/kg
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-extrabold text-sm text-slate-800">Rs. {Number(deliv.total_amount).toLocaleString()}</p>
                    <button
                      onClick={() => onViewSlip(deliv)}
                      className="text-xs text-emerald-700 font-bold hover:underline mt-0.5"
                    >
                      Inspect Slip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          SECTION B: DAILY CBSL MARKET PRICES
      ========================================================================== */}
      {activeTab === 'prices' && (
        <div className="space-y-4">
          
          {/* Header & CBSL Verification Metadata */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-agri-dark">{t.cbsl_title}</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    Official Central Bank
                  </span>
                </div>
                <p className="text-xs text-slate-500">{t.cbsl_subtitle}</p>
              </div>

              {/* Verified Metadata Box */}
              <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t.official_report_date}</span>
                  <strong className="text-slate-800 font-mono">{cbslData.reportDate}</strong>
                </div>
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t.last_sync_time}</span>
                  <span className="text-slate-700 font-mono">{new Date(cbslData.lastSynchronizedAt || Date.now()).toLocaleTimeString()}</span>
                </div>
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Source</span>
                  <span className="text-emerald-700 font-semibold">Central Bank of Sri Lanka</span>
                </div>
              </div>
            </div>

            {/* Mandatory Non-Speculation Disclaimer */}
            <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-[11px] text-emerald-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{t.disclaimer_cbsl}</span>
            </div>

            {/* Search & Market Filter Controls */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {['All', 'Dambulla', 'Manning Market'].map(mkt => (
                  <button
                    key={mkt}
                    onClick={() => setPriceFilter(mkt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      priceFilter === mkt
                        ? 'bg-agri-dark text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mkt === 'All' ? t.all_markets : mkt}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search vegetable or fruit..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Prices Grid Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Commodity</th>
                    <th className="py-3 px-3">Market Centre</th>
                    <th className="py-3 px-3 text-right">Latest CBSL Price</th>
                    <th className="py-3 px-3 text-right">Previous Price</th>
                    <th className="py-3 px-3 text-right">{t.price_change}</th>
                    <th className="py-3 px-3 text-right">{t.percentage_change}</th>
                    <th className="py-3 px-4">Trend Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPrices.map((item, idx) => {
                    const isSpike = item.percentage_change > 0;
                    const isDrop = item.percentage_change < 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-slate-800 text-sm block">{item.product_name}</span>
                          <span className="text-[10px] text-slate-400">{item.category} • per {item.unit}</span>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-600">
                          {item.market_name}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-sm text-slate-900">
                          Rs. {item.price.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500 font-medium">
                          Rs. {item.previous_price ? item.previous_price.toFixed(2) : '-'}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold ${
                          isSpike ? 'text-emerald-700' : isDrop ? 'text-red-600' : 'text-slate-500'
                        }`}>
                          {item.price_change > 0 ? `+Rs. ${item.price_change}` : (item.price_change < 0 ? `-Rs. ${Math.abs(item.price_change)}` : 'Rs. 0.00')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-full text-[11px] ${
                            isSpike ? 'bg-emerald-100 text-emerald-800' :
                            isDrop ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isSpike && <TrendingUp className="w-3 h-3" />}
                            {isDrop && <TrendingDown className="w-3 h-3" />}
                            {item.percentage_change > 0 ? `+${item.percentage_change}%` : `${item.percentage_change}%`}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-semibold ${
                            isSpike ? 'text-emerald-700' : isDrop ? 'text-red-600' : 'text-slate-500'
                          }`}>
                            {isSpike ? t.price_increased : (isDrop ? t.price_decreased : t.price_stable)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          SECTION C: SMART PRICE ALERTS
      ========================================================================== */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_price_alerts}</h2>
              <p className="text-xs text-slate-500">Automated price threshold triggers based on Central Bank daily bulletins</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {alerts.length} Active Alerts
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map(alert => (
              <div 
                key={alert.alert_id}
                className={`p-4 rounded-2xl border transition shadow-xs ${
                  alert.alert_type === 'significant_spike' ? 'bg-emerald-50/70 border-emerald-300' :
                  alert.alert_type === 'significant_drop' ? 'bg-red-50/70 border-red-300' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-sm">{alert.product_name}</span>
                    <span className="text-[10px] font-mono text-slate-400">({alert.market_name})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    alert.percentage_change > 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                  }`}>
                    {alert.percentage_change > 0 ? `+${alert.percentage_change}%` : `${alert.percentage_change}%`}
                  </span>
                </div>

                <p className="text-xs font-medium text-slate-700 leading-relaxed mb-3">
                  {alert.message}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 font-mono">
                  <span>Prev: Rs. {alert.previous_price} → Latest: <strong>Rs. {alert.current_price}</strong></span>
                  <span>{alert.report_date || '2026-11-05'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION D: MY DISTRIBUTOR & CONNECTION WORKFLOW
      ========================================================================== */}
      {activeTab === 'distributor' && (
        <div className="space-y-6">
          
          {/* Active Connection Card */}
          {connectionData?.activeConnection ? (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 block">
                    {t.current_distributor}
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                    {connectionData.activeConnection.distributor_name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Stall: {connectionData.activeConnection.stall_number} • {connectionData.activeConnection.market_name}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={openDistributorChangeModal}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl transition"
                  >
                    {t.request_change_distributor}
                  </button>
                </div>
              </div>

              {/* Contact Information (Unlocked after official connection approval) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Contact Person</span>
                  <strong className="text-slate-800">{connectionData.activeConnection.contact_person}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Direct Phone Number</span>
                  <strong className="text-slate-800 font-mono">{connectionData.activeConnection.phone_number}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Email Address</span>
                  <span className="text-slate-700">{connectionData.activeConnection.email}</span>
                </div>
              </div>

              {/* Wholesale Market Status */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-700" />
                  <span className="font-semibold text-emerald-950">
                    Operating Hours: {connectionData.activeConnection.opening_time} - {connectionData.activeConnection.closing_time}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-200 text-emerald-900">
                  {connectionData.activeConnection.market_status}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Store className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">No Active Distributor Assigned</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  According to platform rules, suppliers can connect with exactly one active wholesale distributor.
                </p>
              </div>
              <button
                onClick={openDistributorChangeModal}
                className="px-6 py-2.5 bg-agri-dark hover:bg-agri-emerald text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Browse & Request Distributor
              </button>
            </div>
          )}

          {/* Connection Workflow Tracker Banner */}
          {connectionData?.activeRequest && (
            <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-700 uppercase">Connection Workflow In Progress</span>
                  <h4 className="font-extrabold text-base text-slate-800">
                    Request with {connectionData.activeRequest.proposed_distributor_name}
                  </h4>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900">
                  {connectionData.activeRequest.request_status}
                </span>
              </div>

              {/* Multi-stage Progress Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                <div className="p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="block font-bold">1. Admin Review</span>
                  <span className="text-slate-500">Submitted</span>
                </div>
                <div className={`p-2 rounded border ${
                  connectionData.activeRequest.request_status !== 'pending_admin_review'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <span className="block">2. Contact Shared</span>
                  <span className="text-[10px]">With Consent</span>
                </div>
                <div className={`p-2 rounded border ${
                  connectionData.activeRequest.supplier_confirmed === 1
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <span className="block">3. Mutual Agreement</span>
                  <span className="text-[10px]">{connectionData.activeRequest.supplier_confirmed === 1 ? 'Confirmed' : 'Pending'}</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-200 text-slate-400">
                  <span className="block">4. Admin Verified</span>
                  <span className="text-[10px]">Final Activation</span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          SECTION E: DELIVERY HISTORY & SETTLEMENT SLIPS
      ========================================================================== */}
      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_deliveries}</h2>
              <p className="text-xs text-slate-500">Digital Delivery Settlement Slips with automatic accepted weight and payment calculations</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {deliveries.length} Slips Recorded
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Slip #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Commodity</th>
                    <th className="py-3 px-3 text-right">Sent (kg)</th>
                    <th className="py-3 px-3 text-right">Accepted (kg)</th>
                    <th className="py-3 px-3 text-right">Damaged/Rejected</th>
                    <th className="py-3 px-3 text-right">Total Amount</th>
                    <th className="py-3 px-3">Settlement Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
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
                      <td className="py-3 px-3 font-extrabold text-slate-800">
                        {deliv.product_name}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-600">
                        {deliv.quantity_sent} kg
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                        {deliv.accepted_quantity} kg
                      </td>
                      <td className="py-3 px-3 text-right text-red-600 font-semibold">
                        -{Number(deliv.damaged_quantity) + Number(deliv.rejected_quantity)} kg
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm">
                        Rs. {Number(deliv.total_amount).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          deliv.delivery_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                          deliv.delivery_status === 'settled' ? 'bg-blue-100 text-blue-800' :
                          deliv.delivery_status === 'disputed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {deliv.delivery_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onViewSlip(deliv)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
                        >
                          View Slip
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
          SECTION F: PAYMENT TRACKING
      ========================================================================== */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_payments}</h2>
              <p className="text-xs text-slate-500">Verified PayHere payment settlements and transaction history</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs font-bold uppercase text-emerald-700">Total Paid & Received</span>
              <p className="text-2xl font-extrabold text-emerald-900 mt-1">Rs. {totalSettled.toLocaleString()}</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">Verified PayHere gateway transfers</p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-xs font-bold uppercase text-amber-700">Pending Distributor Settlements</span>
              <p className="text-2xl font-extrabold text-amber-900 mt-1">Rs. {totalPending.toLocaleString()}</p>
              <p className="text-[11px] text-amber-700 mt-0.5">Under review or pending payout</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-700 uppercase">
              Payment Transaction Ledger
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {payments.map(pay => (
                <div key={pay.payment_id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800 text-sm">{pay.product_name}</span>
                      <span className="text-[10px] font-mono text-slate-400">Ref: {pay.transaction_reference}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                        {pay.payment_status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Paid by {pay.distributor_name} on {pay.payment_date || '2026-11-04'} via PayHere Sandbox
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-base text-emerald-700">
                      Rs. {Number(pay.amount).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION G: PRODUCT QUALITY FEEDBACK
      ========================================================================== */}
      {activeTab === 'quality' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_quality}</h2>
            <p className="text-xs text-slate-500">Distributor assessments and photographic evidence for your delivered produce</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deliveries.filter(d => d.quality_status || d.feedback_image).map(deliv => (
              <div key={deliv.delivery_id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{deliv.product_name}</h4>
                    <span className="text-[11px] text-slate-500">Delivery #{deliv.delivery_id} • {deliv.delivery_date}</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                    deliv.quality_status === 'Good' ? 'bg-emerald-100 text-emerald-800' :
                    deliv.quality_status === 'Average' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {deliv.quality_status}
                  </span>
                </div>

                {deliv.feedback_comments && (
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    "{deliv.feedback_comments}"
                  </p>
                )}

                {deliv.feedback_image && (
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <img src={deliv.feedback_image} alt="Produce Proof" className="w-full h-44 object-cover" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION H: MARKET ANNOUNCEMENTS
      ========================================================================== */}
      {activeTab === 'market' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-lg font-extrabold text-agri-dark">{t.tab_market_status}</h2>
            <p className="text-xs text-slate-500">Wholesale market operational hours, weather alerts and holiday schedules</p>
          </div>

          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.announcement_id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-sm">{ann.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                      {ann.announcement_type}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {ann.start_date} to {ann.end_date}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{ann.description}</p>
                <p className="text-[11px] text-emerald-700 font-semibold">Market: {ann.market_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION I: RELIABILITY HISTORY
      ========================================================================== */}
      {activeTab === 'reliability' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-lg font-extrabold text-agri-dark">{t.reliability_title}</h2>
            <p className="text-xs text-slate-500">{t.reliability_subtitle}</p>
          </div>

          {reliability?.summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Acceptance Ratio</span>
                <p className="text-3xl font-extrabold text-emerald-700 mt-1">{reliability.summary.acceptanceRate}%</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Produce weight accepted by distributors</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Fulfillment Status</span>
                <p className="text-3xl font-extrabold text-blue-700 mt-1">{reliability.summary.completionRate}%</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{reliability.summary.completedDeliveries} completed deliveries</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Trust Standing</span>
                <p className="text-2xl font-extrabold text-agri-dark mt-1">{reliability.summary.trustLevel}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Disputes: {reliability.summary.disputedDeliveries}</p>
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
                    Verified
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Distributor Change Request Modal */}
      {showChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">Request Distributor Change</h3>
            <p className="text-xs text-slate-500">
              Select a proposed wholesale distributor. The administrator will review and facilitate contact sharing before closing your current active connection.
            </p>

            <form onSubmit={handleSubmitChange} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Proposed Wholesale Distributor *
                </label>
                <select
                  value={selectedNewDistributor}
                  onChange={(e) => setSelectedNewDistributor(e.target.value)}
                  required
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="">Select from registered distributors...</option>
                  {availableDistributors.map(d => (
                    <option key={d.distributor_id} value={d.distributor_id}>
                      {d.business_name} ({d.market_name} - Stall {d.stall_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Migration *
                </label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Relocating crop harvest to Manning Market..."
                  rows={3}
                  required
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {changeMsg && (
                <p className="text-xs font-semibold text-emerald-700">{changeMsg}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
