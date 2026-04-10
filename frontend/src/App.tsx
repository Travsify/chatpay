import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Wallet, ShieldCheck, FileText, Send, User, Copy, Check, TrendingUp, CreditCard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
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

const Home = () => {
  return (
    <PageWrapper>
      <div className="w-full overflow-hidden">
        {/* NATIVE NAVBAR */}
        <nav className="fixed top-0 left-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2 md:gap-3">
              <img src="/logo.png" alt="ChatPay Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-[0_0_15px_rgba(37,211,102,0.4)]" />
              <span className="font-extrabold text-lg md:text-xl tracking-tighter text-white">ChatPay</span>
            </Link>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-text-muted">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
              <a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/admin" className="hidden md:block text-xs font-bold text-text-muted hover:text-white transition-colors uppercase tracking-widest">God Mode</Link>
              <a href="https://wa.me/2348000000000?text=Hi" target="_blank" rel="noopener noreferrer" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5">
                Launch App
              </a>
            </div>
          </div>
        </nav>

        {/* HERO SECTION */}
        <section className="relative pt-32 pb-16 md:pt-40 md:pb-20 px-4 md:px-6 max-w-7xl mx-auto text-center min-h-[90vh] flex flex-col justify-center">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[800px] h-[300px] md:h-[800px] bg-[#25D366]/10 rounded-full blur-[80px] md:blur-[120px] opacity-60 pointer-events-none" />
           <div className="absolute top-1/4 left-1/4 w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-[#128C7E]/10 rounded-full blur-[60px] md:blur-[100px] opacity-50 pointer-events-none" />
           
           <motion.div 
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, ease: "easeOut" }}
             className="relative z-10"
           >
             <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-surface border border-border mb-6 md:mb-8 backdrop-blur-md shadow-[0_0_20px_rgba(37,211,102,0.1)]">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#8696a0]">ChatPay Engine 2.0 Live</span>
             </div>
             
             <h1 className="text-[2.75rem] leading-[1.1] sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 md:mb-8 tracking-tighter text-white">
               Bank inside your <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#25D366] to-[#00A884]">WhatsApp.</span>
             </h1>
             
             <p className="text-base md:text-lg lg:text-xl text-[#8696a0] max-w-[90%] md:max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed font-medium">
               Transform your WhatsApp into a powerful banking hub. Send money, pay bills, trade crypto, and manage finances seamlessly with Virtual Accounts, Transfers & More.
             </p>
             
             <div className="flex flex-col sm:flex-row items-stretch justify-center gap-4 px-4 sm:px-0">
               <a href="https://wa.me/2348000000000?text=Hi ChatPay" target="_blank" rel="noopener noreferrer" className="px-6 py-4 md:px-8 md:py-4 bg-[#25D366] text-[#0b141a] rounded-2xl font-black text-base md:text-lg shadow-[0_0_30px_rgba(37,211,102,0.3)] hover:scale-105 transition-all flex items-center justify-center gap-2">
                 <Send size={20} /> Text to Bank
               </a>
               <Link to="/dashboard" className="px-6 py-4 md:px-8 md:py-4 bg-surface border border-border text-white rounded-2xl font-bold text-base md:text-lg hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                 <Wallet size={20} /> Web Dashboard
               </Link>
             </div>

             <div className="mt-12 md:mt-16 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
               <p className="text-xs md:text-sm font-bold tracking-widest uppercase text-[#8696a0]">Banking rails powered By</p>
               <div className="flex gap-4 md:gap-6 items-center">
                 <span className="text-lg md:text-xl font-black font-sans tracking-tight text-[#8696a0]">Fincra</span>
                 <span className="text-lg md:text-xl font-black font-sans tracking-tight text-[#8696a0]">Flutterwave</span>
               </div>
             </div>
           </motion.div>
        </section>

        {/* METRICS SECTION */}
        <section className="py-12 border-y border-border bg-[#0b141a]">
           <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-6 text-center">
             {[
               { value: "50k+", label: "Active Users" },
               { value: "₦2B+", label: "Transaction Volume" },
               { value: "99.9%", label: "Uptime" },
               { value: "<30s", label: "Average Response" }
             ].map((stat, i) => (
                <div key={i}>
                   <h3 className="text-3xl md:text-4xl font-black text-[#25D366] mb-2">{stat.value}</h3>
                   <p className="text-[#8696a0] text-sm md:text-base font-medium">{stat.label}</p>
                </div>
             ))}
           </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-20 md:py-32 px-4 md:px-6 max-w-7xl mx-auto overflow-hidden">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1 space-y-8 md:space-y-10 order-2 lg:order-1">
              <div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tight text-white">Banking in 3 simple steps.</h2>
                <p className="text-sm md:text-base text-[#8696a0] leading-relaxed">From first message to full financial control - get started in under 5 minutes without downloading a single app.</p>
              </div>
              
              <div className="space-y-8">
                {[
                  { step: "01", title: "Message ChatPay", text: "Send 'Hi ChatPay' to our WhatsApp number. No downloads, no signups required." },
                  { step: "02", title: "Get Your Wallet", text: "Receive virtual accounts instantly. Trade NGN & USD directly from your chat." },
                  { step: "03", title: "Start Transacting", text: "Send money, pay bills, and manage your finances with simple conversational commands." },
                ].map((s, i) => (
                  <div key={i} className="flex gap-4 md:gap-6 group">
                    <div className="font-mono text-[#25D366] font-black text-xl md:text-2xl mt-1 opacity-50 group-hover:opacity-100 transition-opacity">{s.step}</div>
                    <div>
                      <h4 className="font-bold text-lg md:text-xl mb-1 text-white">{s.title}</h4>
                      <p className="text-sm text-[#8696a0] leading-relaxed">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* WHATSAPP UI MOCKUP */}
            <div className="flex-1 w-full order-1 lg:order-2">
              <div className="w-full max-w-[320px] sm:max-w-sm mx-auto bg-[#0b141a] border border-[#222d34] rounded-[2.5rem] p-3 md:p-4 pb-8 relative shadow-[0_0_50px_rgba(37,211,102,0.15)] ring-8 ring-[#111b21] overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 md:w-40 h-6 bg-[#111b21] rounded-b-3xl mb-4 z-10" />
                {/* Status Bar */}
                <div className="bg-[#111b21] h-14 -mx-4 -mt-4 mb-2 flex items-center px-4 gap-3 border-b border-[#222d34]">
                   <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center p-1"><img src="/logo.png" className="w-6 h-6 object-contain filter brightness-0 invert" alt="logo"/></div>
                   <div>
                     <p className="text-white text-sm font-bold flex items-center gap-1">ChatPay <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]"></span></p>
                     <p className="text-[#25D366] text-[10px] font-medium">Online</p>
                   </div>
                </div>
                <div className="mt-6 space-y-4 px-1 pb-4">
                   <div className="bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm p-3 w-fit ml-auto text-[13px] shadow-sm transform transition-all hover:scale-[1.02]">
                     Hi ChatPay! 👋
                     <p className="text-[9px] text-[#8696a0] text-right mt-1">10:30 AM ✓✓</p>
                   </div>
                   <div className="bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-sm p-3 w-[85%] text-[13px] shadow-sm transform transition-all hover:scale-[1.02]">
                     Welcome to ChatPay! 🎉 I'm your personal banking assistant. What would you like to do today?
                     <p className="text-[9px] text-[#8696a0] text-right mt-1">10:30 AM</p>
                   </div>
                   <div className="bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm p-3 w-fit ml-auto text-[13px] shadow-sm transform transition-all hover:scale-[1.02]">
                     💰 Send Money
                     <p className="text-[9px] text-[#8696a0] text-right mt-1">10:31 AM ✓✓</p>
                   </div>
                   <div className="bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-sm p-3 w-[85%] text-[13px] shadow-sm transform transition-all hover:scale-[1.02]">
                     Perfect! Who would you like to send money to?
                     <p className="text-[9px] text-[#8696a0] text-right mt-1">10:31 AM</p>
                   </div>
                   <div className="bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm p-3 w-4/5 ml-auto text-[13px] shadow-sm transform transition-all hover:scale-[1.02]">
                     Send ₦5000 to John - 0123456789 GTB Bank
                     <p className="text-[9px] text-[#8696a0] text-right mt-1">10:31 AM ✓✓</p>
                   </div>
                   <div className="bg-[#202c33] border-l-2 border-[#25D366] text-[#e9edef] rounded-2xl rounded-tl-sm p-3 w-[85%] text-[13px] shadow-sm transform transition-all hover:scale-[1.02]">
                     ✅ Transfer successful! 💰<br/><br/>₦5,000 sent to John Doe<br/>🏦 GTBank (0123456789)<br/>⏰ Completed in 2.3 seconds
                     <p className="text-[9px] text-[#8696a0] text-right mt-1">10:32 AM</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPLIANCE & FEATURES */}
        <section id="features" className="py-20 md:py-24 px-4 md:px-6 bg-[#111b21] border-y border-[#222d34]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 md:mb-20 px-2">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tight text-white">Trust & Security.</h2>
              <p className="text-sm md:text-base text-[#8696a0] max-w-2xl mx-auto leading-relaxed">Built with enterprise-grade security architecture, guaranteeing your funds and data are isolated and protected unconditionally.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
              {[
                { icon: ShieldCheck, title: "NDIC Insured", desc: "Your funds are guaranteed and protected unconditionally." },
                { icon: ShieldCheck, title: "AML Compliant", desc: "Bank-grade Anti-money laundering protocols integrated natively." },
                { icon: ShieldCheck, title: "GDPR Ready", desc: "Data protection compliant across all international boundaries." },
                { icon: ShieldCheck, title: "E2E Encrypted", desc: "Leveraging WhatsApp's AES-256 end-to-end messaging encryption." },
              ].map((f, i) => (
                <div key={i} className="bg-[#0b141a] p-8 rounded-[2rem] border border-[#222d34] hover:-translate-y-2 hover:border-[#25D366]/50 transition-all duration-300 shadow-lg text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-3xl bg-[#128C7E]/20 flex items-center justify-center mb-6">
                    <f.icon className="text-[#25D366]" size={30} />
                  </div>
                  <h3 className="text-lg font-bold mb-3 tracking-tight text-white">{f.title}</h3>
                  <p className="text-sm text-[#8696a0] leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section id="testimonials" className="py-20 md:py-24 px-4 md:px-6 bg-[#0b141a] overflow-hidden">
          <div className="max-w-7xl mx-auto text-center mb-12 md:mb-16 px-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tight text-white">Loved by Nigerians.</h2>
            <p className="text-sm md:text-base text-[#8696a0]">Don't just take our word for it.</p>
          </div>
          <div className="flex gap-4 md:gap-6 overflow-x-auto pb-8 snap-x snap-mandatory px-4 md:px-6 hide-scrollbar">
             {[
               { name: "Oyekanmi E.", handle: "@oyecode", text: "ChatPay is literally sorcery. I paid my electricity bill while mid-conversation with my boss on WhatsApp. Didn't even switch apps." },
               { name: "Sarah M.", handle: "@sarah_designs", text: "The invoicing feature is insane. I just type 'invoice client 50k' and it generates a beautiful checkout link. Got paid in 2 minutes." },
               { name: "Chinedu A.", handle: "@chinedu_tech", text: "The fact that this doesn't exist as an app on my phone is the best part. Ultimate stealth banking. Beautiful architecture." },
             ].map((t, i) => (
               <div key={i} className="bg-[#111b21] border border-[#222d34] min-w-[85vw] sm:min-w-[340px] md:min-w-[400px] p-6 md:p-8 rounded-[2rem] snap-center flex-shrink-0 hover:border-[#25D366]/30 transition-colors">
                 <div className="flex items-center gap-4 mb-6">
                   <div className="w-12 h-12 bg-gradient-to-br from-[#128C7E] to-[#075E54] rounded-full shadow-inner" />
                   <div className="text-left">
                     <p className="font-bold text-sm md:text-base text-white">{t.name}</p>
                     <p className="text-xs md:text-sm text-[#25D366]">{t.handle}</p>
                   </div>
                 </div>
                 <p className="text-sm md:text-base leading-relaxed text-[#8696a0] text-left">"{t.text}"</p>
               </div>
             ))}
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="py-24 md:py-32 px-4 md:px-6 bg-[#0b141a]">
          <div className="max-w-5xl mx-auto bg-[#111b21] border border-[#222d34] rounded-[3rem] p-8 md:p-20 text-center relative overflow-hidden shadow-[0_0_40px_rgba(37,211,102,0.1)]">
            <div className="absolute inset-0 bg-gradient-to-t from-[#128C7E]/20 to-transparent pointer-events-none" />
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-6 relative z-10 tracking-tight text-white">Stop downloading apps.</h2>
            <p className="text-base md:text-lg text-[#8696a0] mb-10 relative z-10 max-w-xl mx-auto">Join the revolution. Turn your WhatsApp into a high-powered financial terminal today.</p>
            <a href="https://wa.me/2348000000000?text=Hi ChatPay" target="_blank" rel="noopener noreferrer" className="bg-[#25D366] hover:bg-[#128C7E] text-[#0b141a] hover:text-white hover:scale-105 inline-flex py-4 px-8 md:py-5 md:px-10 rounded-2xl font-black text-base md:text-lg relative z-10 transition-all shadow-[0_0_20px_rgba(37,211,102,0.4)]">
              Start Chatting Now
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-[#222d34] bg-[#0b141a] pt-16 md:pt-20 pb-8 px-4 md:px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-12 mb-16">
            <div className="col-span-1 sm:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" className="w-8 h-8 object-contain" alt="ChatPay" />
                <span className="font-bold text-xl text-white">ChatPay</span>
              </div>
              <p className="text-[#8696a0] text-sm max-w-xs leading-relaxed">The autonomous financial engine running purely on API architecture and WhatsApp infrastructure.</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link to="/kyc" className="hover:text-white transition-colors">Verification (KYC)</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><Link to="/admin" className="hover:text-white transition-colors">God Mode (Internal)</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] md:text-xs text-text-muted font-mono pt-8 border-t border-border">
            <p>© 2026 ChatPay Autonomous Corp.</p>
            <div className="flex gap-4 items-center">
               <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> STATUS: GREEN</span>
               <span className="px-2 py-0.5 rounded bg-surface border border-border">v2.4.0</span>
            </div>
          </div>
        </footer>
      </div>
    </PageWrapper>
  );
};

function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-text selection:bg-primary/30 font-sans">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={
            <>
              {/* Universal Navbar for internal pages */}
              <nav className="bg-surface/80 backdrop-blur-xl mx-4 md:mx-6 my-4 md:my-6 p-4 flex justify-between items-center sticky top-4 md:top-6 z-50 rounded-2xl border border-border shadow-lg">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
                <Link to="/" className="flex items-center gap-2 md:gap-3 active:scale-95 transition-transform">
                  <img src="/logo.png" className="w-10 h-10 object-contain" alt="ChatPay" />
                  <span className="font-extrabold text-xl tracking-tighter text-white">ChatPay</span>
                </Link>
                <div className="flex gap-2 items-center">
                  <Link to="/admin" className="hidden md:block text-[10px] font-black text-text-muted hover:text-primary transition-colors uppercase tracking-[0.2em] px-4">God Mode</Link>
                  <Link to="/kyc" className="p-3 hover:bg-white/10 rounded-2xl transition-all border border-white/5"><ShieldCheck size={20} /></Link>
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 hover:border-primary/50 transition-colors cursor-pointer group">
                    <User size={22} className="group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </nav>
              <Dashboard />
            </>
          } />
          <Route path="/kyc" element={
            <>
              <nav className="bg-surface/80 backdrop-blur-xl mx-4 md:mx-6 my-4 md:my-6 p-4 flex justify-between items-center sticky top-4 md:top-6 z-50 rounded-2xl border border-border shadow-lg">
                <Link to="/" className="flex items-center gap-2 md:gap-3 active:scale-95 transition-transform">
                  <img src="/logo.png" className="w-10 h-10 object-contain" alt="ChatPay" />
                  <span className="font-extrabold text-xl tracking-tighter text-white">ChatPay</span>
                </Link>
              </nav>
              <KYC />
            </>
          } />
          <Route path="/pay/:id" element={<Checkout />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

export default App;
