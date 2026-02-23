import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { User, ClipboardCheck, IdCard, Smartphone, CheckCircle2, Loader2, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import QRCode from 'react-qr-code';
import { clsx } from 'clsx';
import logo from '../../assets/logo.png';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const VisitorRegistrationForm = () => {
    const { uhid } = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [patient, setPatient] = useState(null);
    const [error, setError] = useState('');
    const [successSlip, setSuccessSlip] = useState(null);

    const [formData, setFormData] = useState({
        visitor_name: '',
        visitor_age: '',
        visitor_gender: 'Male',
        id_type: 'Aadhaar',
        id_number: '',
        mobile: ''
    });

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

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/visitor/pre-register`, {
                ...formData,
                uhid
            });

            if (response.data.success) {
                setSuccessSlip(response.data.slip);
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
                <p className="text-slate-600 font-medium">Loading admission details...</p>
            </div>
        );
    }

    if (successSlip) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-brand-600 to-indigo-700 p-4 flex items-center justify-center">
                <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
                    <div className="bg-emerald-500 p-8 text-center text-white">
                        <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                            <CheckCircle2 className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-1">Registration Complete</h2>
                        <p className="text-emerald-50 text-sm opacity-90">Your digital visitor pass is ready</p>
                    </div>

                    <div className="p-8 text-center">
                        <div className="bg-slate-50 p-6 rounded-3xl inline-block mb-6 border-2 border-slate-100 shadow-inner">
                            <QRCode value={successSlip.slip_token} size={180} level="H" />
                        </div>

                        <div className="space-y-4 text-left">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Visitor Pass For</p>
                                <p className="text-slate-800 font-bold text-lg">{patient?.name}</p>
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/50">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Location</p>
                                        <p className="text-slate-700 font-medium text-sm">Ward {patient?.ward_type} • Room {patient?.room_number}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Valid Until</p>
                                        <p className="text-slate-700 font-medium text-sm">{new Date(successSlip.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                                <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
                                <p className="text-xs text-blue-700 leading-relaxed font-medium">
                                    Please present this QR code to the guard at the entrance. Your pass allows up to <strong>{patient?.max_visitors} scan(s)</strong>.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => window.print()}
                            className="w-full mt-8 bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98]"
                        >
                            Save Pass / Print
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header */}
            <div className="bg-white px-6 py-6 border-b border-slate-200 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <img src={logo} alt="Hospital Logo" className="w-10 h-10 object-contain" />
                    <div>
                        <h1 className="text-[16px] font-black text-slate-800 tracking-tight leading-none uppercase">Sri Balaji Action Medical Institute</h1>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-widest">Pre-Visitor Registration</p>
                    </div>
                </div>
            </div>

            <div className="px-5 mt-6 max-w-xl mx-auto">
                {/* Patient Summary Card */}
                {patient && (
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-6 text-white mb-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <UserCheck className="w-24 h-24" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Admitted Patient</p>
                            <h2 className="text-2xl font-bold mb-4">{patient.name}</h2>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">UHID</p>
                                    <p className="font-mono text-sm">{patient.uhid}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Location</p>
                                    <p className="text-sm">Ward {patient.ward_type} • Bed {patient.bed_number}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-rose-50 border-2 border-rose-100 text-rose-600 px-4 py-3 rounded-2xl text-sm font-medium mb-6 flex items-center gap-2 animate-shake">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Visitor Details</h3>
                        <p className="text-sm text-slate-500 font-medium">Enter your information as it appears on your ID card.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    name="visitor_name"
                                    required
                                    placeholder="e.g. John Doe"
                                    value={formData.visitor_name}
                                    onChange={handleInputChange}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:border-brand-500 focus:bg-white transition-all outline-none"
                                />
                                <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-500 transition-colors" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Age</label>
                                <input
                                    type="number"
                                    name="visitor_age"
                                    required
                                    min="1"
                                    max="120"
                                    placeholder="Age"
                                    value={formData.visitor_age}
                                    onChange={handleInputChange}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 focus:border-brand-500 focus:bg-white transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Gender</label>
                                <select
                                    name="visitor_gender"
                                    value={formData.visitor_gender}
                                    onChange={handleInputChange}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 focus:border-brand-500 focus:bg-white transition-all outline-none appearance-none"
                                >
                                    <option>Male</option>
                                    <option>Female</option>
                                    <option>Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Identification Type</label>
                            <div className="relative group">
                                <select
                                    name="id_type"
                                    value={formData.id_type}
                                    onChange={handleInputChange}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:border-brand-500 focus:bg-white transition-all outline-none appearance-none"
                                >
                                    <option>Aadhaar</option>
                                    <option>PAN Card</option>
                                    <option>Passport</option>
                                    <option>Driving License</option>
                                    <option>Other Govt ID</option>
                                </select>
                                <IdCard className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-500 transition-colors" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">ID Number</label>
                            <input
                                type="text"
                                name="id_number"
                                required
                                placeholder="Enter ID number"
                                value={formData.id_number}
                                onChange={handleInputChange}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 focus:border-brand-500 focus:bg-white transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Mobile Number</label>
                            <div className="relative group">
                                <input
                                    type="tel"
                                    name="mobile"
                                    required
                                    placeholder="10-digit mobile"
                                    value={formData.mobile}
                                    onChange={handleInputChange}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:border-brand-500 focus:bg-white transition-all outline-none"
                                />
                                <Smartphone className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-500 transition-colors" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2 group mt-8"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Generating Pass...
                                </>
                            ) : (
                                <>
                                    Generate Visitor Pass
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-slate-400 text-xs mt-12 px-8 font-medium italic">
                    By registering, you agree to comply with the hospital's visitor guidelines and security protocols.
                </p>
            </div>
        </div>
    );
};

export default VisitorRegistrationForm;
