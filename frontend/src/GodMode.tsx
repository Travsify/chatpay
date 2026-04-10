import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ShieldCheck, FileText, Send, User, TrendingUp,
  Activity, MessageSquare, Zap, Lock, LogOut, Search,
  ChevronLeft, ChevronRight, Eye, Ban, CheckCircle, XCircle,
  Server, Database, Clock, Users, BarChart3, AlertTriangle,
  RefreshCw, Filter, MessageCircle, Globe, Shield, Terminal,
  ArrowUpRight, ArrowDownRight, Hash, Settings
} from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ===== AUTH CONTEXT =====
const useAuth = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cpay_token'));
  const [admin, setAdmin] = useState<any>(() => {
    const stored = localStorage.getItem('cpay_admin');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (newToken: string, adminData: any) => {
    localStorage.setItem('cpay_token', newToken);
    localStorage.setItem('cpay_admin', JSON.stringify(adminData));
    setToken(newToken);
    setAdmin(adminData);
  };

  const logout = () => {
    localStorage.removeItem('cpay_token');
    localStorage.removeItem('cpay_admin');
    setToken(null);
    setAdmin(null);
  };

  const api = useCallback((path: string, options: any = {}) => {
    return axios({
      url: `${API_BASE}${path}`,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
      ...options
    });
  }, [token]);

  return { token, admin, login, logout, api, isAuth: !!token };
};

// ===== LOGIN PAGE =====
const LoginPage = ({ onLogin }: { onLogin: (token: string, admin: any) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);

  useEffect(() => {
    // Check if setup is needed
    axios.post(`${API_BASE}/api/auth/login`, { email: 'check', password: 'check' })
      .catch(err => {
        // If we get 401, login exists. If server error, might need setup
        setSetupChecked(true);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSetup) {
        const res = await axios.post(`${API_BASE}/api/auth/setup`, { email, password, name });
        onLogin(res.data.token, res.data.admin);
      } else {
        const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
        onLogin(res.data.token, res.data.admin);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Connection failed';
      if (msg === 'Setup already completed. Use login instead.') {
        setIsSetup(false);
        setError('Login to your existing admin account.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#25D366]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-[#128C7E]/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(37,211,102,0.3)]">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">God Mode</h1>
          <p className="text-[#8696a0] text-sm mt-2">ChatPay Admin Command Center</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111b21] border border-[#222d34] rounded-3xl p-8 space-y-5">
          {isSetup && (
            <div className="bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl p-4 mb-4">
              <p className="text-[#25D366] text-xs font-bold uppercase tracking-wider">First Time Setup</p>
              <p className="text-[#8696a0] text-xs mt-1">Create your Super Admin account</p>
            </div>
          )}

          {isSetup && (
            <div>
              <label className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest mb-2 block">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#0b141a] border border-[#222d34] rounded-xl px-4 py-3.5 text-white text-sm focus:border-[#25D366] focus:outline-none transition-colors"
                placeholder="Admin Name"
                required
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest mb-2 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0b141a] border border-[#222d34] rounded-xl px-4 py-3.5 text-white text-sm focus:border-[#25D366] focus:outline-none transition-colors"
              placeholder="admin@chatpay.io"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest mb-2 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#0b141a] border border-[#222d34] rounded-xl px-4 py-3.5 text-white text-sm focus:border-[#25D366] focus:outline-none transition-colors"
              placeholder="••••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-red-400 text-xs font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white py-4 rounded-xl font-bold text-sm transition-all hover:shadow-[0_0_20px_rgba(37,211,102,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Lock size={16} />
                {isSetup ? 'Create Super Admin' : 'Enter God Mode'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSetup(!isSetup)}
            className="w-full text-[#8696a0] text-xs hover:text-white transition-colors py-2"
          >
            {isSetup ? '← Back to Login' : 'First time? Setup Admin →'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// ===== STAT CARD =====
const StatCard = ({ label, value, trend, icon: Icon, color, sub }: any) => (
  <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-5 hover:border-[#25D366]/30 transition-all hover:-translate-y-0.5 group">
    <div className="flex justify-between items-start mb-3">
      <div className={`p-2.5 rounded-xl bg-white/5 ${color || 'text-[#25D366]'}`}>
        <Icon size={20} />
      </div>
      {trend && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          trend.startsWith('+') || trend.startsWith('9') ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-red-500/10 text-red-400'
        }`}>{trend}</span>
      )}
    </div>
    <p className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest mb-1">{label}</p>
    <h3 className="text-2xl font-black text-white tracking-tight">{value}</h3>
    {sub && <p className="text-[10px] text-[#8696a0] mt-1">{sub}</p>}
  </div>
);

// ===== STATUS BADGE =====
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    SUCCESS: 'bg-[#25D366]/10 text-[#25D366]',
    VERIFIED: 'bg-[#25D366]/10 text-[#25D366]',
    PROCESSED: 'bg-[#25D366]/10 text-[#25D366]',
    OPERATIONAL: 'bg-[#25D366]/10 text-[#25D366]',
    PENDING: 'bg-amber-500/10 text-amber-400',
    RECEIVED: 'bg-blue-500/10 text-blue-400',
    FAILED: 'bg-red-500/10 text-red-400',
    DEGRADED: 'bg-red-500/10 text-red-400',
    INBOUND: 'bg-blue-500/10 text-blue-400',
    OUTBOUND: 'bg-purple-500/10 text-purple-400',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${styles[status] || 'bg-white/5 text-[#8696a0]'}`}>
      {status}
    </span>
  );
};

// ===== SIDEBAR =====
const Sidebar = ({ activeTab, setActiveTab, admin, onLogout }: any) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: Wallet },
    { id: 'conversations', label: 'AI Logs', icon: MessageSquare },
    { id: 'webhooks', label: 'Webhooks', icon: Zap },
    { id: 'health', label: 'System', icon: Server },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#111b21] border-r border-[#222d34] min-h-screen flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-6 border-b border-[#222d34]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-2xl flex items-center justify-center shadow-lg">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <p className="font-black text-white text-sm tracking-tight">God Mode</p>
            <p className="text-[#25D366] text-[10px] font-bold uppercase tracking-widest">ChatPay v3</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#25D366]/10 text-[#25D366] font-bold'
                : 'text-[#8696a0] hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Admin Info */}
      <div className="p-4 border-t border-[#222d34]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#25D366] to-[#075E54] rounded-full flex items-center justify-center text-white font-black text-sm">
            {admin?.name?.[0] || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold truncate">{admin?.name || 'Admin'}</p>
            <p className="text-[#8696a0] text-[10px] font-bold uppercase tracking-wider">{admin?.role || 'OPERATOR'}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 text-[#8696a0] hover:text-red-400 text-xs font-bold py-2 rounded-lg hover:bg-red-500/5 transition-all"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  );
};

// ===== OVERVIEW TAB =====
const OverviewTab = ({ api }: { api: any }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/api/admin/metrics').then((r: any) => r.data),
      api('/api/admin/analytics?days=14').then((r: any) => r.data).catch(() => null)
    ]).then(([m, a]) => {
      setMetrics(m);
      setAnalytics(a);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner label="Loading metrics..." />;
  if (!metrics) return <ErrorState message="Failed to load metrics" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Dashboard</h1>
          <p className="text-[#8696a0] text-sm">Real-time network intelligence</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="bg-[#111b21] border border-[#25D366]/30 px-3 py-1.5 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#25D366]">Live</span>
          </div>
          <span className="text-[10px] text-[#8696a0] font-mono">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Network Volume" value={metrics.tpv} trend="+22%" icon={Wallet} color="text-[#25D366]" sub={`${metrics.todayTx} tx today`} />
        <StatCard label="Total Users" value={metrics.totalUsers} trend={`+${metrics.todayUsers} today`} icon={Users} color="text-blue-400" sub={`${metrics.verifiedUsers} verified`} />
        <StatCard label="AI Accuracy" value={metrics.aiAccuracy} trend="Stable" icon={Activity} color="text-purple-400" sub={`${metrics.totalConversations} conversations`} />
        <StatCard label="Webhook Health" value={metrics.webhookSuccessRate} trend={metrics.failedWebhooks > 0 ? `${metrics.failedWebhooks} failed` : 'Clean'} icon={Zap} color="text-amber-400" sub={`${metrics.totalWebhooks} total`} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Volume Chart */}
        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#8696a0] uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#25D366]" /> Transaction Volume (14d)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.dailyData || []}>
                <defs>
                  <linearGradient id="gradVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222d34" />
                <XAxis dataKey="date" tick={{ fill: '#8696a0', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <Area type="monotone" dataKey="volume" stroke="#25D366" strokeWidth={2} fill="url(#gradVolume)" />
                <Tooltip
                  contentStyle={{ background: '#111b21', border: '1px solid #222d34', borderRadius: '12px', fontSize: 12 }}
                  formatter={(value: any) => [`₦${Number(value).toLocaleString()}`, 'Volume']}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction Count Chart */}
        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#8696a0] uppercase tracking-widest mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-400" /> Daily Transactions (14d)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.dailyData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222d34" />
                <XAxis dataKey="date" tick={{ fill: '#8696a0', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#8696a0', fontSize: 10 }} />
                <Bar dataKey="count" fill="#25D366" radius={[4, 4, 0, 0]} />
                <Tooltip contentStyle={{ background: '#111b21', border: '1px solid #222d34', borderRadius: '12px', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="KYC Compliance" value={metrics.kycCompliance} icon={ShieldCheck} color="text-[#25D366]" />
        <StatCard label="Pending KYC" value={metrics.pendingKyc} icon={Clock} color="text-amber-400" />
        <StatCard label="Suspended" value={metrics.suspendedUsers} icon={Ban} color="text-red-400" />
        <StatCard label="Success Rate" value={`${metrics.totalTx > 0 ? ((metrics.successTx / metrics.totalTx) * 100).toFixed(1) : '100'}%`} icon={CheckCircle} color="text-[#25D366]" />
      </div>
    </div>
  );
};

// ===== USERS TAB =====
const UsersTab = ({ api }: { api: any }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (kycFilter) params.set('kyc', kycFilter);
      const res = await api(`/api/admin/users?${params}`);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [api, search, kycFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleVerify = async (userId: string, status: string) => {
    await api(`/api/admin/users/${userId}/verify`, { method: 'POST', data: { status } });
    fetchUsers(pagination.page);
  };

  const handleSuspend = async (userId: string) => {
    await api(`/api/admin/users/${userId}/suspend`, { method: 'POST' });
    fetchUsers(pagination.page);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">User Management</h1>
          <p className="text-[#8696a0] text-sm">{pagination.total || 0} total users</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by phone or name..."
            className="w-full bg-[#111b21] border border-[#222d34] rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none transition-colors"
          />
        </div>
        <select
          value={kycFilter}
          onChange={e => setKycFilter(e.target.value)}
          className="bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none appearance-none cursor-pointer"
        >
          <option value="">All KYC</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-[#111b21] border border-[#222d34] rounded-2xl overflow-hidden">
        {loading ? <LoadingSpinner label="Loading users..." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#222d34]">
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">User</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">KYC</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Transactions</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Status</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Joined</th>
                  <th className="text-right text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => (
                  <tr key={user.id} className="border-b border-[#222d34]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/20 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {(user.name?.[0] || user.phoneNumber[0]).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-semibold">{user.name || 'Unnamed'}</p>
                          <p className="text-[#8696a0] text-xs font-mono">{user.phoneNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={user.kycStatus} /></td>
                    <td className="px-5 py-4 text-sm text-[#8696a0]">{user._count?.transactions || 0}</td>
                    <td className="px-5 py-4">
                      {user.suspended ? (
                        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-full">SUSPENDED</span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#25D366] bg-[#25D366]/10 px-2 py-1 rounded-full">ACTIVE</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-[#8696a0] font-mono">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 justify-end">
                        {user.kycStatus === 'PENDING' && (
                          <>
                            <button onClick={() => handleVerify(user.id, 'VERIFIED')} className="p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors" title="Verify"><CheckCircle size={14} /></button>
                            <button onClick={() => handleVerify(user.id, 'FAILED')} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Reject"><XCircle size={14} /></button>
                          </>
                        )}
                        <button onClick={() => handleSuspend(user.id)} className={`p-2 rounded-lg transition-colors ${user.suspended ? 'bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`} title={user.suspended ? 'Reactivate' : 'Suspend'}>
                          <Ban size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-4 border-t border-[#222d34]">
            <p className="text-xs text-[#8696a0]">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => fetchUsers(pagination.page - 1)} className="p-2 rounded-lg bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-colors"><ChevronLeft size={16} /></button>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchUsers(pagination.page + 1)} className="p-2 rounded-lg bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== TRANSACTIONS TAB =====
const TransactionsTab = ({ api }: { api: any }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTx = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      const res = await api(`/api/admin/transactions?${params}`);
      setTransactions(res.data.transactions);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [api, search, statusFilter, typeFilter]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Transaction Explorer</h1>
        <p className="text-[#8696a0] text-sm">{pagination.total || 0} total transactions</p>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference, phone, or name..." className="w-full bg-[#111b21] border border-[#222d34] rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none appearance-none cursor-pointer">
          <option value="">All Status</option>
          <option value="SUCCESS">Success</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none appearance-none cursor-pointer">
          <option value="">All Types</option>
          <option value="P2P_SEND">P2P Send</option>
          <option value="FUNDING">Funding</option>
          <option value="BILL_PAYMENT">Bill Payment</option>
          <option value="AIRTIME">Airtime</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#111b21] border border-[#222d34] rounded-2xl overflow-hidden">
        {loading ? <LoadingSpinner label="Loading transactions..." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#222d34]">
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Reference</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">User</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Type</th>
                  <th className="text-right text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Amount</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Status</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Provider</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-[#222d34]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono text-white">{tx.reference}</p>
                      {tx.description && <p className="text-[10px] text-[#8696a0]">{tx.description}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#8696a0]">{tx.user?.name || tx.user?.phoneNumber || '-'}</td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold text-[#8696a0] bg-white/5 px-2 py-1 rounded-full">{tx.type}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`font-bold text-sm ${tx.type === 'P2P_SEND' ? 'text-red-400' : 'text-[#25D366]'}`}>
                        {tx.type === 'P2P_SEND' ? '-' : '+'}₦{tx.amount?.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={tx.status} /></td>
                    <td className="px-5 py-4 text-xs text-[#8696a0]">{tx.provider}</td>
                    <td className="px-5 py-4 text-xs text-[#8696a0] font-mono">{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-[#8696a0] text-sm">No transactions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-4 border-t border-[#222d34]">
            <p className="text-xs text-[#8696a0]">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</p>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => fetchTx(pagination.page - 1)} className="p-2 rounded-lg bg-white/5 text-white disabled:opacity-30"><ChevronLeft size={16} /></button>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchTx(pagination.page + 1)} className="p-2 rounded-lg bg-white/5 text-white disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== CONVERSATIONS TAB =====
const ConversationsTab = ({ api }: { api: any }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ page: 1, totalPages: 1 });
  const [intentFilter, setIntentFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (intentFilter) params.set('intent', intentFilter);
      const res = await api(`/api/admin/conversations?${params}`);
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [api, intentFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">AI Conversation Logs</h1>
        <p className="text-[#8696a0] text-sm">WhatsApp message history with AI intent analysis</p>
      </div>

      <div className="flex gap-3">
        <select value={intentFilter} onChange={e => setIntentFilter(e.target.value)} className="bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none appearance-none cursor-pointer">
          <option value="">All Intents</option>
          <option value="SIGNUP">Signup</option>
          <option value="SEND_FUNDS">Send Funds</option>
          <option value="CHECK_BALANCE">Check Balance</option>
          <option value="INVOICE">Invoice</option>
          <option value="UNKNOWN">Unknown</option>
          <option value="AI_FALLBACK">AI Fallback</option>
        </select>
      </div>

      <div className="space-y-3">
        {loading ? <LoadingSpinner label="Loading conversations..." /> : (
          logs.map((log: any) => (
            <div key={log.id} className={`bg-[#111b21] border rounded-2xl p-4 ${log.direction === 'INBOUND' ? 'border-blue-500/20' : 'border-[#25D366]/20'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <StatusBadge status={log.direction} />
                  {log.intent && <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">{log.intent}</span>}
                </div>
                <span className="text-[10px] text-[#8696a0] font-mono">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{log.message}</p>
              <div className="flex items-center gap-2 mt-2">
                <User size={12} className="text-[#8696a0]" />
                <span className="text-[10px] text-[#8696a0]">{log.user?.name || log.user?.phoneNumber || 'Unknown'}</span>
              </div>
            </div>
          ))
        )}
        {!loading && logs.length === 0 && (
          <div className="text-center py-16 text-[#8696a0]">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs">Messages will appear here when users interact with ChatPay</p>
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center">
          <p className="text-xs text-[#8696a0]">Page {pagination.page} of {pagination.totalPages}</p>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)} className="p-2 rounded-lg bg-[#111b21] border border-[#222d34] text-white disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchLogs(pagination.page + 1)} className="p-2 rounded-lg bg-[#111b21] border border-[#222d34] text-white disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== WEBHOOKS TAB =====
const WebhooksTab = ({ api }: { api: any }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ page: 1, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api(`/api/admin/webhooks?${params}`);
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [api, statusFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Webhook Monitor</h1>
        <p className="text-[#8696a0] text-sm">Inbound/outbound WhatsApp message delivery tracking</p>
      </div>

      <div className="flex gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none appearance-none cursor-pointer">
          <option value="">All Status</option>
          <option value="RECEIVED">Received</option>
          <option value="PROCESSED">Processed</option>
          <option value="FAILED">Failed</option>
        </select>
        <button onClick={() => fetchLogs()} className="bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-[#8696a0] hover:text-white hover:border-[#25D366] transition-colors flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="bg-[#111b21] border border-[#222d34] rounded-2xl overflow-hidden">
        {loading ? <LoadingSpinner label="Loading webhooks..." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#222d34]">
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Direction</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Phone</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Status</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Latency</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Error</th>
                  <th className="text-left text-[10px] font-bold text-[#8696a0] uppercase tracking-widest px-5 py-4">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-[#222d34]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {log.direction === 'INBOUND' ? <ArrowDownRight size={14} className="text-blue-400" /> : <ArrowUpRight size={14} className="text-purple-400" />}
                        <StatusBadge status={log.direction} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#8696a0] font-mono">{log.phoneNumber}</td>
                    <td className="px-5 py-4"><StatusBadge status={log.status} /></td>
                    <td className="px-5 py-4 text-xs text-[#8696a0] font-mono">{log.latencyMs ? `${log.latencyMs}ms` : '-'}</td>
                    <td className="px-5 py-4 text-xs text-red-400 max-w-[200px] truncate">{log.errorMsg || '-'}</td>
                    <td className="px-5 py-4 text-xs text-[#8696a0] font-mono">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-[#8696a0] text-sm">No webhook logs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== SYSTEM HEALTH TAB =====
const HealthTab = ({ api }: { api: any }) => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/api/admin/health');
      setHealth(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [api]);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  if (loading) return <LoadingSpinner label="Checking system health..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">System Health</h1>
          <p className="text-[#8696a0] text-sm">Infrastructure monitoring & diagnostics</p>
        </div>
        <button onClick={fetchHealth} className="bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-2 text-sm text-[#8696a0] hover:text-white hover:border-[#25D366] transition-colors flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Status Banner */}
      <div className={`rounded-2xl p-6 border flex items-center gap-4 ${
        health?.status === 'OPERATIONAL'
          ? 'bg-[#25D366]/5 border-[#25D366]/20'
          : 'bg-red-500/5 border-red-500/20'
      }`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          health?.status === 'OPERATIONAL' ? 'bg-[#25D366]/20' : 'bg-red-500/20'
        }`}>
          {health?.status === 'OPERATIONAL'
            ? <CheckCircle size={24} className="text-[#25D366]" />
            : <AlertTriangle size={24} className="text-red-400" />
          }
        </div>
        <div>
          <h2 className="text-lg font-black text-white">{health?.status || 'UNKNOWN'}</h2>
          <p className="text-[#8696a0] text-xs">All systems are functioning normally</p>
        </div>
      </div>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-[#25D366]" />
            <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">Database</span>
          </div>
          <p className="text-2xl font-black text-white">{health?.dbLatencyMs || 0}ms</p>
          <p className="text-xs text-[#8696a0] mt-1">Query latency</p>
        </div>

        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} className="text-blue-400" />
            <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">Active Sessions</span>
          </div>
          <p className="text-2xl font-black text-white">{health?.activeSessions || 0}</p>
          <p className="text-xs text-[#8696a0] mt-1">Last 15 minutes</p>
        </div>

        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-purple-400" />
            <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">Uptime</span>
          </div>
          <p className="text-2xl font-black text-white">{health?.uptime ? `${(health.uptime / 3600).toFixed(1)}h` : '0h'}</p>
          <p className="text-xs text-[#8696a0] mt-1">Process uptime</p>
        </div>

        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Server size={16} className="text-amber-400" />
            <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">Memory</span>
          </div>
          <p className="text-2xl font-black text-white">{health?.memoryUsage ? `${(health.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB` : '0MB'}</p>
          <p className="text-xs text-[#8696a0] mt-1">Heap used of {health?.memoryUsage ? `${(health.memoryUsage.heapTotal / 1024 / 1024).toFixed(0)}MB` : '0MB'} total</p>
        </div>

        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Terminal size={16} className="text-[#25D366]" />
            <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">Node.js</span>
          </div>
          <p className="text-2xl font-black text-white">{health?.nodeVersion || 'Unknown'}</p>
          <p className="text-xs text-[#8696a0] mt-1">Runtime version</p>
        </div>

        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={16} className="text-blue-400" />
            <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">Last Webhook</span>
          </div>
          <p className="text-sm font-bold text-white">{health?.lastWebhook ? new Date(health.lastWebhook.at).toLocaleString() : 'No webhooks yet'}</p>
          {health?.lastWebhook && <StatusBadge status={health.lastWebhook.status} />}
        </div>
      </div>

      {/* System Info */}
      <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#8696a0] uppercase tracking-widest mb-4 flex items-center gap-2">
          <Hash size={16} /> System Identity
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-[10px] text-[#8696a0] uppercase tracking-wider mb-1">Platform</p><p className="text-white font-bold">ChatPay v3.0</p></div>
          <div><p className="text-[10px] text-[#8696a0] uppercase tracking-wider mb-1">Engine</p><p className="text-white font-bold">God Mode</p></div>
          <div><p className="text-[10px] text-[#8696a0] uppercase tracking-wider mb-1">AI Model</p><p className="text-white font-bold">GPT-4o</p></div>
          <div><p className="text-[10px] text-[#8696a0] uppercase tracking-wider mb-1">Banking</p><p className="text-white font-bold">Fincra + FW</p></div>
        </div>
      </div>
    </div>
  );
};

// ===== HELPERS =====
const LoadingSpinner = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <div className="w-10 h-10 border-3 border-[#222d34] border-t-[#25D366] rounded-full animate-spin" />
    <p className="text-[#8696a0] text-xs font-bold uppercase tracking-widest">{label}</p>
  </div>
);

const ErrorState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <AlertTriangle size={40} className="text-red-400 opacity-50" />
    <p className="text-red-400 text-sm font-bold">{message}</p>
  </div>
);

// ===== SETTINGS TAB =====
const SettingsTab = ({ api }: { api: any }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'New passwords do not match', isError: true });
      return;
    }

    setLoading(true);
    setMessage({ text: '', isError: false });

    try {
      await api('/api/auth/update-password', {
        method: 'POST',
        data: { currentPassword, newPassword }
      });
      setMessage({ text: 'Password updated successfully!', isError: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.error || 'Failed to update password',
        isError: true
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Admin Settings</h1>
        <p className="text-[#8696a0] text-sm">Manage your God Mode credentials</p>
      </div>

      <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Change Password</h2>
        <form onSubmit={handleUpdatePassword} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest mb-2 block">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full bg-[#0b141a] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest mb-2 block">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-[#0b141a] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest mb-2 block">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-[#0b141a] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-white focus:border-[#25D366] focus:outline-none transition-colors"
              required
            />
          </div>

          {message.text && (
            <div className={`p-3 rounded-lg text-sm font-medium ${message.isError ? 'bg-red-500/10 text-red-400' : 'bg-[#25D366]/10 text-[#25D366]'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white py-3.5 rounded-xl font-bold text-sm transition-all hover:shadow-[0_0_20px_rgba(37,211,102,0.3)] disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ===== MAIN GOD MODE COMPONENT =====
const GodMode = () => {
  const { token, admin, login, logout, api, isAuth } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (!isAuth) {
    return <LoginPage onLogin={login} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab api={api} />;
      case 'users': return <UsersTab api={api} />;
      case 'transactions': return <TransactionsTab api={api} />;
      case 'conversations': return <ConversationsTab api={api} />;
      case 'webhooks': return <WebhooksTab api={api} />;
      case 'health': return <HealthTab api={api} />;
      case 'settings': return <SettingsTab api={api} />;
      default: return <OverviewTab api={api} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} admin={admin} onLogout={logout} />
      
      <main className="ml-64 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default GodMode;
