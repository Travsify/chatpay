import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image, Paperclip, MoreVertical, Search, CheckCheck, ChevronLeft, ShieldCheck, Lock } from 'lucide-react';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'agent';
    timestamp: string;
    status: 'sent' | 'delivered' | 'read';
}

const WebVault = () => {
    const [isSynced, setIsSynced] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: '🤖 *Status: Agent Active*\n\nWelcome to your Secure Web Vault. I am standing by for your next mission.', sender: 'agent', timestamp: '10:00 AM', status: 'read' }
    ]);
    const [inputText, setInputText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSyncRequest = async () => {
        if (!phoneNumber) return;
        setLoading(true);
        try {
            await fetch('/api/vault/sync/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber })
            });
            setStep('OTP');
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleVerify = async () => {
        if (!otp) return;
        setLoading(true);
        try {
            const res = await fetch('/api/vault/sync/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber, otp })
            });
            const data = await res.json();
            if (data.success) setIsSynced(true);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;
        const msgText = inputText;
        const newMessage: Message = {
            id: Date.now().toString(),
            text: msgText,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'sent'
        };
        setMessages([...messages, newMessage]);
        setInputText('');

        try {
            const res = await fetch('/api/vault/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber, message: msgText })
            });
            const data = await res.json();
            if (data.response) {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    text: data.response,
                    sender: 'agent',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: 'read'
                }]);
            }
        } catch (e) { console.error(e); }
    };

    if (!isSynced) {
        return (
            <div className="min-h-screen bg-[#111b21] flex items-center justify-center p-4 selection:bg-[#00a884]/30">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md bg-[#222d34] rounded-3xl p-8 shadow-2xl border border-white/5"
                >
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-[#00a884] rounded-full flex items-center justify-center p-3 shadow-lg shadow-[#00a884]/20">
                            <img src="/logo.png" className="w-full h-full object-contain brightness-0 invert" alt="ChatPay" />
                        </div>
                    </div>
                    
                    <h1 className="text-2xl font-black text-white text-center mb-2">Sync Web Vault</h1>
                    <p className="text-[#8696a0] text-center text-sm mb-8 leading-relaxed">
                        Enter your WhatsApp number to receive your secure access code from the AI Agent.
                    </p>

                    <div className="space-y-4">
                        {step === 'PHONE' ? (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-[#00a884] ml-1">Phone Number</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. 2348012345678"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full bg-[#111b21] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-[#00a884] transition-colors"
                                />
                                <button 
                                    onClick={handleSyncRequest}
                                    disabled={loading}
                                    className="w-full bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] font-black py-4 mt-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-[#00a884]/20 disabled:opacity-50"
                                >
                                    {loading ? 'Sending Code...' : 'Get Access Code'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-[#00a884] ml-1">Sync Code (Check WhatsApp)</label>
                                <input 
                                    type="text" 
                                    placeholder="Enter 6-digit code"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    maxLength={6}
                                    className="w-full bg-[#111b21] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-[#00a884] transition-colors text-center text-2xl tracking-[0.5em] font-black"
                                />
                                <button 
                                    onClick={handleVerify}
                                    disabled={loading}
                                    className="w-full bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] font-black py-4 mt-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-[#00a884]/20 disabled:opacity-50"
                                >
                                    {loading ? 'Verifying...' : 'Verify & Enter Vault'}
                                </button>
                                <button onClick={() => setStep('PHONE')} className="w-full py-2 text-[#8696a0] text-xs font-bold hover:text-white transition-colors">Change Phone Number</button>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex items-center justify-center gap-2 opacity-50">
                        <ShieldCheck size={14} className="text-[#00a884]" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8696a0]">End-to-End Encrypted Sync</p>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[#111b21] flex flex-col selection:bg-[#00a884]/30 text-[#e9edef] overflow-hidden">
            {/* Header */}
            <header className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-white/5 z-10">
                <div className="flex items-center gap-3">
                    <button className="md:hidden p-1">
                        <ChevronLeft />
                    </button>
                    <div className="relative">
                        <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center p-1.5 ring-2 ring-white/10">
                            <img src="/logo.png" className="w-full h-full object-contain filter brightness-0 invert" alt="Agent" />
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] rounded-full border-2 border-[#202c33]"></div>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold flex items-center gap-1.5">
                            ChatPay Agent
                            <ShieldCheck size={12} className="text-[#00a884]" />
                        </h2>
                        <p className="text-[10px] text-[#25d366] font-medium animate-pulse">Online & Standing By</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 text-[#aebac1]">
                    <Search size={20} className="cursor-pointer hover:text-white transition-colors" />
                    <MoreVertical size={20} className="cursor-pointer hover:text-white transition-colors" />
                </div>
            </header>

            {/* Chat Body */}
            <main 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 md:px-[10%] lg:px-[20%] space-y-2 bg-[#0b141a] relative scroll-smooth overscroll-contain"
                style={{
                    backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                    backgroundBlendMode: 'overlay',
                    backgroundColor: '#0b141a',
                    backgroundOpacity: 0.05
                }}
            >
                <div className="flex justify-center my-4">
                    <span className="bg-[#182229] text-[#8696a0] text-[10px] px-3 py-1 rounded-lg uppercase tracking-widest font-bold shadow-sm">🔒 AES-256 SECURED MISSION CHANNEL</span>
                </div>

                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div 
                            key={msg.id}
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-1`}
                        >
                            <div 
                                className={`max-w-[85%] md:max-w-[70%] p-2 rounded-xl shadow-sm relative group ${
                                    msg.sender === 'user' 
                                    ? 'bg-[#005c4b] rounded-tr-none' 
                                    : 'bg-[#202c33] rounded-tl-none border-l-2 border-[#00a884]'
                                }`}
                            >
                                <p className="text-[14.5px] whitespace-pre-wrap leading-relaxed pr-8">
                                    {msg.text}
                                </p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-[10px] text-white/50">{msg.timestamp}</span>
                                    {msg.sender === 'user' && (
                                        <CheckCheck size={14} className={msg.status === 'read' ? 'text-[#53bdeb]' : 'text-white/40'} />
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </main>

            {/* Footer */}
            <footer className="bg-[#202c33] p-3 flex items-center gap-4 border-t border-white/5">
                <div className="flex items-center gap-4 text-[#aebac1]">
                    <Paperclip size={24} className="cursor-pointer hover:text-white transition-colors rotate-45" />
                </div>
                
                <div className="flex-1 relative">
                    <input 
                        type="text" 
                        placeholder="Type a mission command..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        className="w-full bg-[#2a3942] rounded-xl px-4 py-2.5 outline-none text-sm placeholder-[#8696a0]"
                    />
                </div>

                <button 
                    onClick={handleSend}
                    className="w-11 h-11 bg-[#00a884] rounded-full flex items-center justify-center text-[#111b21] active:scale-90 transition-transform shadow-lg"
                >
                    <Send size={20} />
                </button>
            </footer>
        </div>
    );
};

export default WebVault;
