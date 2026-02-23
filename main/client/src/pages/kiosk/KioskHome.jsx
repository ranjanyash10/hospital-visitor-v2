import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, UserPlus, LogIn, Monitor, ShieldCheck, Database, Globe, Network } from 'lucide-react';

const KioskHome = () => {
    const [time, setTime] = useState(new Date());
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="his-shell bg-[#f8fafc]">
            {/* Immersive Subgrid Background */}
            <div className="absolute inset-0 medical-subgrid pointer-events-none" />

            {/* Premium Institutional Header */}
            <header className="relative px-6 py-4 md:px-12 md:py-8 flex flex-col md:flex-row justify-between items-center md:items-start z-10 gap-6 md:gap-0 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-600/30">
                        <Activity size={24} className="md:w-8 md:h-8" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-3xl font-bold text-slate-900 font-outfit uppercase tracking-tighter leading-none">Action Care Hospital</h1>
                        <p className="text-[10px] font-bold text-blue-600 mt-2 uppercase tracking-[0.2em] md:tracking-[0.4em] opacity-80">Hospital Registry Console</p>
                    </div>
                </div>

                <div className="flex flex-col items-center md:items-end gap-2 md:gap-3 font-outfit">
                    <div className="system-status-pill text-[#1e3a8a] text-xs">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        Network Registry: Synchronized
                    </div>
                    <div className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter tabular-nums leading-none">
                        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                    <div className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                </div>
            </header>

            {/* Main Terminal Interface */}
            <main className="flex-1 overflow-y-auto relative z-10 px-6 py-8 md:px-12 md:pb-16">
                <div className="w-full max-w-7xl mx-auto h-full flex items-center justify-center">
                    <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-center">

                        {/* Left: Branding & Info */}
                        <div className="lg:col-span-2 space-y-6 md:space-y-10 reveal-up text-center lg:text-left" style={{ animationDelay: '0.1s' }}>
                            <div className="space-y-4">
                                <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-[1.1] font-outfit tracking-tighter">
                                    Secure <br className="hidden md:block" /> <span className="text-blue-600">Visitation</span> <br className="hidden md:block" /> Protocol.
                                </h2>
                                <p className="text-base md:text-lg text-slate-500 font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
                                    Access the hospital's central registry to generate authorized permits and manage security clearance for patient wards.
                                </p>
                            </div>

                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-4 group">
                                    <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm group-hover:bg-blue-50 transition-colors">
                                        <ShieldCheck className="text-blue-600" size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Security Level</p>
                                        <p className="font-bold text-slate-700">Multi-Factor Authenticated</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 group">
                                    <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm group-hover:bg-blue-50 transition-colors">
                                        <Database className="text-blue-600" size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Data Source</p>
                                        <p className="font-bold text-slate-700">Central HIS Core (Tier III)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: High-Impact Cards */}
                        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8 reveal-up" style={{ animationDelay: '0.2s' }}>

                            {/* Visitor Action Card */}
                            <div
                                onClick={() => navigate('/kiosk/enter-details')}
                                className="his-premium-card p-6 md:p-10 group cursor-pointer border-blue-100/50 bg-white/80 backdrop-blur-xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-8 text-slate-50 opacity-10 scale-150 rotate-12 transition-transform duration-700 group-hover:scale-[2] group-hover:text-blue-500 group-hover:opacity-20">
                                    <UserPlus size={160} />
                                </div>

                                <div className="relative z-10 h-full flex flex-col items-center md:items-start text-center md:text-left">
                                    <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 md:mb-10 shadow-lg shadow-blue-600/30 group-hover:scale-110 transition-transform">
                                        <UserPlus size={24} className="md:w-8 md:h-8" />
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 font-outfit mb-4 uppercase tracking-tight">Patient Visitor <br className="hidden sm:block" /> Registration</h3>
                                    <p className="text-slate-500 text-sm font-medium mb-8 md:mb-10 italic leading-snug">Identify inpatient records and generate dynamic entry permits with ward-specific routing.</p>
                                    <div className="mt-auto w-full">
                                        <button className="his-btn-impact w-full bg-[#1e3a8a] py-3 md:py-4 text-xs md:text-sm hover:bg-black uppercase tracking-widest">
                                            Open Session
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Staff Action Card */}
                            <div
                                onClick={() => navigate('/guard/login')}
                                className="his-premium-card p-6 md:p-10 group cursor-pointer bg-[#0f172a] text-white border-none shadow-[0_40px_100px_rgba(0,0,0,0.1)] relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-8 text-white/5 scale-150 rotate-12 transition-transform duration-700 group-hover:scale-[2] group-hover:text-white/10">
                                    <LogIn size={160} />
                                </div>

                                <div className="relative z-10 h-full flex flex-col items-center md:items-start text-center md:text-left">
                                    <div className="w-14 h-14 md:w-16 md:h-16 bg-white/10 border border-white/20 text-white rounded-2xl flex items-center justify-center mb-6 md:mb-10 group-hover:bg-white group-hover:text-slate-900 transition-all">
                                        <LogIn size={24} className="md:w-8 md:h-8" />
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-bold text-white font-outfit mb-4 uppercase tracking-tight">Personnel & Security Portal</h3>
                                    <p className="text-slate-400 text-sm font-medium mb-8 md:mb-10 italic leading-snug">Authorized access for facility management, security auditing, and warden-level controls.</p>
                                    <div className="mt-auto w-full">
                                        <button className="his-btn-impact w-full bg-white text-slate-900 py-3 md:py-4 text-xs md:text-sm hover:bg-blue-600 hover:text-white border-none uppercase tracking-widest">
                                            Staff Login
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </main>

            {/* Desktop-Style Taskbar Footer */}
            <footer className="relative bg-white border-t border-slate-100 z-10 py-5 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-4 md:gap-10 items-center">
                    <div className="flex items-center gap-3">
                        <Monitor className="text-blue-600" size={14} md:size={16} />
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-400 italic">Terminal: TK-5173-ACT_NORTH</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Network className="text-blue-600" size={14} md:size={16} />
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-400 italic">Gateway: 172.16.0.44</span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-8">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-900">Security Armed</span>
                    </div>
                    <div className="hidden sm:block h-4 w-px bg-slate-200" />
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-slate-300">© 2026 Action Care Hospital • Build 02.18.99</span>
                </div>
            </footer>
        </div>
    );
};

export default KioskHome;
