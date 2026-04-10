import React, { useState, useEffect, useRef } from 'react';
import GodMode from './GodMode';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Wallet, ShieldCheck, FileText, Send, User, Copy, Check, TrendingUp, CreditCard, ChevronRight, ChevronDown, Briefcase, Users, Smartphone, Star } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';

// --- ANIMATION HELPERS ---

const useCountUp = (end: number, duration = 2000, suffix = '') => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end, duration]);
  
  return { ref, count, suffix };
};

const FadeInSection = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// 3D Mouse-reactive tilt
const useMouse3D = (intensity = 15) => {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('rotateX(0deg) rotateY(0deg)');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setTransform(`rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg)`);
    };
    const handleLeave = () => setTransform('rotateY(0deg) rotateX(0deg)');
    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => { el.removeEventListener('mousemove', handleMove); el.removeEventListener('mouseleave', handleLeave); };
  }, [intensity]);

  return { ref, transform };
};

// Floating particles background
const ParticleField = ({ count = 20 }: { count?: number }) => (
  <div className="particles">
    {[...Array(count)].map((_, i) => (
      <div
        key={i}
        className="particle"
        style={{
          left: `${Math.random() * 100}%`,
          bottom: `-${Math.random() * 20}%`,
          width: `${2 + Math.random() * 4}px`,
          height: `${2 + Math.random() * 4}px`,
          animationDuration: `${8 + Math.random() * 12}s`,
          animationDelay: `${Math.random() * 10}s`,
          opacity: 0.15 + Math.random() * 0.3,
        }}
      />
    ))}
  </div>
);

// 3D tilt card
const Tilt3DCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const tilt = useMouse3D(8);
  return (
    <div ref={tilt.ref} className={`perspective-1000 ${className}`}>
      <div
        className="preserve-3d transition-transform duration-300 ease-out"
        style={{ transform: tilt.transform }}
      >
        {children}
      </div>
    </div>
  );
};

