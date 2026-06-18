import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { Smartphone, Search, User, Users, Building2, Activity, ChevronRight, ChevronLeft, AlertCircle, CheckCircle2, Loader2, Shield, ArrowLeft, Clock, TicketCheck } from 'lucide-react';
import logo from '../../assets/logo.png';

const VisitorPortal = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const qrToken = searchParams.get('token');

    const [step, setStep] = useState('VALIDATING'); // VALIDATING → MOBILE → PATIENTS → VISITOR_COUNT → SLIP (no OTP)
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const [guardStationId, setGuardStationId] = useState(null);
    const [mobile, setMobile] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [admissionId, setAdmissionId] = useState(null);
    const [slip, setSlip] = useState(null);
    const [slips, setSlips] = useState([]);
    const [currentPassIndex, setCurrentPassIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [visitorCount, setVisitorCount] = useState(1);
    const [maxSlots, setMaxSlots] = useState(1);

    // Step 1: Validate QR token
    useEffect(() => {
        if (!qrToken) {
            setStep('ERROR');
            setError('No QR code found. Please scan the QR code at the guard station.');
            return;
        }
        validateQR();
    }, []);

    const validateQR = async () => {
        try {
            const res = await api.post('/visitor/validate-qr', { token: qrToken });
            setGuardStationId(res.data.guard_station_id);
            setStep('MOBILE');
        } catch (err) {
            setStep('ERROR');
            setError(err.response?.data?.error || 'Invalid or expired QR code. Please scan a fresh one.');
        }
    };

    // Step 2: Mobile lookup
    const handleMobileSearch = async () => {
        if (!/^[0-9]{10}$/.test(mobile)) {
            setError('Enter a valid 10-digit mobile number');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/visitor/lookup/${mobile}`);
            const found = res.data.patients;
            setPatients(found);
            if (found.length === 1) {
                setSelectedPatient(found[0]);
                setAdmissionId(found[0].admission_id);
            }
            setStep('PATIENTS');
        } catch (err) {
            setError(err.response?.data?.message || 'No active admissions linked to this number');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Generate pass directly (no OTP)
    const handleGeneratePass = async () => {
        if (!selectedPatient) return;
        setLoading(true);
        setError(null);
        try {
            setAdmissionId(selectedPatient.admission_id);
            const remaining = selectedPatient?.remaining_slots || 1;
            const maxV = selectedPatient?.max_visitors || 1;

            if (maxV > 1 && remaining > 1) {
                // Show visitor count selection step
                setMaxSlots(remaining);
                setVisitorCount(1);
                setStep('VISITOR_COUNT');
            } else {
                // Single visitor — generate slip directly
                await generateSlipDirect(1);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate pass');
        } finally {
            setLoading(false);
        }
    };

    // Generate slip directly via the no-OTP endpoint
    const generateSlipDirect = async (count) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/visitor/generate-direct', {
                mobile,
                guard_station_id: guardStationId,
                admission_id: admissionId || selectedPatient?.admission_id,
                visitor_count: count
            });
            setSlip(res.data.slip);
            setSlips(res.data.slips || [res.data.slip]);
            setCurrentPassIndex(0);
            setStep('SLIP');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate pass');
        } finally {
            setLoading(false);
        }
    };

    // Slip validity countdown — only starts after QR is scanned (valid_until becomes non-null)
    useEffect(() => {
        if (step !== 'SLIP' || !slips || slips.length === 0) return;
        const currentSlip = slips[currentPassIndex];
        if (!currentSlip || !currentSlip.valid_until) {
            // Timer not yet activated (QR not scanned yet)
            setTimeLeft(-1);
            return;
        }
        const endTime = new Date(currentSlip.valid_until).getTime();
        const timer = setInterval(() => {
            const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) clearInterval(timer);
        }, 1000);
        return () => clearInterval(timer);
    }, [step, slips, currentPassIndex]);

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    // --- RENDER ---
    if (step === 'VALIDATING') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 size={48} className="animate-spin text-brand-500 mx-auto mb-4" />
                    <p className="text-slate-500 font-semibold text-sm uppercase tracking-wider">Validating QR Code...</p>
                </div>
            </div>
        );
    }

    if (step === 'ERROR') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-3">Access Denied</h2>
                    <p className="text-slate-500 text-sm mb-6">{error}</p>
                    <p className="text-xs text-slate-400">Please return to the guard station and scan a fresh QR code.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100 px-4 py-3">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="Action Care" className="w-10 h-10 object-contain drop-shadow-sm" />
                        <div>
                            <h1 className="text-sm font-extrabold text-slate-800 tracking-tight">Visitor Portal</h1>
                            <p className="text-[8px] font-bold text-brand-500 uppercase tracking-[0.2em]">Action Care Hospital</p>
                        </div>
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
                        <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            Secure
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto p-4 pb-12">
                {/* Error banner */}
                {error && step !== 'ERROR' && (
                    <div className="mb-4 p-3.5 bg-red-50 text-red-700 border border-red-100 rounded-2xl text-xs font-bold flex items-center gap-3">
                        <AlertCircle size={16} className="text-red-400 shrink-0" />
                        {error}
                    </div>
                )}

                {/* STEP: MOBILE */}
                {step === 'MOBILE' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 p-6">
                            <div className="mb-6">
                                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Enter Mobile Number</h2>
                                <p className="text-slate-400 text-xs mt-1.5 font-medium">Enter your registered mobile number to find your patient</p>
                            </div>
                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="tel"
                                        maxLength="10"
                                        className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-bold tracking-[0.15em] text-slate-800 focus:border-brand-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                        placeholder="10-digit number"
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                                        autoFocus
                                    />
                                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400/50" size={20} />
                                </div>
                                <button
                                    onClick={handleMobileSearch}
                                    disabled={loading || mobile.length < 10}
                                    className="w-full h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 disabled:opacity-40 transition-all shadow-lg shadow-brand-500/20"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : <><Search size={18} /> Search Patient</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP: PATIENTS */}
                {step === 'PATIENTS' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 p-6">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Select Patient</h2>
                                    <p className="text-slate-400 text-xs mt-1 font-medium">
                                        {patients.length} patient{patients.length > 1 ? 's' : ''} found
                                    </p>
                                </div>
                                <button onClick={() => { setStep('MOBILE'); setPatients([]); setSelectedPatient(null); setError(null); }}
                                    className="text-xs font-bold text-brand-500 flex items-center gap-1">
                                    <ArrowLeft size={14} /> Edit
                                </button>
                            </div>

                            <div className="space-y-3">
                                {patients.map(p => (
                                    <button
                                        key={p.admission_id}
                                        onClick={() => { setSelectedPatient(p); setAdmissionId(p.admission_id); }}
                                        className={`w-full p-4 flex items-center justify-between text-left transition-all rounded-2xl border-2 ${selectedPatient?.admission_id === p.admission_id
                                            ? 'bg-brand-50 border-brand-500 shadow-md shadow-blue-500/10'
                                            : 'bg-white border-slate-100 hover:border-brand-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${selectedPatient?.admission_id === p.admission_id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{p.name}</p>
                                                <p className="text-[10px] font-semibold text-slate-400 mt-0.5 flex items-center gap-2">
                                                    <span className="flex items-center gap-1"><Building2 size={10} /> Room {p.room_number}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1"><Activity size={10} /> Bed {p.bed_number}</span>
                                                </p>
                                                {p.category_label && (
                                                    <p className="text-[9px] font-bold text-indigo-500 mt-0.5 uppercase tracking-wider">{p.category_label}</p>
                                                )}
                                                {p.visiting_allowed !== undefined && (
                                                    <div className="mt-1">
                                                        {p.visiting_allowed ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-bold rounded-full border border-emerald-100">
                                                                <CheckCircle2 size={10} /> {p.visiting_session} Visit Open
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold rounded-full border border-amber-100">
                                                                <Clock size={10} /> Closed • Next: {p.visiting_next?.session} {p.visiting_next?.from}–{p.visiting_next?.to}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {selectedPatient?.admission_id === p.admission_id && (
                                            <CheckCircle2 size={18} className="text-brand-500" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {selectedPatient && !selectedPatient.visiting_allowed && (
                                <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                                    <Clock size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-amber-800">Visiting Hours Closed</p>
                                        <p className="text-[10px] text-amber-600 mt-0.5 font-medium">
                                            Next visiting window: {selectedPatient.visiting_next?.session} ({selectedPatient.visiting_next?.from} – {selectedPatient.visiting_next?.to})
                                        </p>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleGeneratePass}
                                disabled={loading || !selectedPatient || (selectedPatient && !selectedPatient.visiting_allowed)}
                                className="w-full h-14 mt-5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 disabled:opacity-40 transition-all shadow-lg shadow-brand-500/20"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <><TicketCheck size={16} /> Generate Pass</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* OTP step removed — visitors go directly to pass generation */}

                {/* STEP: VISITOR_COUNT */}
                {
                    step === 'VISITOR_COUNT' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 p-6">
                                <div className="text-center mb-6">
                                    <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Users size={28} className="text-brand-500" />
                                    </div>
                                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">How many visitors?</h2>
                                    <p className="text-slate-400 text-xs mt-1.5 font-medium">
                                        Select the number of people entering together (max {maxSlots})
                                    </p>
                                </div>

                                <div className="flex flex-wrap justify-center gap-3 mb-6">
                                    {Array.from({ length: maxSlots }, (_, i) => i + 1).map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setVisitorCount(n)}
                                            className={`w-14 h-14 rounded-2xl text-lg font-bold transition-all border-2 ${visitorCount === n
                                                ? 'bg-brand-500 text-white border-indigo-600 shadow-lg shadow-indigo-600/30 scale-110'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                                }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>

                                {visitorCount > 1 && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 text-center mb-4">
                                        <p className="text-xs font-bold text-indigo-700">
                                            You + {visitorCount - 1} guest{visitorCount > 2 ? 's' : ''} entering
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={() => generateSlipDirect(visitorCount)}
                                    disabled={loading}
                                    className="w-full h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 disabled:opacity-40 transition-all shadow-lg shadow-brand-500/20"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle2 size={16} /> Continue</>}
                                </button>
                            </div>
                        </div>
                    )
                }

                {/* STEP: SLIP */}
                {
                    step === 'SLIP' && slips && slips.length > 0 && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 p-6 text-center relative border border-slate-100 overflow-hidden">
                                
                                {slips.length > 1 && (
                                    <div className="absolute top-4 right-6 bg-slate-900/10 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] font-extrabold text-slate-700 font-mono">
                                        PASS {currentPassIndex + 1} OF {slips.length}
                                    </div>
                                )}

                                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 size={28} className="text-emerald-600" />
                                </div>
                                <h2 className="text-xl font-extrabold text-slate-800 mb-1">Visitor Pass Generated!</h2>
                                <p className="text-slate-400 text-xs font-medium mb-6">Show this QR to the guard at entry</p>

                                {/* Pass Slider Container */}
                                <div className="relative flex items-center justify-center mb-6">
                                    {slips.length > 1 && (
                                        <button 
                                            onClick={() => setCurrentPassIndex(prev => (prev - 1 + slips.length) % slips.length)}
                                            className="absolute left-0 p-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 shadow-sm z-10"
                                        >
                                            <ChevronLeft className="w-4.5 h-4.5 stroke-[2.5]" />
                                        </button>
                                    )}

                                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white w-full max-w-[280px]">
                                        <div className="bg-white rounded-xl p-3 mb-4 inline-block max-w-full overflow-hidden">
                                            <QRCode value={slips[currentPassIndex].slip_token} size={150} level="H" className="mx-auto" />
                                        </div>
                                        <div className="text-sm font-black font-mono tracking-wider bg-white/10 px-3 py-1 rounded-full inline-block">
                                            {slips[currentPassIndex].slip_token}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Pass ID: {slips[currentPassIndex].id}</div>
                                    </div>

                                    {slips.length > 1 && (
                                        <button 
                                            onClick={() => setCurrentPassIndex(prev => (prev + 1) % slips.length)}
                                            className="absolute right-0 p-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 shadow-sm z-10"
                                        >
                                            <ChevronRight className="w-4.5 h-4.5 stroke-[2.5]" />
                                        </button>
                                    )}
                                </div>

                                {/* Slider Indicator Dots */}
                                {slips.length > 1 && (
                                    <div className="flex justify-center gap-1.5 mb-5">
                                        {slips.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentPassIndex(idx)}
                                                className={`h-2 rounded-full transition-all duration-300 ${
                                                    idx === currentPassIndex ? 'w-6 bg-brand-500' : 'w-2 bg-slate-200'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="bg-slate-50 rounded-2xl p-3 text-left border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Patient</p>
                                        <p className="text-xs font-bold text-slate-800 truncate">{slips[currentPassIndex].patient_name}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-3 text-left border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Ward Type</p>
                                        <p className="text-xs font-bold text-slate-800">{slips[currentPassIndex].ward_type}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-3 text-left border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Room</p>
                                        <p className="text-xs font-bold text-slate-800">{slips[currentPassIndex].room_number}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-3 text-left border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Bed</p>
                                        <p className="text-xs font-bold text-slate-800">{slips[currentPassIndex].bed_number}</p>
                                    </div>
                                </div>

                                {slips.length > 1 && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 text-center mb-4">
                                        <p className="text-xs font-semibold text-indigo-700">
                                            👥 {slips.length} separate passes generated. Swipe to see other passes.
                                        </p>
                                    </div>
                                )}

                                <div className={`${timeLeft === -1 ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'} border rounded-2xl p-3 text-center`}>
                                    <p className={`text-[10px] font-bold ${timeLeft === -1 ? 'text-blue-700' : 'text-amber-700'} uppercase tracking-wider`}>
                                        {timeLeft === -1 ? '🔒 Timer starts when QR is scanned at gate' : `⏱ Valid for ${formatTime(timeLeft)}`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    );
};

export default VisitorPortal;
