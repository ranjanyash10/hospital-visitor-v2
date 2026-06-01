import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
    User, ClipboardCheck, IdCard, Smartphone, CheckCircle2, 
    Loader2, ArrowRight, ShieldCheck, UserCheck, Plus, Trash2, 
    ChevronLeft, ChevronRight, Share2, Printer, MapPin, Calendar, HeartHandshake
} from 'lucide-react';
import QRCode from 'react-qr-code';
import logo from '../../assets/logo.png';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const VisitorRegistrationForm = () => {
    const { uhid } = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [patient, setPatient] = useState(null);
    const [error, setError] = useState('');
    
    // Slips generated on success
    const [successSlips, setSuccessSlips] = useState(null);
    const [currentPassIndex, setCurrentPassIndex] = useState(0);

    // Dynamic list of visitors (minimum 1)
    const [visitors, setVisitors] = useState([
        { visitor_name: '', visitor_age: '', visitor_gender: 'Male', id_type: 'Aadhaar', id_number: '' }
    ]);

    useEffect(() => {
        fetchPatientInfo();
    }, [uhid]);

    const fetchPatientInfo = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/visitor/form-info/${uhid}`);
            if (response.data.success) {
                setPatient(response.data.patient);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load patient information');
        } finally {
            setLoading(false);
        }
    };

    const handleVisitorChange = (index, field, value) => {
        setVisitors(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const addVisitor = () => {
        const slots = patient?.remaining_slots ?? 1;
        if (visitors.length < slots) {
            setVisitors(prev => [
                ...prev,
                { visitor_name: '', visitor_age: '', visitor_gender: 'Male', id_type: 'Aadhaar', id_number: '' }
            ]);
        }
    };

    const removeVisitor = (index) => {
        if (visitors.length > 1) {
            setVisitors(prev => prev.filter((_, idx) => idx !== index));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/visitor/pre-register`, {
                visitors,
                uhid
            });

            if (response.data.success) {
                setSuccessSlips(response.data.slips);
                setCurrentPassIndex(0);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-4" />
                <p className="text-slate-600 font-semibold tracking-tight">Loading patient & admission details...</p>
            </div>
        );
    }

    if (successSlips && successSlips.length > 0) {
        const activePass = successSlips[currentPassIndex];

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 flex flex-col items-center justify-center">
                
                {/* Hospital Header on Success Page */}
                <div className="text-center mb-6 max-w-md w-full">
                    <img src={logo} alt="Hospital Logo" className="w-12 h-12 object-contain mx-auto mb-2 drop-shadow-lg" />
                    <h2 className="text-white font-extrabold text-lg uppercase tracking-wider font-outfit">Sri Balaji Action Medical Institute</h2>
                    <p className="text-slate-400 text-xs mt-1 uppercase font-bold tracking-widest">Digital Visitor Passes</p>
                </div>

                <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative border border-slate-100 flex flex-col justify-between">
                    
                    {/* Multi-pass badge indicator */}
                    {successSlips.length > 1 && (
                        <div className="absolute top-4 right-6 bg-slate-900/10 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-black text-slate-800 z-20 font-mono">
                            PASS {currentPassIndex + 1} OF {successSlips.length}
                        </div>
                    )}

                    {/* Gradient Top Banner */}
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 text-center text-white relative overflow-hidden">
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="bg-white/20 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md shadow-inner">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-black font-outfit mb-0.5 tracking-tight">Access Token Ready</h3>
                        <p className="text-emerald-50 text-xs font-semibold opacity-90">Please present this code at the gate</p>
                    </div>

                    <div className="p-6 md:p-8 text-center">
                        {/* Slide Navigation & QR Container */}
                        <div className="relative flex items-center justify-center mb-6">
                            
                            {successSlips.length > 1 && (
                                <button 
                                    onClick={() => setCurrentPassIndex(prev => (prev - 1 + successSlips.length) % successSlips.length)}
                                    className="absolute left-0 p-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-full hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 shadow-sm z-10"
                                >
                                    <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                                </button>
                            )}

                            <div className="bg-gradient-to-b from-slate-50 to-slate-100/50 p-6 rounded-[2rem] inline-block border-2 border-slate-100/80 shadow-inner transition-transform duration-300 transform scale-100 hover:scale-[1.02]">
                                <QRCode value={activePass.slip_token} size={170} level="H" className="mx-auto" />
                                <div className="mt-4 bg-slate-900 text-white py-1 px-3.5 rounded-full inline-block text-[11px] font-extrabold tracking-widest font-mono shadow-md">
                                    {activePass.slip_token}
                                </div>
                            </div>

                            {successSlips.length > 1 && (
                                <button 
                                    onClick={() => setCurrentPassIndex(prev => (prev + 1) % successSlips.length)}
                                    className="absolute right-0 p-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-full hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 shadow-sm z-10"
                                >
                                    <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                                </button>
                            )}
                        </div>

                        {/* Slider indicator dots */}
                        {successSlips.length > 1 && (
                            <div className="flex justify-center gap-2 mb-6">
                                {successSlips.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentPassIndex(idx)}
                                        className={`h-2.5 rounded-full transition-all duration-300 ${
                                            idx === currentPassIndex ? 'w-8 bg-indigo-600' : 'w-2.5 bg-slate-200'
                                        }`}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Digital Pass Specs */}
                        <div className="space-y-4 text-left">
                            <div className="bg-slate-50/80 p-5 rounded-[1.75rem] border border-slate-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <User className="w-16 h-16 text-slate-900" />
                                </div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold mb-1">Visitor Name</p>
                                <p className="text-slate-800 font-black text-lg font-outfit leading-tight">{activePass.visitor_name}</p>
                                
                                <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-200/50">
                                    <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Patient Visit</p>
                                        <p className="text-slate-700 font-bold text-sm leading-tight">{patient?.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Location</p>
                                        <p className="text-slate-700 font-bold text-sm leading-tight">Room {patient?.room_number} • Bed {patient?.bed_number}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3.5 p-4.5 bg-indigo-50/60 border border-indigo-100/50 rounded-2xl">
                                <ShieldCheck className="w-5.5 h-5.5 text-indigo-600 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-indigo-800 leading-relaxed font-semibold">
                                     Sri Balaji Secure. Present this QR to the guard at entry. Each person has a separate QR and must check in individually.
                                </p>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-2 gap-3 mt-6">
                            <button
                                onClick={() => window.print()}
                                className="bg-slate-800 hover:bg-slate-950 text-white font-bold py-4 px-4 rounded-2xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                            >
                                <Printer className="w-4 h-4" /> Print Pass
                            </button>
                            <button
                                onClick={() => {
                                    if (navigator.share) {
                                        navigator.share({
                                            title: 'Hospital Visitor Pass',
                                            text: `Visitor Pass for ${activePass.visitor_name} at Sri Balaji Action Medical Institute. Token: ${activePass.slip_token}`,
                                            url: window.location.href
                                        }).catch(() => {});
                                    } else {
                                        navigator.clipboard.writeText(activePass.slip_token);
                                        alert('Pass token copied to clipboard!');
                                    }
                                }}
                                className="bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-4 px-4 rounded-2xl transition-all active:scale-98 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                            >
                                <Share2 className="w-4 h-4 text-slate-500" /> Share Pass
                            </button>
                        </div>

                        {/* Register another relative link */}
                        <button 
                            onClick={() => {
                                setSuccessSlips(null);
                                setVisitors([{ visitor_name: '', visitor_age: '', visitor_gender: 'Male', id_type: 'Aadhaar', id_number: '' }]);
                            }}
                            className="mt-5 text-indigo-600 hover:text-indigo-800 text-xs font-extrabold uppercase tracking-wider hover:underline"
                        >
                            Register another visitor
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pb-16">
            {/* Sri Balaji Header Branding */}
            <div className="bg-white px-6 py-5 border-b border-slate-200/80 sticky top-0 z-10 shadow-sm">
                <div className="max-w-xl mx-auto flex items-center gap-4.5">
                    <img src={logo} alt="Sri Balaji Logo" className="w-12 h-12 object-contain filter drop-shadow-sm" />
                    <div>
                        <h1 className="text-[17px] font-black text-slate-800 tracking-tight leading-none uppercase font-outfit">Sri Balaji Action Medical Institute</h1>
                        <p className="text-[9px] text-brand-600 mt-1.5 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                            Visitor Entry Pre-Registration
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-5 mt-6 max-w-xl mx-auto">
                {/* Patient Summary Card */}
                {patient && (
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-[2rem] p-6 text-white mb-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                            <UserCheck className="w-28 h-28" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest mb-1.5">Admitted Patient Summary</p>
                            <h2 className="text-2xl font-black font-outfit tracking-tight mb-4">{patient.name}</h2>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs font-semibold">
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">UHID</p>
                                    <p className="font-mono text-sm tracking-wide text-slate-200">{patient.uhid}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Hospital Location</p>
                                    <p className="text-sm text-slate-200">Ward {patient.ward_type} • Bed {patient.bed_number}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-rose-50 border-2 border-rose-100 text-rose-600 px-4.5 py-4 rounded-2xl text-xs font-bold mb-6 flex items-center gap-3 shadow-sm animate-shake">
                        <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Form Wrapper */}
                <div className="bg-white rounded-[2.25rem] p-6 md:p-8 shadow-sm border border-slate-200/60 relative">
                    <div className="mb-6 flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 font-outfit mb-1.5">Visitor Verification</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                Maximum capacity left: <strong className="text-indigo-600 font-extrabold">{patient?.remaining_slots ?? 1} visitor(s)</strong>
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        
                        {/* List of Dynamic Visitors */}
                        <div className="space-y-6">
                            {visitors.map((visitor, idx) => (
                                <div key={idx} className="p-5.5 bg-slate-50/50 rounded-3xl border border-slate-100 relative group transition-colors duration-300 hover:bg-slate-50">
                                    
                                    {/* Section Header */}
                                    <div className="flex justify-between items-center mb-5 pb-2.5 border-b border-slate-200/50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">
                                                {idx + 1}
                                            </div>
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider font-outfit">Visitor {idx === 0 ? 'Details (Primary)' : `Details`}</h4>
                                        </div>
                                        
                                        {visitors.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeVisitor(idx)}
                                                className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 active:scale-95"
                                                title="Remove Visitor"
                                            >
                                                <Trash2 className="w-4.5 h-4.5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Form Fields */}
                                    <div className="space-y-4">
                                        {/* Visitor Name */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="e.g. John Doe"
                                                    value={visitor.visitor_name}
                                                    onChange={e => handleVisitorChange(idx, 'visitor_name', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-slate-700 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                                                />
                                                <User className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Age */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Age</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="120"
                                                    placeholder="Age"
                                                    value={visitor.visitor_age}
                                                    onChange={e => handleVisitorChange(idx, 'visitor_age', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                                                />
                                            </div>
                                            
                                            {/* Gender */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Gender</label>
                                                <select
                                                    value={visitor.visitor_gender}
                                                    onChange={e => handleVisitorChange(idx, 'visitor_gender', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all appearance-none"
                                                >
                                                    <option>Male</option>
                                                    <option>Female</option>
                                                    <option>Other</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* ID Type */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Identification Type</label>
                                            <div className="relative">
                                                <select
                                                    value={visitor.id_type}
                                                    onChange={e => handleVisitorChange(idx, 'id_type', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-slate-700 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all appearance-none"
                                                >
                                                    <option>Aadhaar</option>
                                                    <option>PAN Card</option>
                                                    <option>Passport</option>
                                                    <option>Driving License</option>
                                                    <option>Other Govt ID</option>
                                                </select>
                                                <IdCard className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>

                                        {/* ID Number */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">ID Number</label>
                                            <input
                                                type="text"
                                                placeholder="Enter ID number"
                                                value={visitor.id_number}
                                                onChange={e => handleVisitorChange(idx, 'id_number', e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Visitor Button */}
                        {visitors.length < (patient?.remaining_slots ?? 1) && (
                            <button
                                type="button"
                                onClick={addVisitor}
                                className="w-full bg-indigo-50 border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-100/50 py-4.5 rounded-3xl transition-all font-bold flex items-center justify-center gap-2 group text-sm uppercase tracking-wider active:scale-99"
                            >
                                <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-300" />
                                Add Another Visitor
                            </button>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-extrabold py-5 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2 text-sm uppercase tracking-widest mt-8 disabled:opacity-40"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Registering Visitor(s)...
                                </>
                            ) : (
                                <>
                                    Generate Visitor Pass{visitors.length > 1 ? 'es' : ''}
                                    <ArrowRight className="w-5 h-5 hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="flex flex-col items-center justify-center text-center mt-10 gap-2.5 px-6">
                    <HeartHandshake className="w-6 h-6 text-slate-400" />
                    <p className="text-slate-400 text-[11px] font-semibold italic leading-relaxed">
                        Sri Balaji Action Medical Institute prioritizes patient security. Pre-registration ensures seamless entry, minimized waiting lines, and clean digital tracking.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VisitorRegistrationForm;
