import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import QRCode from 'react-qr-code';
import {
    Search, User, Building2, Activity, Loader2, AlertCircle, ShieldCheck, Database,
    ChevronLeft, ChevronRight, Printer, Home, Clock, AlertTriangle, CheckCircle2,
    IdCard, Users
} from 'lucide-react';
import logo from '../../assets/logo.png';

const WalkInKiosk = () => {
    const navigate = useNavigate();

    // Step management: LOOKUP → FORM → SLIP
    const [step, setStep] = useState('LOOKUP');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Lookup state
    const [searchQuery, setSearchQuery] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        visitor_name: '',
        visitor_age: '',
        visitor_gender: 'Male',
        id_type: 'Aadhaar',
        id_number: '',
        visitor_count: 1
    });

    // Slip state
    const [slip, setSlip] = useState(null);
    const [patientInfo, setPatientInfo] = useState(null);

    // --- Handlers ---
    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (searchQuery.trim().length < 2) {
            setError('Enter at least 2 characters');
            return;
        }

        setLoading(true);
        setError('');
        setPatients([]);
        setSelectedPatient(null);

        try {
            const res = await api.post('/walkin/lookup', { query: searchQuery.trim() });
            setPatients(res.data.patients);
            if (res.data.patients.length === 1) {
                setSelectedPatient(res.data.patients[0]);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'No patients found');
        } finally {
            setLoading(false);
        }
    };

    const handleProceedToForm = () => {
        if (!selectedPatient) return;
        setError('');
        setStep('FORM');
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await api.post('/walkin/register', {
                patient_id: selectedPatient.patient_id,
                admission_id: selectedPatient.admission_id,
                ...formData,
                visitor_count: parseInt(formData.visitor_count) || 1
            });

            setSlip(res.data.slip);
            setPatientInfo(res.data.patient);
            setStep('SLIP');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const isAfterHours = slip?.permit_type === 'AFTER_HOURS';

    // --- Step 1: Patient Lookup ---
    const renderLookup = () => (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-6 py-3 md:px-8 md:py-4 shrink-0 border-b border-slate-50">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 font-outfit tracking-tight">Walk-In Entry</h2>
                <p className="text-slate-400 font-bold uppercase text-[8px] md:text-[9px] tracking-[0.2em] mt-1">Search by Patient UHID or Name</p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-6 md:px-8 py-4">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-2xl text-xs font-bold flex items-center gap-4 uppercase tracking-wider">
                        <AlertCircle size={18} className="text-red-500" />
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {/* ... (search input logic remains same) ... */}
                    <form onSubmit={handleSearch} className="space-y-4">
                        <label className="text-[10px] font-bold text-brand-500 uppercase tracking-[0.2em] ml-1">Patient UHID or Name</label>
                        <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    className={`w-full h-10 md:h-12 pl-10 md:pl-12 pr-4 bg-slate-50 border-2 ${patients.length > 0 ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100'} rounded-xl outline-none focus:border-brand-500 font-bold text-sm md:text-base tracking-wider transition-all`}
                                    placeholder="e.g. UHID12345 or Name"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    disabled={patients.length > 0}
                                    autoFocus
                                />
                                <Search className={`absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 ${patients.length > 0 ? 'text-emerald-500' : 'text-brand-400/50'}`} size={18} />
                            </div>
                            {patients.length === 0 && (
                                <button
                                    type="submit"
                                    disabled={loading || searchQuery.trim().length < 2}
                                    className="w-full sm:w-auto px-6 h-10 md:h-12 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-40 transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><Search size={18} /> Search</>}
                                </button>
                            )}
                        </div>
                    </form>

                    {/* Patient Results */}
                    {patients.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Select Patient</label>
                            <div className="space-y-3">
                                {patients.map(p => (
                                    <button
                                        key={p.admission_id}
                                        onClick={() => setSelectedPatient(p)}
                                        className={`w-full p-5 flex items-center justify-between text-left transition-all duration-300 rounded-2xl border-2 ${selectedPatient?.admission_id === p.admission_id
                                            ? 'bg-brand-50 border-brand-500 shadow-lg shadow-brand-500/10'
                                            : 'bg-white border-slate-100 hover:border-brand-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedPatient?.admission_id === p.admission_id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                <User size={24} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 uppercase tracking-tight">{p.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                    {p.uhid} • Room {p.room_number} • Bed {p.bed_number}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons Inside Scrollable */}
                    <div className="pt-6 flex gap-3">
                        <button onClick={() => navigate('/')} className="flex-1 h-11 bg-white border-2 border-slate-100 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:border-slate-300 transition-all flex items-center justify-center gap-2">
                            <ChevronLeft size={16} /> Cancel
                        </button>
                        <button
                            onClick={handleProceedToForm}
                            disabled={!selectedPatient}
                            className={`flex-[2] h-11 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 ${!selectedPatient ? 'opacity-30 grayscale' : 'shadow-brand-500/30'}`}
                        >
                            Continue <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderForm = () => (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-6 py-3 md:px-8 md:py-4 shrink-0 border-b border-slate-50">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 font-outfit tracking-tight">Visitor Details</h2>
                <p className="text-slate-400 font-bold uppercase text-[8px] md:text-[9px] tracking-[0.2em] mt-1">
                    Visiting: <span className="text-brand-500">{selectedPatient?.name}</span> • {selectedPatient?.category_label || 'Ward'}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-6 md:px-8 py-2 md:py-4 scrollable-area">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-2xl text-xs font-bold flex items-center gap-4 uppercase tracking-wider">
                        <AlertCircle size={18} className="text-red-500" />
                        {error}
                    </div>
                )}

                {!selectedPatient?.visiting_allowed && (
                    <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3">
                        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-amber-800">After-Hours Visit</p>
                            <p className="text-[10px] text-amber-600 mt-0.5 font-medium">
                                This permit will be marked as <strong>AFTER HOURS</strong>. Next regular window: {selectedPatient?.visiting_next?.session} ({selectedPatient?.visiting_next?.from} – {selectedPatient?.visiting_next?.to})
                            </p>
                        </div>
                    </div>
                )}

                <form id="walkin-form" onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name *</label>
                        <div className="relative">
                            <input
                                type="text" name="visitor_name" required
                                placeholder="As per ID card"
                                value={formData.visitor_name} onChange={handleFormChange}
                                className="w-full h-10 md:h-12 pl-10 md:pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-brand-500 font-bold text-xs md:text-sm transition-all"
                                autoFocus
                            />
                            <User className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Age</label>
                            <input
                                type="number" name="visitor_age" min="1" max="120"
                                placeholder="Age"
                                value={formData.visitor_age} onChange={handleFormChange}
                                className="w-full h-10 md:h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-brand-500 font-bold text-xs md:text-sm transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Gender</label>
                            <select
                                name="visitor_gender" value={formData.visitor_gender} onChange={handleFormChange}
                                className="w-full h-10 md:h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-brand-500 font-bold text-xs md:text-sm transition-all appearance-none"
                            >
                                <option>Male</option>
                                <option>Female</option>
                                <option>Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">ID Type</label>
                        <div className="relative">
                            <select
                                name="id_type" value={formData.id_type} onChange={handleFormChange}
                                className="w-full h-10 md:h-12 pl-10 md:pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-brand-500 font-bold text-xs md:text-sm transition-all appearance-none"
                            >
                                <option value="">Select ID Type (Optional)</option>
                                <option>Aadhaar</option>
                                <option>PAN Card</option>
                                <option>Passport</option>
                                <option>Driving License</option>
                                <option>Other Govt ID</option>
                            </select>
                            <IdCard className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">ID Number</label>
                        <input
                            type="text" name="id_number"
                            placeholder="Enter ID number (Optional)"
                            value={formData.id_number} onChange={handleFormChange}
                            className="w-full h-10 md:h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-brand-500 font-bold text-xs md:text-sm tracking-wider transition-all"
                        />
                    </div>


                    {/* Final Action Button Inside Scroll Area */}
                    <div className="pt-6 flex gap-3">
                        <button type="button" onClick={() => { setStep('LOOKUP'); setError(''); }} className="flex-1 h-11 bg-white border-2 border-slate-100 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:border-slate-300 transition-all flex items-center justify-center gap-2">
                            <ChevronLeft size={16} /> Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !formData.visitor_name}
                            className="flex-[2] h-11 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-brand-500/30 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-40"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <>ENTER <ChevronRight size={18} /></>}
                        </button>
                    </div>
                </form>
            </div>

            {/* Removed sticky footer as buttons are now inside scrollable area for reliability */}
        </div>
    );

    // --- Step 3: Slip Display ---
    const renderSlip = () => (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left: Instructions */}
                <div className="flex-1 p-6 md:p-10 overflow-y-auto border-b lg:border-r border-slate-50 no-print">
                    <h1 className="text-2xl md:text-4xl font-black text-slate-900 font-outfit tracking-tighter leading-tight mb-8 uppercase text-center lg:text-left">
                        {isAfterHours ? 'After Hours Permit' : 'Access Protocol'}
                    </h1>

                    {isAfterHours && (
                        <div className="mb-8 p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-4">
                            <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-800 mb-1">After-Hours Permit Issued</p>
                                <p className="text-xs text-amber-600 font-medium leading-relaxed">
                                    This permit was generated outside regular visiting hours. Guard verification is required at the ward entrance.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-8">
                        <div className="flex gap-6">
                            <div className="w-10 h-10 bg-slate-900 text-white rounded-[1rem] flex items-center justify-center text-sm font-black shrink-0">01</div>
                            <div>
                                <p className="text-slate-900 font-black uppercase text-[10px] tracking-[0.2em] mb-1">Print this Permit</p>
                                <p className="text-slate-500 text-xs font-medium leading-relaxed italic">Collect your printed visitor permit from the kiosk.</p>
                            </div>
                        </div>
                        <div className="flex gap-6">
                            <div className="w-10 h-10 bg-slate-900 text-white rounded-[1rem] flex items-center justify-center text-sm font-black shrink-0">02</div>
                            <div>
                                <p className="text-slate-900 font-black uppercase text-[10px] tracking-[0.2em] mb-1">Present at Gate</p>
                                <p className="text-slate-500 text-xs font-medium leading-relaxed italic">Show the QR code to the security guard. Timer starts on scan.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: QR Slip */}
                <div className="flex-1 lg:w-[400px] lg:flex-none bg-slate-50 flex flex-col overflow-y-auto shrink-0 no-print-bg">
                    <div className="p-6 md:p-10 flex-1 flex flex-col items-center print-preview-container">
                        <div id="print-area" className="w-full max-w-[320px] bg-white shadow-2xl relative overflow-hidden flex flex-col rounded-sm border-t-8 border-slate-900 shrink-0">

                            {/* After Hours Banner */}
                            {isAfterHours && (
                                <div className="bg-amber-500 text-white text-center py-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">⚠ After Hours Permit</p>
                                </div>
                            )}

                            {/* Header */}
                            <div className="p-8 border-b border-dashed border-slate-200 text-center">
                                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white mx-auto mb-3">
                                    <Activity size={22} />
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-900">Action Care Hospital</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    {isAfterHours ? 'Walk-In After Hours' : 'Walk-In Visitor Permit'}
                                </p>
                            </div>

                            <div className="p-10 space-y-8">
                                {/* Visitor */}
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 italic leading-none">Walk-In Visitor</p>
                                    <p className="text-2xl font-black text-slate-800 font-outfit uppercase tracking-tighter leading-tight">{slip.visitor_name}</p>
                                </div>

                                {/* Patient + Ward */}
                                <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-6">
                                    <div className="text-center border-r border-slate-100">
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 italic leading-none">Patient</p>
                                        <p className="text-xs font-black text-slate-700 font-outfit uppercase leading-tight">{patientInfo?.name}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 italic leading-none">Location</p>
                                        <p className="text-xs font-black text-brand-500 font-outfit uppercase leading-none">
                                            {patientInfo?.room_number && patientInfo.room_number !== '-' && patientInfo.room_number !== '—' && patientInfo.room_number.trim() !== ''
                                                ? `R-${patientInfo.room_number} / `
                                                : ''}B-{patientInfo?.bed_number}
                                        </p>
                                    </div>
                                </div>

                                {/* QR */}
                                <div className="flex justify-center py-4">
                                    <div className={`p-4 bg-white border-2 ${isAfterHours ? 'border-amber-500' : 'border-slate-900'} rounded-[2rem] shadow-xl`}>
                                        <QRCode value={slip.slip_token} size={160} level="M" fgColor="#0F172A" />
                                    </div>
                                </div>

                                {/* Token + Status */}
                                <div className="text-center pt-6 border-t border-dashed border-slate-100">
                                    <p className="text-xs font-black text-slate-900 font-mono tracking-widest uppercase">{slip.slip_token}</p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3 italic leading-relaxed">
                                        🔒 Timer activates on QR scan at gate
                                    </p>
                                    {slip.visitor_count > 1 && (
                                        <p className="text-[9px] font-bold text-indigo-500 mt-2">👥 {slip.visitor_count} visitors entering together</p>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Stripe */}
                            <div className={`h-6 mt-2 ${isAfterHours ? 'bg-amber-500' : 'bg-slate-900'}`} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-3 md:px-8 md:py-4 border-t border-slate-50 bg-slate-50/30 no-print shrink-0">
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => window.print()}
                        className="relative flex-[2.5] bg-slate-900 hover:bg-black text-white py-3 md:py-4 text-xs font-black font-outfit uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-4 group overflow-hidden"
                    >
                        <span className="relative z-10">Generate Print</span>
                        <Printer size={18} className="relative z-10 group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="relative flex-1 bg-white border-2 border-slate-100 hover:border-slate-300 text-slate-400 hover:text-slate-900 py-3 md:py-4 text-sm font-black font-outfit uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-4"
                    >
                        <Home size={18} />
                    </button>
                </div>
            </div>
        </div>
    );

    // --- Layout ---
    return (
        <div className="his-shell bg-[#f8fafc] flex-col h-screen overflow-hidden">
            <div className="absolute inset-0 medical-subgrid opacity-20 pointer-events-none no-print" />

            {/* Header */}
            <header className="sticky top-0 px-6 py-4 md:px-12 md:py-6 flex flex-col md:flex-row justify-between items-center z-50 border-b border-slate-100 bg-white/50 backdrop-blur-md gap-4 no-print">
                <div className="flex items-center gap-5">
                    <img src={logo} alt="Action Care" className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-contain bg-white shadow-xl shadow-brand-500/20" />
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-900 font-outfit uppercase tracking-tighter leading-none">Walk-In Kiosk</h2>
                        <p className="text-[10px] font-black text-amber-500 mt-2 uppercase tracking-[0.2em] opacity-80">
                            {step === 'LOOKUP' && 'Step 01: Patient Search'}
                            {step === 'FORM' && 'Step 02: Visitor Registration'}
                            {step === 'SLIP' && 'Step 03: Permit Generated'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {step !== 'LOOKUP' && step !== 'SLIP' && (
                        <div className="px-4 py-1.5 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 text-[9px] font-black uppercase tracking-widest">
                            {selectedPatient?.name}
                        </div>
                    )}
                    <div className="px-4 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                        Walk-In Mode
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative z-10">
                {/* Side Panel */}
                <div className="hidden lg:flex w-80 bg-[#0f172a] text-white p-10 flex-col justify-center sticky top-0 h-full no-print">
                    <div className="mb-10">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                            <ShieldCheck size={24} className="text-amber-400" />
                        </div>
                        <h3 className="text-2xl font-black font-outfit tracking-tighter mb-4 leading-tight">Walk-In<br />Registration</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">For visitors who cannot receive mobile messages. Fill out the form, generate a permit, and present the QR at the ward entrance.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className={`w-5 h-5 ${step === 'LOOKUP' ? 'bg-amber-500' : 'bg-emerald-500'} rounded-lg flex items-center justify-center text-[9px] font-black shrink-0`}>
                                {step !== 'LOOKUP' ? '✔' : '01'}
                            </div>
                            <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider leading-relaxed">Search patient by UHID or name</p>
                        </div>
                        <div className="flex gap-4">
                            <div className={`w-5 h-5 ${step === 'SLIP' ? 'bg-emerald-500' : step === 'FORM' ? 'bg-amber-500' : 'bg-slate-700'} rounded-lg flex items-center justify-center text-[9px] font-black shrink-0`}>
                                {step === 'SLIP' ? '✔' : '02'}
                            </div>
                            <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider leading-relaxed">Fill visitor details & ID information</p>
                        </div>
                        <div className="flex gap-4">
                            <div className={`w-5 h-5 ${step === 'SLIP' ? 'bg-amber-500' : 'bg-slate-700'} rounded-lg flex items-center justify-center text-[9px] font-black shrink-0`}>03</div>
                            <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider leading-relaxed">Print permit & present at gate</p>
                        </div>
                    </div>

                    <div className="mt-auto pt-10 border-t border-white/5 flex items-center gap-4 text-slate-500">
                        <Database size={14} />
                        <span className="text-[9px] font-black uppercase tracking-[0.4em]">Walk-In: WK-01</span>
                    </div>
                </div>

                {/* Main Content */}
                <main className="flex-1 flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 lg:p-10">
                    <div className="w-full max-w-5xl bg-white his-premium-card flex flex-col h-full sm:h-auto sm:max-h-[92vh] sm:rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.06)] overflow-hidden">
                        {step === 'LOOKUP' && renderLookup()}
                        {step === 'FORM' && renderForm()}
                        {step === 'SLIP' && renderSlip()}
                    </div>
                </main>
            </div>

            <footer className="relative bg-white border-t border-slate-100 z-50 py-4 px-6 md:px-12 flex justify-center items-center no-print">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.5em] text-slate-300 italic text-center leading-normal">Walk-In Kiosk • No mobile verification required • ID mandatory</span>
            </footer>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 0; size: portrait; }
                    .no-print, header, footer, .lg\\:flex.w-80 { display: none !important; }
                    .no-print-bg { background: white !important; padding: 0 !important; }
                    body, .his-shell, main { background: white !important; height: auto !important; display: block !important; padding: 0 !important; margin: 0 !important; }
                    .his-premium-card, .print-parent { box-shadow: none !important; border: none !important; max-width: 100% !important; height: auto !important; display: block !important; margin: 0 !important; padding: 0 !important; }
                    .print-preview-container { display: block !important; width: 100% !important; padding-top: 40px !important; }
                    #print-area { position: relative !important; margin: 0 auto !important; width: 320px !important; box-shadow: none !important; border: 1px dashed #ccc !important; }
                }
                
                /* Force visible scrollbar for kiosk suitability */
                .overflow-y-auto::-webkit-scrollbar {
                    width: 6px;
                }
                .overflow-y-auto::-webkit-scrollbar-track {
                    background: transparent;
                }
                .overflow-y-auto::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}} />
        </div>
    );
};

export default WalkInKiosk;
