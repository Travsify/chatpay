import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Wallet, ShieldCheck, FileText, Send, User, Copy, Check, TrendingUp, CreditCard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';

// --- STYLES & CONFIG ---
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const chartData = [
  { name: 'Mon', amount: 4000 },
  { name: 'Tue', amount: 3000 },
  { name: 'Wed', amount: 6000 },
  { name: 'Thu', amount: 5000 },
  { name: 'Fri', amount: 9000 },
  { name: 'Sat', amount: 12000 },
  { name: 'Sun', amount: 15250 },
];

// --- COMPONENTS ---

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -15 }}
    transition={{ duration: 0.35, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={onCopy} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-muted">
      {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
    </button>
  );
};

// --- PAGES ---

const Dashboard = () => (
  <PageWrapper>
    <div className="p-6 space-y-6">
      {/* Balance Card */}
      <div className="glass-card p-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:bg-primary/30 transition-colors"></div>
        <div className="relative z-10">
          <p className="text-text-muted text-sm font-medium uppercase tracking-[0.2em] mb-2">Total Balance</p>
          <div className="flex items-baseline gap-2">
            <h1 className="text-5xl font-bold tracking-tighter">₦15,250.75</h1>
            <span className="text-success text-sm font-bold flex items-center gap-1">
              <TrendingUp size={14} /> +2.4%
            </span>
          </div>
          
          <div className="flex gap-4 mt-8">
            <button className="btn btn-primary flex-1 py-4 text-base shadow-xl shadow-primary/20">
              <Send size={18} /> Send
            </button>
            <button className="btn flex-1 py-4 text-base border border-white/10 bg-white/5 hover:bg-white/10">
              <CreditCard size={18} /> Top up
            </button>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="glass-card p-6 flex justify-between items-center border-l-4 border-l-primary">
        <div>
          <p className="text-text-muted text-[10px] uppercase font-bold tracking-widest mb-1">Your Fincra Account</p>
          <p className="text-sm font-medium">9038472910 • WEMA BANK</p>
        </div>
        <CopyButton text="9038472910" />
      </div>

      {/* Spending Insights Chart */}
      <div className="glass-card p-6 h-64 overflow-hidden">
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4 px-2">Spending Pulse</h3>
        <ResponsiveContainer width="100%" height="80%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Feed */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Activity</h3>
          <button className="text-xs text-primary font-bold">See all</button>
        </div>
        {[
          { icon: Send, title: 'To John Smith', note: 'Logo Design', amount: '-₦12,000', color: 'text-error' },
          { icon: TrendingUp, title: 'From External Bank', note: 'Wallet Funding', amount: '+₦25,000', color: 'text-success' },
        ].map((item, i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-4 hover:translate-x-1 transition-transform cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
              <item.icon size={20} className="text-text-muted" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{item.title}</p>
              <p className="text-xs text-text-muted">{item.note}</p>
            </div>
            <p className={`font-bold ${item.color}`}>{item.amount}</p>
          </div>
        ))}
      </div>
    </div>
  </PageWrapper>
);

const KYC = () => (
  <PageWrapper>
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="glass-card p-8">
        <div className="w-16 h-16 bg-accent/20 rounded-3xl flex items-center justify-center mb-6">
          <ShieldCheck size={32} className="text-accent" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Identify Yourself</h1>
        <p className="text-text-muted mb-8 text-sm">Upload your documents to unlock full banking features and higher transaction limits.</p>
        
        <div className="space-y-6">
          <div className="relative group">
            <p className="text-xs font-bold text-text-muted uppercase mb-2 ml-1">Identity Type</p>
            <select className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white appearance-none focus:border-primary transition-colors outline-none cursor-pointer">
              <option>BVN (Standard)</option>
              <option>NIN (Digital ID)</option>
              <option>International Passport</option>
            </select>
            <ChevronRight className="absolute right-4 bottom-4 text-text-muted group-hover:text-primary transition-colors rotate-90" size={18} />
          </div>
          
          <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 text-center hover:border-primary/50 transition-all cursor-pointer bg-white/5">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-text-muted" size={24} />
            </div>
            <p className="font-bold text-sm">Drop your document here</p>
            <p className="text-[10px] text-text-muted mt-1 uppercase tracking-widest">PDF, JPG (Max 10MB)</p>
          </div>

          <button className="btn btn-primary w-full py-5 text-base font-bold tracking-tight">
            Verify Identity
          </button>
        </div>
      </div>
    </div>
  </PageWrapper>
);

const Checkout = () => (
  <PageWrapper>
    <div className="p-6 max-w-lg mx-auto">
      <div className="glass-card p-8 border-t-8 border-t-primary">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Secure Checkout</h1>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Invoice · INV-2024-04</p>
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/10">
            <Wallet className="text-primary" size={24} />
          </div>
        </div>
        
        <div className="bg-white/5 rounded-3xl p-6 mb-8 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-muted">Pay To</span>
            <span className="font-bold">John Design Freelance</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-muted">Description</span>
            <span className="font-bold text-right">Premium UI Design & Brand Identity</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-white/10">
            <span className="text-lg font-bold">Amount Due</span>
            <span className="text-3xl font-bold text-primary tracking-tighter">₦50,000</span>
          </div>
        </div>

        <div className="space-y-3">
          <button className="btn btn-primary w-full py-5 text-lg font-bold">
            Confirm Payment
          </button>
          <button className="btn w-full bg-white/5 border border-white/10 py-5 text-sm font-bold text-text-muted">
            Pay with Card or Transfer
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all">
          <ShieldCheck size={14} />
          <p className="text-[10px] font-bold uppercase tracking-widest">Protected by ChatPay Secure</p>
        </div>
      </div>
    </div>
  </PageWrapper>
);

const AdminDashboard = () => {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${API_BASE}/api/admin/metrics`)
            .then(res => {
                setMetrics(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error('API Error:', err);
                setMetrics({ tpv: '₦0', totalUsers: '0', totalTx: '0', aiAccuracy: '0%' });
                setLoading(false);
            });
    }, []);

    if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-text-muted font-bold text-xs uppercase tracking-widest">Accessing God Mode...</p>
        </div>
      </div>
    );

    return (
  <PageWrapper>
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-extrabold title-gradient leading-tight">God Mode</h1>
          <p className="text-text-muted font-medium">ChatPay Network Intelligence</p>
        </div>
        <div className="flex gap-4">
          <div className="glass-card px-4 py-2 flex items-center gap-2 border border-success/30 bg-success/5">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse shadow-glow shadow-success"></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-success">Nodes Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Network volume', value: metrics.tpv, trend: '+22%', icon: Wallet, color: 'text-primary' },
          { label: 'Onboarded users', value: metrics.totalUsers, trend: '+4%', icon: User, color: 'text-secondary' },
          { label: 'Total Handled', value: metrics.totalTx, trend: 'Stable', icon: FileText, color: 'text-success' },
          { label: 'AI Accuracy', value: metrics.aiAccuracy, trend: '99.1%', icon: ShieldCheck, color: 'text-accent' },
        ].map((m, i) => (
          <div key={i} className="glass-card p-6 border-b-2 border-b-white/5 transition-all hover:border-b-primary hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl bg-white/5 ${m.color}`}><m.icon size={24} /></div>
              <span className="text-[10px] text-success font-bold bg-success/10 px-2 py-1 rounded-full">{m.trend}</span>
            </div>
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-1">{m.label}</p>
            <h2 className="text-3xl font-bold tracking-tighter">{m.value}</h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8">
          <h3 className="text-lg font-bold mb-8 flex items-center gap-2 uppercase tracking-tight">
            <TrendingUp size={20} className="text-primary" /> Live Traffic
          </h3>
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between items-center pb-4 border-b border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold font-mono">#{i}9</div>
                  <div>
                    <p className="font-bold text-sm">+234 812 000 000</p>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Intent: SEND_FUNDS</p>
                  </div>
                </div>
                <p className="font-bold">₦{i * 5},000</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="glass-card p-8 bg-primary/5 border border-primary/20">
          <h3 className="text-lg font-bold mb-4 uppercase tracking-tight">System Health</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-3xl bg-white/5">
              <p className="text-[10px] font-bold text-text-muted mb-1">API LATENCY</p>
              <p className="text-2xl font-bold mono">42ms</p>
            </div>
            <div className="p-4 rounded-3xl bg-white/5">
              <p className="text-[10px] font-bold text-text-muted mb-1">AI SUCCESS</p>
              <p className="text-2xl font-bold mono text-success">98.5%</p>
            </div>
          </div>
          <div className="mt-8 p-6 rounded-3xl bg-background border border-white/5 flex items-center justify-between">
             <div>
              <p className="text-xs font-bold">Auto-Syncing with Fincra Node</p>
              <p className="text-text-muted text-[10px]">Last heartbeat: Just now</p>
             </div>
             <div className="w-3 h-3 bg-success rounded-full shadow-glow"></div>
          </div>
        </div>
      </div>
    </div>
  </PageWrapper>
);
};

