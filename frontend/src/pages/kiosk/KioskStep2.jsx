import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../api';
import { Loader2, ShieldCheck, Timer, ChevronLeft, RefreshCw, Send, Lock, Fingerprint, ShieldAlert, CheckCircle2, Database, Activity } from 'lucide-react';
import logo from '../../assets/logo.png';

const KioskStep2 = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const [otp, setOtp] = useState(['', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [timeLeft, setTimeLeft] = useState(300);
    const inputRefs = [useRef(), useRef(), useRef(), useRef()];

    useEffect(() => {
        if (!state?.sessionId) {
            navigate('/kiosk/enter-details');
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [state, navigate]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        // Auto-focus next
        if (value && index < 3) {
            inputRefs[index + 1].current.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs[index - 1].current.focus();
        }
    };

    const handleVerify = async (e) => {
        if (e) e.preventDefault();
        const fullOtp = otp.join('');
        if (fullOtp.length < 4) return;

        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/kiosk/verify-otp', {
                sessionId: state.sessionId,
                otp: fullOtp,
                mobile: state.relativeMobile
            });

            navigate('/kiosk/slip', {
                state: {
                    slip: res.data.slip,
                    patientName: state.patientName,
                    relativeName: state.relativeName
                }
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Authorization Rejected: Protocol failure or invalid signature.');
            setOtp(['', '', '', '']);
            inputRefs[0].current.focus();
        } finally {
            setLoading(false);
        }
    };

    const resendOtp = async () => {
        setLoading(true);
        try {
            await api.post('/kiosk/send-otp', { mobile: state.relativeMobile, admission_id: state.admissionId });
            setTimeLeft(300);
            setError(null);
            setOtp(['', '', '', '']);
            inputRefs[0].current.focus();
        } catch (err) {
            setError('Registry error: Failed to dispatch secondary signature link.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="his-shell bg-[#f8fafc] flex-col h-screen overflow-hidden">
            {/* Background Medical Mesh */}
            <div className="absolute inset-0 medical-subgrid opacity-20 pointer-events-none" />

            <header className="sticky top-0 px-6 py-4 md:px-12 md:py-8 flex flex-col md:flex-row justify-between items-center z-50 border-b border-slate-100 bg-white/50 backdrop-blur-md gap-4">
                <div className="flex items-center gap-5">
                    <img src={logo} alt="Action Care" className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-contain bg-white shadow-xl shadow-brand-500/20" />
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-900 font-outfit uppercase tracking-tighter leading-none">Identity Verification</h2>
                        <p className="text-[10px] font-black text-brand-500 mt-2 uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-80">Registry Clearance Phase 02/03</p>
                    </div>
                </div>

                <div className={`px-4 py-1.5 md:px-6 md:py-2 rounded-xl border flex items-center gap-3 md:gap-4 transition-all duration-500 shadow-sm ${timeLeft < 60 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <Timer size={16} className={timeLeft < 60 ? 'animate-spin-slow' : ''} />
                    <div className="flex flex-col items-center md:items-end">
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest opacity-60">Session Expiry</span>
                        <span className="text-base md:text-lg font-black font-mono leading-none tracking-tighter">{formatTime(timeLeft)}</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative z-10">
                {/* Protocol Insight Drawer (Consistent with Step 1) */}
                <div className="hidden lg:flex w-96 bg-[#0f172a] text-white p-12 flex-col justify-center sticky top-0 h-full">
                    <div className="mb-12">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                            <ShieldCheck size={28} className="text-brand-400" />
                        </div>
                        <h3 className="text-3xl font-black font-outfit tracking-tighter mb-4 leading-tight">Identity <br /> Validation</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Securing the visitation portal through multi-factor cryptographic handshakes. Please verify the 4-digit token sent to your device.</p>
                    </div>

                    <div className="space-y-8">
                        <div className="flex gap-5 opacity-40">
                            <div className="w-6 h-6 bg-emerald-500/20 text-emerald-500 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">✔</div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-relaxed">Patient Record Identified & Verified.</p>
                        </div>
                        <div className="flex gap-5">
                            <div className="w-6 h-6 bg-brand-500 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">02</div>
                            <p className="text-xs text-slate-300 font-bold uppercase tracking-wider leading-relaxed">Identity Handshake: Enter the 4-digit signature.</p>
                        </div>
                    </div>

                    <div className="mt-auto pt-12 border-t border-white/5 flex items-center gap-4 text-slate-500">
                        <Database size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Core_Vault: PR-S2</span>
                    </div>
                </div>

                {/* Main Interaction Console */}
                <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-10">
                    <div className="w-full max-w-4xl bg-white his-premium-card flex flex-col max-h-[95vh] shadow-[0_40px_80px_rgba(0,0,0,0.06)] overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-20 py-8">
                            <div className="text-center mb-8">
                                <div className="w-14 h-14 bg-brand-500/10 text-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-100">
                                    <ShieldCheck size={28} />
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold font-outfit text-slate-800 tracking-tight uppercase mb-3">Digital Signature</h3>
                                <p className="text-slate-400 text-xs md:text-sm font-medium leading-relaxed max-w-md mx-auto">
                                    Enter the unique authorization handshake code dispatched to the primary security contact:
                                </p>
                                <div className="mt-6 inline-flex items-center gap-3 px-6 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-brand-500 font-bold font-mono text-base md:text-lg tracking-[0.2em]">•••• {state?.relativeMobile?.slice(-4)}</span>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-700">
                                    <ShieldAlert size={20} className="shrink-0" />
                                    <p className="text-[11px] font-black uppercase tracking-[0.1em]">{error}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-4 gap-3 md:gap-6 mb-8 mt-2 max-w-lg mx-auto">
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={inputRefs[index]}
                                        type="text"
                                        maxLength="1"
                                        className={`w-full aspect-square text-center text-2xl md:text-4xl font-black font-outfit rounded-xl md:rounded-[1.5rem] border-2 transition-all duration-300 outline-none
                                            ${digit
                                                ? 'bg-brand-50 border-brand-500 text-brand-500 shadow-xl shadow-brand-500/10'
                                                : 'bg-slate-50 border-slate-100 text-slate-800 focus:bg-white focus:border-brand-500'
                                            }`}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        autoFocus={index === 0}
                                        placeholder="0"
                                    />
                                ))}
                            </div>

                            <div className="flex justify-between items-center px-4 mb-4">
                                <button
                                    type="button"
                                    onClick={resendOtp}
                                    disabled={loading || timeLeft > 240}
                                    className="text-[10px] font-black text-slate-400 hover:text-brand-500 uppercase tracking-[0.3em] transition-all flex items-center gap-2 disabled:opacity-30 group"
                                >
                                    <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" />
                                    Protocol Redispatch
                                </button>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TLS 1.3 Active</span>
                                </div>
                            </div>
                        </div>

                        {/* Fixed Actions Footer */}
                        <div className="p-6 lg:p-10 border-t border-slate-50 bg-slate-50/30">
                            <div className="flex flex-col gap-6">
                                <button
                                    onClick={handleVerify}
                                    disabled={loading || otp.join('').length < 4}
                                    className={`relative w-full py-4 md:py-6 text-base md:text-xl font-black font-outfit uppercase tracking-widest rounded-2xl md:rounded-3xl transition-all duration-500 shadow-2xl active:scale-95 flex items-center justify-center gap-4 group overflow-hidden
                                        ${otp.join('').length === 4
                                            ? 'bg-brand-500 text-white shadow-brand-500/30 hover:bg-blue-700'
                                            : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                                        }`}
                                >
                                    {loading ? (
                                        <Loader2 size={24} className="animate-spin md:w-8 md:h-8" />
                                    ) : (
                                        <>
                                            <span className="relative z-10">Finalize Clearance</span>
                                            <Send size={20} className="relative z-10 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-500 md:w-6 md:h-6" />
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                        </>
                                    )}
                                </button>
                                <div className="flex justify-center">
                                    <Link to="/kiosk/enter-details" className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] flex items-center gap-3 hover:text-brand-500 hover:-translate-x-2 transition-all duration-500">
                                        <ChevronLeft size={14} className="md:w-4 md:h-4" /> Return to Neutral Zone
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <footer className="relative bg-white border-t border-slate-100 z-50 py-4 px-6 md:px-12 flex justify-center items-center">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.5em] text-slate-300 italic text-center leading-relaxed">Intentional falsification of registry records is subject to facility security prosecution.</span>
            </footer>
        </div>
    );
};

export default KioskStep2;
