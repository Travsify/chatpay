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
        <nav className="fixed top-0 left-0 w-full z-50 bg-background/70 backdrop-blur-3xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-black shadow-glow">C</div>
              <span className="font-extrabold text-xl tracking-tighter text-white">ChatPay</span>
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
        <section className="relative pt-40 pb-20 px-6 max-w-7xl mx-auto text-center min-h-screen flex flex-col justify-center">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
           <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px] opacity-40 pointer-events-none" />
           
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.7 }}
             className="relative z-10"
           >
             <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-text-muted">ChatPay Engine 2.0 Live</span>
             </div>
             
             <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter leading-[1.1] title-gradient">
               Banking, <br/> But Make It <span className="text-transparent bg-clip-text bg-gradient-to-r from-success to-primary">WhatsApp.</span>
             </h1>
             
             <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
               No downloads. No passwords. Just say "Send 5k to Mom" on WhatsApp and watch the magic happen. The most invisible, yet powerful banking app ever built.
             </p>
             
             <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <a href="https://wa.me/2348000000000?text=Hi, let's start" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-8 py-4 bg-white text-background rounded-2xl font-black text-lg shadow-glow hover:scale-105 transition-transform flex items-center justify-center gap-2">
                 <Send size={20} /> Text to Bank
               </a>
               <Link to="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                 <Wallet size={20} /> Web Dashboard
               </Link>
             </div>

             <div className="mt-16 flex items-center justify-center gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
               <p className="text-sm font-bold tracking-widest uppercase text-text-muted">Powered By</p>
               <div className="flex gap-6 items-center">
                 <span className="text-xl font-black">OpenAI</span>
                 <span className="text-xl font-black">Fincra</span>
                 <span className="text-xl font-black">Flutterwave</span>
               </div>
             </div>
           </motion.div>
        </section>

        {/* VALUE PROP / FEATURES SECTION */}
        <section id="features" className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black mb-4">Why We Are Different.</h2>
              <p className="text-text-muted max-w-xl mx-auto">We ripped out everything you hate about banking apps and rebuilt the core mechanics on top of the world's most ubiquitous messaging network.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Wallet, title: "Zero App Footprint", desc: "No App Store, no updates, no taking up storage. Your entire bank lives inside a WhatsApp contact." },
                { icon: ShieldCheck, title: "Bank-Grade KYC", desc: "Enterprise-level identity verification happens seamlessly within the chat interface using AI-driven logic." },
                { icon: FileText, title: "Instant Invoicing", desc: "Generate payment links and professional invoices for your clients just by typing 'invoice 50k for logo'." },
              ].map((f, i) => (
                <div key={i} className="glass-card p-8 hover:-translate-y-2 transition-all duration-300 group">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <f.icon className="text-primary" size={28} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-text-muted leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-32 px-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 space-y-10">
              <div>
                <h2 className="text-4xl md:text-5xl font-black mb-4">Conversational Finance.</h2>
                <p className="text-text-muted text-lg">Literally just talk to it like a human assistant. The GPT-4o engine parses your intent and executes.</p>
              </div>
              
              <div className="space-y-6">
                {[
                  { step: "01", title: "Say Hello", text: "Save our number and send a message. The AI responds instantly." },
                  { step: "02", title: "Intent Parsing", text: "Ask it to pay a bill, send money, or check balance. It understands natural language." },
                  { step: "03", title: "Confirmation", text: "Review the exact details and confirm. Settled in milliseconds via real banking rails." },
                ].map((s, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="font-mono text-primary font-bold text-xl">{s.step}</div>
                    <div>
                      <h4 className="font-bold text-lg">{s.title}</h4>
                      <p className="text-text-muted">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 w-full">
              <div className="w-full max-w-sm mx-auto glass-card border-[8px] border-white/5 rounded-[3rem] p-4 p-b-8 relative shadow-2xl shadow-primary/20 bg-background/50">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-white/5 rounded-b-2xl mb-4" />
                <div className="mt-8 space-y-4">
                   <div className="bg-white/10 text-white rounded-2xl rounded-tr-sm p-4 w-4/5 ml-auto text-sm">
                     Send 15,000 to John for dinner
                   </div>
                   <div className="bg-primary/20 text-white rounded-2xl rounded-tl-sm p-4 w-4/5 text-sm border border-primary/30">
                     Got it. You want to send <b>₦15,000</b> to <b>John</b>.<br/><br/>Reply "YES" to confirm transfer.
                   </div>
                   <div className="bg-white/10 text-white rounded-2xl rounded-tr-sm p-4 w-fit ml-auto text-sm">
                     YES
                   </div>
                   <div className="bg-success/20 text-success-light rounded-2xl rounded-tl-sm p-4 w-4/5 text-sm border border-success/30">
                     ✅ Transfer successful!<br/>Ref: CHATPAY-9938
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section id="testimonials" className="py-24 px-6 bg-white/[0.02] border-y border-white/5 overflow-hidden">
          <div className="max-w-7xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-black mb-4">Loved by Nigerians.</h2>
            <p className="text-text-muted">Don't just take our word for it.</p>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory px-6" style={{ scrollbarWidth: 'none' }}>
             {[
               { name: "Oyekanmi E.", handle: "@oyecode", text: "ChatPay is literally sorcery. I paid my electricity bill while mid-conversation with my boss on WhatsApp. Didn't even switch apps." },
               { name: "Sarah M.", handle: "@sarah_designs", text: "The invoicing feature is insane. I just type 'invoice client 50k' and it generates a beautiful checkout link. Got paid in 2 minutes." },
               { name: "Chinedu A.", handle: "@chinedu_tech", text: "The fact that this doesn't exist as an app on my phone is the best part. Ultimate stealth banking. Beautiful architecture." },
             ].map((t, i) => (
               <div key={i} className="glass-card min-w-[300px] md:min-w-[400px] p-8 snap-center flex-shrink-0">
                 <div className="flex items-center gap-3 mb-4">
                   <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full" />
                   <div>
                     <p className="font-bold text-sm">{t.name}</p>
                     <p className="text-xs text-text-muted">{t.handle}</p>
                   </div>
                 </div>
                 <p className="text-sm leading-relaxed text-gray-300">"{t.text}"</p>
               </div>
             ))}
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="py-32 px-6">
          <div className="max-w-4xl mx-auto glass-card p-12 md:p-20 text-center relative overflow-hidden bg-primary/10 border-primary/20">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none" />
            <h2 className="text-4xl md:text-6xl font-black mb-6 relative z-10">Stop downloading apps.</h2>
            <p className="text-lg text-text-muted mb-10 relative z-10 max-w-xl mx-auto">Join the revolution. Turn your WhatsApp into a high-powered financial terminal today.</p>
            <a href="https://wa.me/2348000000000?text=Hi" target="_blank" rel="noopener noreferrer" className="btn bg-white text-background hover:scale-105 inline-flex py-5 px-10 rounded-2xl font-black text-lg relative z-10">
              Start Chatting Now
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/10 bg-background pt-16 pb-8 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-black">C</div>
                <span className="font-bold text-xl">ChatPay</span>
              </div>
              <p className="text-text-muted text-sm max-w-xs">The autonomous financial engine running purely on API architecture and WhatsApp infrastructure.</p>
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
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-text-muted font-mono pt-8 border-t border-white/5">
            <p>© 2026 ChatPay Autonomous Corp.</p>
            <div className="flex gap-4">
               <span>STATUS: ALL SYSTEMS GREEN</span>
               <span>v2.4.0</span>
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
              <nav className="glass-card mx-6 my-6 p-4 flex justify-between items-center sticky top-6 z-50 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                <Link to="/" className="flex items-center gap-3 active:scale-95 transition-transform">
                  <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-primary/30 relative">
                     C
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
              <Dashboard />
            </>
          } />
          <Route path="/kyc" element={
            <>
              <nav className="glass-card mx-6 my-6 p-4 flex justify-between items-center sticky top-6 z-50 overflow-hidden">
                <Link to="/" className="flex items-center gap-3 active:scale-95 transition-transform">
                  <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-primary/30 relative">C</div>
                  <span className="font-extrabold text-2xl tracking-tighter title-gradient">ChatPay</span>
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