function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-text selection:bg-primary/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[150px]"></div>
      </div>

      <div className="relative z-10">
        {/* Universal Navbar */}
        <nav className="glass-card mx-6 my-6 p-4 flex justify-between items-center sticky top-6 z-50 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <Link to="/" className="flex items-center gap-3 active:scale-95 transition-transform">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-primary/30 relative">
               C
               <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-background"></div>
            </div>
            <span className="font-extrabold text-2xl tracking-tighter title-gradient">ChatPay</span>
          </Link>
          
          <div className="flex gap-2 items-center">
            <Link to="/admin" className="hidden md:block text-[10px] font-black text-text-muted hover:text-primary transition-colors uppercase tracking-[0.2em] px-4">God Mode</Link>
            <Link to="/kyc" className="p-3 hover:bg-white/10 rounded-2xl transition-all border border-white/5"><ShieldCheck size={20} /></Link>
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 hover:border-primary/50 transition-colors cursor-pointer group">
              <User size={22} className="group-hover:text-primary transition-colors" />
            </div>
          </div>
        </nav>

        {/* Dynamic Route Transitions */}
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kyc" element={<KYC />} />
            <Route path="/pay/:id" element={<Checkout />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </AnimatePresence>

        {/* Global Action Menu */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-4 bg-background/80 backdrop-blur-2xl px-6 py-4 rounded-3xl border border-white/10 shadow-2xl">
           <button className="flex flex-col items-center gap-1 group">
             <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white scale-110 group-active:scale-90 transition-transform"><Send size={18} /></div>
             <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Send</span>
           </button>
           <button className="flex flex-col items-center gap-1 group">
             <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-text-muted group-active:scale-90 transition-transform"><Wallet size={18} /></div>
             <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Cards</span>
           </button>
           <button className="flex flex-col items-center gap-1 group">
             <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-text-muted group-active:scale-90 transition-transform"><User size={18} /></div>
             <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Profile</span>
           </button>
        </div>
      </div>
    </div>
  );
}

export default App;
