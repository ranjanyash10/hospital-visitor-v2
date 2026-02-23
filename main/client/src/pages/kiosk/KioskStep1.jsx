import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';
import { Loader2, User, Building2, Smartphone, Search, ChevronLeft, Activity, ShieldCheck, Database, CheckCircle2, AlertCircle } from 'lucide-react';

const KioskStep1 = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);

    const [mobile, setMobile] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);

    const handleMobileSearch = async (e) => {
        if (e) e.preventDefault();
        if (!/^[0-9]{10}$/.test(mobile)) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        setSearching(true);
        setError(null);
        setPatients([]);
        setSelectedPatient(null);

        try {
            const res = await api.get(`/kiosk/visitor/${mobile}`);
            const foundPatients = res.data.patients;
            setPatients(foundPatients);

            if (foundPatients.length === 1) {
                setSelectedPatient(foundPatients[0]);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'No active admissions linked to this number');
        } finally {
            setSearching(false);
        }
    };

    const handleNext = async () => {
        if (!selectedPatient) return;

        setLoading(true);
        setError(null);

        try {
            const res = await api.post('/kiosk/send-otp', {
                mobile,
                admission_id: selectedPatient.admission_id
            });

            const { sessionId } = res.data;

            navigate('/kiosk/otp', {
                state: {
                    sessionId,
                    relativeMobile: mobile,
                    admissionId: selectedPatient.admission_id,
                    patientName: selectedPatient.name,
                    relativeName: 'Visitor'
                }
            });

        } catch (err) {
            setError(err.response?.data?.error || 'Registry match failure: OTP dispatch failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="his-shell bg-[#f8fafc]">
            <div className="absolute inset-0 medical-subgrid opacity-20 pointer-events-none" />

            <header className="sticky top-0 px-6 py-4 md:px-12 md:py-8 flex flex-col md:flex-row justify-between items-center z-50 border-b border-slate-100 bg-white/50 backdrop-blur-md gap-4">
                <div className="flex items-center gap-5">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-600/20">
                        <Smartphone size={20} className="md:w-6 md:h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-900 font-outfit uppercase tracking-tighter leading-none">Visitor Clearance</h2>
                        <p className="text-[10px] font-black text-blue-600 mt-2 uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-80">Registry Clearance Phase 01/03</p>
                    </div>
                </div>
                <div className="flex items-center">
                    <div className="px-4 py-1.5 md:px-5 md:py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Database: Nominal
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative z-10">
                <div className="hidden lg:flex w-96 bg-[#0f172a] text-white p-12 flex-col justify-center sticky top-0 h-full">
                    <div className="mb-12">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                            <ShieldCheck size={28} className="text-blue-400" />
                        </div>
                        <h3 className="text-3xl font-black font-outfit tracking-tighter mb-4 leading-tight">Visitor <br /> Verification</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Enter your registered mobile number to retrieve authorized inpatient records. All visitation is subject to primary contact clearance.</p>
                    </div>

                    <div className="space-y-8">
                        <div className="flex gap-5">
                            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">01</div>
                            <p className="text-xs text-slate-300 font-bold uppercase tracking-wider leading-relaxed">Enter your 10-digit registered mobile number.</p>
                        </div>
                        <div className="flex gap-5">
                            <div className="w-6 h-6 bg-slate-700 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">02</div>
                            <p className="text-xs text-slate-300 font-bold uppercase tracking-wider leading-relaxed">Select the patient from the authorized registry.</p>
                        </div>
                    </div>

                    <div className="mt-auto pt-12 border-t border-white/5 flex items-center gap-4 text-slate-500">
                        <Database size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Core_Vault: PR-K1</span>
                    </div>
                </div>

                <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-10">
                    <div className="w-full max-w-3xl bg-white his-premium-card flex flex-col max-h-[95vh] shadow-[0_40px_80px_rgba(0,0,0,0.06)] overflow-hidden">
                        <div className="p-5 md:p-6 lg:p-8 pb-0">
                            <div className="mb-0 pb-4 md:pb-6 border-b border-slate-50">
                                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 font-outfit tracking-tight">Visitor Entry</h2>
                                <p className="text-slate-400 font-bold uppercase text-[9px] md:text-[10px] tracking-[0.2em] mt-2">Initialize inpatient visitation protocol</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-12 py-4">
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-2xl text-xs font-bold flex items-center gap-4 uppercase tracking-wider">
                                    <AlertCircle size={18} className="text-red-500" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-8">
                                {/* Step A: Mobile Number */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] ml-2">Registered Mobile Number</label>
                                    <div className="flex gap-4">
                                        <div className="relative flex-1">
                                            <input
                                                type="tel"
                                                maxLength="10"
                                                className={`his-input-refined pl-14 py-4 tracking-[0.2em] font-bold text-lg ${patients.length > 0 ? 'bg-emerald-50/30 border-emerald-100' : ''}`}
                                                placeholder="10-digit number"
                                                value={mobile}
                                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                                                disabled={searching || patients.length > 0}
                                            />
                                            <Smartphone className={`absolute left-5 top-1/2 -translate-y-1/2 ${patients.length > 0 ? 'text-emerald-500' : 'text-blue-400/50'}`} size={24} />
                                        </div>
                                        {patients.length === 0 ? (
                                            <button
                                                onClick={handleMobileSearch}
                                                disabled={searching || mobile.length < 10}
                                                className="his-btn-impact px-8 py-4 shadow-xl shadow-blue-600/20 disabled:opacity-50"
                                            >
                                                {searching ? <Loader2 className="animate-spin" /> : <Search size={24} />}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { setPatients([]); setSelectedPatient(null); setMobile(''); }}
                                                className="his-btn-secondary px-6 font-bold text-[10px] uppercase tracking-widest border-slate-200"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Step B: Patient Selection */}
                                {patients.length > 0 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Select Inpatient to Visit</label>

                                        {patients.length === 1 ? (
                                            /* Auto-selected Card */
                                            <div className="p-6 bg-blue-50/50 border-2 border-blue-200 rounded-3xl flex items-center justify-between">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                        <User size={28} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xl font-black text-slate-800 font-outfit uppercase tracking-tight">{patients[0].name}</h4>
                                                        <div className="flex gap-4 mt-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                                <Building2 size={12} /> {patients[0].ward_number}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                                <Activity size={12} /> Bed {patients[0].bed_number}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <div className="px-3 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-full flex items-center gap-2">
                                                        <CheckCircle2 size={10} /> Auto-Selected
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-300 mt-2 uppercase tracking-widest">{patients[0].uhid}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Dropdown for Selection */
                                            <div className="space-y-3">
                                                {patients.map(p => (
                                                    <button
                                                        key={p.admission_id}
                                                        onClick={() => setSelectedPatient(p)}
                                                        className={`w-full p-5 flex items-center justify-between text-left transition-all duration-300 rounded-2xl border-2 ${selectedPatient?.admission_id === p.admission_id
                                                            ? 'bg-blue-50 border-blue-600 shadow-lg shadow-blue-600/10'
                                                            : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50/50'}`}
                                                    >
                                                        <div className="flex items-center gap-5">
                                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedPatient?.admission_id === p.admission_id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                <User size={24} />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800 uppercase tracking-tight">{p.name}</p>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                                    Ward {p.ward_number} • Bed {p.bed_number}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {selectedPatient?.admission_id === p.admission_id && (
                                                            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
                                                                <CheckCircle2 size={14} />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 lg:p-8 pt-4 border-t border-slate-50 bg-slate-50/30">
                            <div className="flex gap-4">
                                <Link to="/" className="his-btn-secondary-impact flex-1 py-4">
                                    <ChevronLeft size={20} /> Cancel
                                </Link>
                                <button
                                    onClick={handleNext}
                                    disabled={loading || !selectedPatient}
                                    className={`his-btn-impact flex-[2] py-4 shadow-2xl transition-all duration-500 ${selectedPatient ? 'shadow-blue-600/30' : 'opacity-30 grayscale'}`}
                                >
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : <>Process Clearance <Search size={24} /></>}
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <footer className="relative bg-white border-t border-slate-100 z-10 py-4 px-6 md:px-12 flex justify-center items-center">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.5em] text-slate-300 italic text-center leading-relaxed">Intentional falsification of registry records is subject to facility security prosecution.</span>
            </footer>
        </div>
    );
};

export default KioskStep1;