const TypingIndicator = () => (
  <div className="bg-[#202c33] rounded-2xl rounded-tl-sm p-3 w-20 text-[13px] flex gap-1.5 items-center">
    <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

const chatMessages = [
  { type: 'user', text: 'Hi ChatPay! 👋', time: '10:30 AM' },
  { type: 'bot', text: "Welcome to ChatPay! 🎉 I'm your personal banking assistant. What would you like to do today?", time: '10:30 AM' },
  { type: 'user', text: '💰 Send Money', time: '10:31 AM' },
  { type: 'bot', text: 'Perfect! Who would you like to send money to?', time: '10:31 AM' },
  { type: 'user', text: 'Send ₦5000 to John - 0123456789 GTB Bank', time: '10:31 AM' },
  { type: 'bot', text: '✅ Transfer successful! 💰\n\n₦5,000 sent to John Doe\n🏦 GTBank (0123456789)\n⏰ Completed in 2.3 seconds', time: '10:32 AM', success: true },
];

const LiveChatMockup = () => {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-100px' });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inView) { setVisibleCount(0); return; }
    let idx = 0;
    let cancelled = false;
    const showNext = () => {
      if (cancelled) return;
      if (idx >= chatMessages.length) {
        setTimeout(() => { if (!cancelled) { setVisibleCount(0); idx = 0; showNext(); } }, 4000);
        return;
      }
      const msg = chatMessages[idx];
      if (msg.type === 'bot') {
        setIsTyping(true);
        setTimeout(() => {
          if (cancelled) return;
          setIsTyping(false);
          idx++;
          setVisibleCount(idx);
          setTimeout(showNext, 800);
        }, 1200);
      } else {
        idx++;
        setVisibleCount(idx);
        setTimeout(showNext, 600);
      }
    };
    const t = setTimeout(showNext, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [inView]);

  // Scroll ONLY inside the chat container, never the page
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleCount, isTyping]);

  return (
    <div ref={ref} className="w-full max-w-[320px] sm:max-w-sm mx-auto bg-[#0b141a] border border-[#222d34] rounded-[2.5rem] p-3 md:p-4 pb-4 relative shadow-[0_0_50px_rgba(37,211,102,0.15)] ring-8 ring-[#111b21] overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 md:w-40 h-6 bg-[#111b21] rounded-b-3xl mb-4 z-10" />
      <div className="bg-[#111b21] h-14 -mx-4 -mt-4 mb-2 flex items-center px-4 gap-3 border-b border-[#222d34]">
        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center p-1"><img src="/logo.png" className="w-6 h-6 object-contain filter brightness-0 invert" alt="logo"/></div>
        <div>
          <p className="text-white text-sm font-bold flex items-center gap-1">ChatPay <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]"></span></p>
          <p className="text-[#25D366] text-[10px] font-medium">{isTyping ? 'typing...' : 'Online'}</p>
        </div>
      </div>
      <div ref={scrollRef} className="mt-6 space-y-3 px-1 pb-2 h-[340px] overflow-y-auto hide-scrollbar scroll-smooth">
        <AnimatePresence>
          {chatMessages.slice(0, visibleCount).map((msg, i) => (
            <motion.div
              key={`msg-${i}`}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={msg.type === 'user'
                ? 'bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm p-3 w-fit ml-auto text-[13px] shadow-sm max-w-[85%]'
                : `bg-[#202c33] ${msg.success ? 'border-l-2 border-[#25D366]' : ''} text-[#e9edef] rounded-2xl rounded-tl-sm p-3 w-[85%] text-[13px] shadow-sm`
              }
            >
              {msg.text.split('\n').map((line, j) => <span key={j}>{line}<br/></span>)}
              <p className="text-[9px] text-[#8696a0] text-right mt-1">{msg.time} {msg.type === 'user' ? '✓✓' : ''}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && <TypingIndicator />}
      </div>
    </div>
  );
};

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
              <a href="https://wa.me/2348000000000?text=Hi" target="_blank" rel="noopener noreferrer" className="bg-[#25D366] hover:bg-[#128C7E] text-[#0b141a] px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-[#25D366]/30 transition-all hover:-translate-y-0.5">
                Launch App
              </a>
            </div>
          </div>
        </nav>

        {/* HERO SECTION */}
        <section className="relative pt-32 pb-16 md:pt-40 md:pb-20 px-4 md:px-6 max-w-7xl mx-auto text-center min-h-[90vh] flex flex-col justify-center">
           <ParticleField count={25} />
           <div className="gradient-orb w-[300px] md:w-[800px] h-[300px] md:h-[800px] bg-[#25D366]/15 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float-slow" />
           <div className="gradient-orb w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-[#128C7E]/15 top-1/4 left-1/4 animate-float-reverse" />
           <div className="gradient-orb w-[150px] md:w-[300px] h-[150px] md:h-[300px] bg-[#00A884]/10 bottom-1/4 right-1/4 animate-float" />
           
           <motion.div 
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, ease: "easeOut" }}
             className="relative z-10"
           >
             <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-surface border border-border mb-6 md:mb-8 backdrop-blur-md shadow-[0_0_20px_rgba(37,211,102,0.1)] animate-shimmer">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#8696a0]">ChatPay v3.0 — Now with 3D</span>
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

        {/* ANIMATED METRICS SECTION */}
        <section className="py-16 border-y border-[#222d34] bg-[#0b141a] relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-r from-[#25D366]/5 via-transparent to-[#128C7E]/5 pointer-events-none" />
           <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-6 text-center relative z-10">
             {[
               { end: 50, suffix: "k+", label: "Active Users", sub: "Banking daily on WhatsApp" },
               { end: 2, suffix: "B+", prefix: "₦", label: "Transaction Volume", sub: "Processed securely" },
               { end: 99.9, suffix: "%", label: "Uptime", sub: "Always available" },
               { end: 30, suffix: "s", prefix: "<", label: "Average Response", sub: "Lightning fast support" }
             ].map((stat, i) => {
               const counter = useCountUp(stat.end, 2500);
               return (
                 <FadeInSection key={i} delay={i * 0.15}>
                   <div className="p-6 rounded-2xl border border-[#222d34] bg-[#111b21]/50 hover:border-[#25D366]/30 transition-all hover:scale-105 duration-300">
                     <div ref={counter.ref}>
                       <h3 className="text-3xl md:text-5xl font-black text-[#25D366] mb-2 tabular-nums">
                         {stat.prefix || ''}{stat.end === 99.9 ? counter.count.toFixed(1) : counter.count.toLocaleString()}{stat.suffix}
                       </h3>
                     </div>
                     <p className="text-white text-sm md:text-base font-bold mb-1">{stat.label}</p>
                     <p className="text-[#8696a0] text-xs">{stat.sub}</p>
                   </div>
                 </FadeInSection>
               );
             })}
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
            
            {/* 3D ANIMATED WHATSAPP UI MOCKUP */}
            <div className="flex-1 w-full order-1 lg:order-2">
              <FadeInSection delay={0.3}>
              <Tilt3DCard>
                <div className="animate-float">
                  <LiveChatMockup />
                </div>
              </Tilt3DCard>
              </FadeInSection>
            </div>
          </div>
        </section>

        {/* COMPLIANCE & FEATURES */}
        <section id="features" className="py-20 md:py-24 px-4 md:px-6 bg-[#111b21] border-y border-[#222d34]">
          <div className="max-w-7xl mx-auto">
            <FadeInSection>
              <div className="text-center mb-12 md:mb-20 px-2">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tight text-white">Trust & Security.</h2>
                <p className="text-sm md:text-base text-[#8696a0] max-w-2xl mx-auto leading-relaxed">Built with enterprise-grade security architecture, guaranteeing your funds and data are isolated and protected unconditionally.</p>
              </div>
            </FadeInSection>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
              {[
                { icon: ShieldCheck, title: "NDIC Insured", desc: "Your funds are guaranteed and protected unconditionally." },
                { icon: ShieldCheck, title: "AML Compliant", desc: "Bank-grade Anti-money laundering protocols integrated natively." },
                { icon: ShieldCheck, title: "GDPR Ready", desc: "Data protection compliant across all international boundaries." },
                { icon: ShieldCheck, title: "E2E Encrypted", desc: "Leveraging WhatsApp's AES-256 end-to-end messaging encryption." },
              ].map((f, i) => (
                <FadeInSection key={i} delay={i * 0.1}>
                  <div className="bg-[#0b141a] p-8 rounded-[2rem] border border-[#222d34] hover:-translate-y-2 hover:border-[#25D366]/50 transition-all duration-300 shadow-lg text-center flex flex-col items-center h-full">
                    <div className="w-16 h-16 rounded-3xl bg-[#128C7E]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <f.icon className="text-[#25D366]" size={30} />
                    </div>
                    <h3 className="text-lg font-bold mb-3 tracking-tight text-white">{f.title}</h3>
                    <p className="text-sm text-[#8696a0] leading-relaxed">{f.desc}</p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </div>
        </section>

        {/* USE CASES SECTION */}
        <section className="py-20 md:py-24 px-4 md:px-6 border-y border-[#222d34]">
          <div className="max-w-7xl mx-auto">
            <FadeInSection>
              <div className="text-center mb-16 px-2">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tight text-white">Who is ChatPay for?</h2>
                <p className="text-sm md:text-base text-[#8696a0] max-w-2xl mx-auto leading-relaxed">Engineered for velocity. Built to scale across any financial requirement.</p>
              </div>
            </FadeInSection>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {[
                { icon: Briefcase, title: "Freelancers", desc: "Generate professional payment links mapped to your USD virtual account inside a WhatsApp chat.", color: "from-[#25D366] to-[#128C7E]" },
                { icon: Users, title: "Small Businesses", desc: "Pay salaries, vendors, and manage invoicing without needing multiple banking portals or complex setups.", color: "from-[#00A884] to-[#075E54]" },
                { icon: Smartphone, title: "Digital Natives", desc: "Split bills with friends, pay for subscriptions, and trade crypto effortlessly while texting.", color: "from-[#128C7E] to-[#005c4b]" }
              ].map((uc, i) => (
                <FadeInSection key={i} delay={i * 0.15}>
                  <div className="relative group p-8 bg-[#111b21] rounded-[2.5rem] border border-[#222d34] overflow-hidden hover:border-[#25D366]/40 transition-colors shadow-lg h-full">
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${uc.color} opacity-10 rounded-bl-[100px] transition-transform group-hover:scale-110`} />
                    <uc.icon className="text-[#25D366] mb-6" size={36} />
                    <h3 className="text-xl font-bold mb-3 text-white">{uc.title}</h3>
                    <p className="text-sm text-[#8696a0] leading-relaxed">{uc.desc}</p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS GRID */}
        <section id="testimonials" className="py-20 md:py-24 px-4 md:px-6 bg-[#0b141a]">
          <FadeInSection>
            <div className="max-w-7xl mx-auto text-center mb-12 md:mb-16 px-2">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tight text-white">Loved by Nigerians.</h2>
              <p className="text-sm md:text-base text-[#8696a0]">Don't just take our word for it. See what our users say.</p>
            </div>
          </FadeInSection>
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
             {[
               { name: "Oyekanmi E.", handle: "@oyecode", text: "ChatPay is literally sorcery. I paid my electricity bill while mid-conversation with my boss on WhatsApp. Didn't even switch apps.", rating: 5, role: "Software Engineer" },
               { name: "Sarah M.", handle: "@sarah_designs", text: "The invoicing feature is insane. I just type 'invoice client 50k' and it generates a beautiful checkout link. Got paid in 2 minutes.", rating: 5, role: "Freelance Designer" },
               { name: "Chinedu A.", handle: "@chinedu_tech", text: "The fact that this doesn't exist as an app on my phone is the best part. Ultimate stealth banking. Beautiful architecture.", rating: 5, role: "Startup Founder" },
               { name: "Amaka O.", handle: "@amaka_biz", text: "I run payroll for 12 staff entirely from WhatsApp now. The batch payment feature saved me 4 hours every month. Absolutely game-changing.", rating: 5, role: "Small Business Owner" },
               { name: "Tunde B.", handle: "@tunde_fx", text: "Converted USD to Naira at the best rate I've seen, all from a simple WhatsApp text. No more logging into multiple exchange platforms.", rating: 4, role: "Forex Trader" },
               { name: "Fatima K.", handle: "@fatima_writes", text: "My clients can now pay me through a link I generate in 5 seconds. ChatPay literally doubled my collection rate. Revolutionary product.", rating: 5, role: "Content Creator" },
             ].map((t, i) => (
               <FadeInSection key={i} delay={i * 0.1}>
                 <div className="h-full bg-[#111b21] border border-[#222d34] p-6 md:p-8 rounded-[2rem] hover:border-[#25D366]/30 transition-all duration-300 hover:-translate-y-1 group">
                   <div className="flex gap-1 mb-4">
                     {[...Array(t.rating)].map((_, j) => <Star key={j} size={16} className="fill-[#25D366] text-[#25D366]" />)}
                     {[...Array(5 - t.rating)].map((_, j) => <Star key={j} size={16} className="text-[#222d34]" />)}
                   </div>
                   <p className="text-sm md:text-base leading-relaxed text-[#8696a0] mb-6">"{t.text}"</p>
                   <div className="flex items-center gap-4 pt-4 border-t border-[#222d34]">
                     <div className="w-12 h-12 bg-gradient-to-br from-[#25D366] to-[#075E54] rounded-full shadow-inner flex items-center justify-center text-white font-black text-lg group-hover:scale-110 transition-transform">
                       {t.name[0]}
                     </div>
                     <div className="text-left">
                       <p className="font-bold text-sm text-white">{t.name}</p>
                       <p className="text-xs text-[#8696a0]">{t.role}</p>
                     </div>
                   </div>
                 </div>
               </FadeInSection>
             ))}
          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <section className="py-20 px-4 md:px-6 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4 text-white">Frequently Asked Questions</h2>
            <p className="text-[#8696a0]">Everything you need to know about the product and billing.</p>
          </div>
          <div className="space-y-4">
             {[
               { q: "Is ChatPay actually an app?", a: "No. ChatPay operates completely autonomously natively inside WhatsApp. There is absolutely nothing to download from any App Store." },
               { q: "Are my funds actually safe?", a: "Yes. Your funds are secured by our NDIC-insured banking partners (Fincra & Flutterwave). We utilize AES-256 military-grade encryption directly inherited from WhatsApp's E2E rails." },
               { q: "Do I need Wi-Fi or data?", a: "If you have enough data to send a text on WhatsApp, you have enough connectivity to execute a $10,000 international transfer via ChatPay. It requires practically zero bandwidth." },
               { q: "What happens if I lose my phone?", a: "Your ChatPay wallet is tied to your biometric identity verification (KYC), not your device. Simply recover your WhatsApp number on a new phone and verify your PIN to resume operations." }
             ].map((faq, i) => (
               <details key={i} className="group bg-[#111b21] border border-[#222d34] rounded-2xl p-6 cursor-pointer hover:border-[#25D366]/30 transition-colors">
                 <summary className="flex justify-between items-center font-bold text-white outline-none">
                   {faq.q}
                   <ChevronDown size={20} className="text-[#25D366] group-open:rotate-180 transition-transform" />
                 </summary>
                 <p className="text-[#8696a0] mt-4 leading-relaxed text-sm">{faq.a}</p>
               </details>
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

        {/* ROBUST FOOTER */}
        <footer className="border-t border-[#222d34] bg-[#0b141a] pt-16 md:pt-20 pb-8 px-4 md:px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-10 md:gap-12 mb-16">
            <div className="col-span-1 sm:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" className="w-8 h-8 object-contain" alt="ChatPay" />
                <span className="font-bold text-xl text-white">ChatPay</span>
              </div>
              <p className="text-[#8696a0] text-sm max-w-sm leading-relaxed mb-8">The autonomous financial engine running purely on API architecture and WhatsApp infrastructure. Transforming conversations into seamless financial transactions.</p>
              
              <p className="font-bold text-white text-sm mb-3">Join our newsletter</p>
              <form className="flex gap-2 max-w-sm" onSubmit={(e) => e.preventDefault()}>
                 <input type="email" required placeholder="Enter your email" className="bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-3 text-sm text-white flex-1 focus:outline-none focus:border-[#25D366] transition-colors" />
                 <button type="submit" className="bg-[#25D366] text-[#0b141a] px-6 rounded-xl font-bold text-sm hover:bg-white transition-colors">Subscribe</button>
              </form>
            </div>
            
            <div className="md:ml-auto">
              <h4 className="font-bold mb-6 text-white text-sm tracking-widest uppercase">Platform</h4>
              <ul className="space-y-4 text-sm text-[#8696a0]">
                <li><a href="#" className="hover:text-[#25D366] transition-colors">Virtual Accounts</a></li>
                <li><a href="#" className="hover:text-[#25D366] transition-colors">Transfers & P2P</a></li>
                <li><a href="#" className="hover:text-[#25D366] transition-colors">AI Invoicing</a></li>
                <li><a href="#" className="hover:text-[#25D366] transition-colors">Smart Wallets</a></li>
              </ul>
            </div>
            
            <div className="md:mx-auto">
              <h4 className="font-bold mb-6 text-white text-sm tracking-widest uppercase">Company</h4>
              <ul className="space-y-4 text-sm text-[#8696a0]">
                <li><a href="#" className="hover:text-[#25D366] transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-[#25D366] transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-[#25D366] transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-[#25D366] transition-colors">Press</a></li>
              </ul>
            </div>
            
            <div className="md:ml-auto">
              <h4 className="font-bold mb-6 text-white text-sm tracking-widest uppercase">Legal</h4>
              <ul className="space-y-4 text-sm text-[#8696a0]">
                <li><a href="#" className="hover:text-[#25D366] transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-[#25D366] transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-[#25D366] transition-colors">AML Policy</a></li>
                <li><a href="#" className="hover:text-[#25D366] transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] md:text-xs text-[#8696a0] font-mono pt-8 border-t border-[#222d34]">
            <p>© 2026 ChatPay Autonomous Corp.</p>
            <div className="flex gap-4 items-center">
               <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span> ALL SYSTEMS GREEN</span>
               <span className="px-2 py-0.5 rounded bg-[#111b21] border border-[#222d34]">v2.4.0</span>
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
          <Route path="/admin" element={<GodMode />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

export default App;
