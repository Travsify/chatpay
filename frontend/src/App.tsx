import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Wallet, ShieldCheck, FileText, Send, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Pages
const Dashboard = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
    <div className="glass-card p-8 mb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
      <p className="text-text-muted text-sm font-medium uppercase tracking-wider mb-2">Available Balance</p>
      <h1 className="text-4xl font-bold mb-6">₦15,250.75</h1>
      <div className="flex gap-4">
        <button className="btn btn-primary"><Send size={18} /> Send Money</button>
        <button className="btn" style={{ background: 'var(--glass)' }}>Add Funds</button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText size={20} className="text-accent" /> Recent Transactions
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
              <div>
                <p className="font-medium">To @JohnDoe</p>
                <p className="text-xs text-text-muted">Yesterday, 4:20 PM</p>
              </div>
              <p className="font-semibold text-error">-₦2,500.00</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ShieldCheck size={20} className="text-success" /> Verification Status
        </h3>
        <div className="bg-success/10 border border-success/20 p-4 rounded-xl mb-4">
          <p className="text-success text-sm font-medium">Identity Verified (Tier 1)</p>
          <p className="text-xs text-success/80 mt-1">Daily limit: ₦500k</p>
        </div>
        <button className="text-primary text-sm font-medium hover:underline">Upgrade to Tier 2 →</button>
      </div>
    </div>
  </motion.div>
);

const KYC = () => (
  <div className="p-6 max-w-lg mx-auto">
    <div className="glass-card p-8">
      <h1 className="text-2xl font-bold mb-2">Complete Verification</h1>
      <p className="text-text-muted mb-8">Let's get your account fully compliant to unlock higher limits.</p>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Document Type</label>
          <select className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white">
            <option>BVN Verification</option>
            <option>NIN (Digital ID)</option>
            <option>International Passport</option>
          </select>
        </div>
        
        <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
          <FileText className="mx-auto mb-4 text-text-muted" size={40} />
          <p className="font-medium">Click to upload document</p>
          <p className="text-xs text-text-muted mt-2">PDF, JPG, PNG (Max 5MB)</p>
        </div>

        <button className="btn btn-primary w-full">Submit for Review</button>
      </div>
    </div>
  </div>
);

const Checkout = () => (
  <div className="p-6 max-w-lg mx-auto">
    <div className="glass-card p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold">Secure Checkout</h1>
          <p className="text-text-muted mt-1">Invoice #INV-29384</p>
        </div>
        <div className="bg-primary/10 p-3 rounded-2xl">
          <Wallet className="text-primary" />
        </div>
      </div>
      
      <div className="bg-white/5 rounded-2xl p-6 mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-text-muted">Service</span>
          <span className="font-medium">Logo Design</span>
        </div>
        <div className="flex justify-between border-t border-white/10 pt-4 mt-2">
          <span className="text-text-muted">Amount</span>
          <span className="text-2xl font-bold">₦50,000.00</span>
        </div>
      </div>

      <div className="space-y-4">
        <button className="btn btn-primary w-full p-6 text-lg">
          Pay with ChatPay Wallet
        </button>
        <button className="btn w-full bg-white/5 border border-white/10">
          Other Payment Methods
        </button>
      </div>

      <p className="text-center text-xs text-text-muted mt-8">
        Protected by Fincra & ChatPay Secure Protocol
      </p>
    </div>
  </div>
);

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AdminDashboard = () => {
    const [metrics, setMetrics] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        axios.get(`${API_BASE}/api/admin/metrics`)
            .then(res => {
                setMetrics(res.data);
                setLoading(false);
            })
            .catch(err => console.error('Failed to fetch metrics', err));
    }, []);

    if (loading) return <div className="p-20 text-center animate-pulse">Initializing God Mode...</div>;

    return (
  <div className="p-6">
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-3xl font-bold title-gradient">God Mode</h1>
        <p className="text-text-muted">Master Control & Analytics</p>
      </div>
      <div className="flex gap-4">
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
          <span className="text-xs font-medium">System Online</span>
        </div>
      </div>
    </div>

    {/* Metric Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {[
    { label: 'Total TPV', value: metrics.tpv, growth: '+12%', icon: Wallet, color: 'text-primary' },
    { label: 'Active Users', value: metrics.totalUsers, growth: '+5%', icon: User, color: 'text-secondary' },
    { label: 'Total Tx', value: metrics.totalTx, growth: 'Stable', icon: FileText, color: 'text-success' },
    { label: 'AI Accuracy', value: metrics.aiAccuracy, growth: 'Stable', icon: ShieldCheck, color: 'text-accent' },
      ].map((m, i) => (
        <div key={i} className="glass-card p-6">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2 rounded-lg bg-white/5 ${m.color}`}><m.icon size={20} /></div>
            <span className="text-xs text-success font-medium">{m.growth}</span>
          </div>
          <p className="text-text-muted text-xs mb-1 uppercase tracking-wider">{m.label}</p>
          <h2 className="text-2xl font-bold">{m.value}</h2>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Live Transaction Feed */}
      <div className="lg:col-span-2 glass-card p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <FileText size={20} className="text-primary" /> Live Transaction Pulse
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-text-muted text-xs uppercase border-b border-white/10">
                <th className="pb-4 font-medium">User</th>
                <th className="pb-4 font-medium">Type</th>
                <th className="pb-4 font-medium">Amount</th>
                <th className="pb-4 font-medium">Status</th>
                <th className="pb-4 font-medium">Agent</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { user: '+234 812...', type: 'P2P Transfer', amount: '₦15,000', status: 'Success', agent: 'AI_GPT4o' },
                { user: '+234 905...', type: 'Utility Bill', amount: '₦2,500', status: 'Pending', agent: 'AI_GPT4o' },
                { user: '+234 703...', type: 'Funding', amount: '₦50,000', status: 'Success', agent: 'System' },
              ].map((t, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 font-medium">{t.user}</td>
                  <td className="py-4">{t.type}</td>
                  <td className="py-4 font-bold">{t.amount}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] ${t.status === 'Success' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-4 text-xs text-text-muted">{t.agent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* KYC Queue */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <ShieldCheck size={20} className="text-accent" /> Pending KYC Review
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium text-sm">User_{i}92</p>
                <span className="text-[10px] text-text-muted">2 mins ago</span>
              </div>
              <p className="text-xs text-text-muted mb-4">Doc type: NIN (Naira ID Card)</p>
              <div className="flex gap-2">
                <button className="flex-1 bg-success/20 text-success text-xs py-2 rounded-lg hover:bg-success/30">Verify</button>
                <button className="flex-1 bg-error/20 text-error text-xs py-2 rounded-lg hover:bg-error/30">Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="glass-card mx-4 my-4 p-4 flex justify-between items-center sticky top-4 z-50">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-primary/20">C</div>
            <span className="font-bold text-xl tracking-tight">ChatPay</span>
          </Link>
          <div className="flex gap-4 items-center">
            <Link to="/admin" className="text-xs font-bold text-text-muted hover:text-primary transition-colors uppercase tracking-widest">God Mode</Link>
            <Link to="/kyc" className="p-2 hover:bg-white/5 rounded-lg transition-colors"><ShieldCheck size={22} /></Link>
            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
              <User size={20} />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kyc" element={<KYC />} />
            <Route path="/pay/:id" element={<Checkout />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>

        {/* Floating Action Button (for Mobile feel) */}
        <div className="fixed bottom-8 right-8">
          <button className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 hover:scale-110 transition-transform">
            <Send size={24} className="text-white" />
          </button>
        </div>
      </div>
    </Router>
  );
}

export default App;
