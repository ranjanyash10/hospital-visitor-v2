import React, { useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { Printer, CheckCircle, Home, ShieldCheck, MapPin, Activity, Clock, LogOut, ChevronLeft, Database, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import logo from '../../assets/logo.png';

const KioskStep3 = () => {
    const { state } = useLocation();
    const navigate = useNavigate();

    if (!state?.slip) {
        return (
            <div className="his-shell items-center justify-center p-12 bg-[#f8fafc]">
                <div className="medical-subgrid absolute inset-0 opacity-20" />
                <Link to="/" className="his-btn-impact px-20 relative z-10">Return to Terminal Home</Link>
            </div>
        );
    }

    const { slip, patientName, relativeName } = state;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="his-shell bg-[#f8fafc] flex-col h-screen overflow-hidden">
            {/* Background Medical Mesh */}
            <div className="absolute inset-0 medical-subgrid opacity-20 pointer-events-none no-print" />

            {/* Success Phase Header */}
            <header className="sticky top-0 px-6 py-4 md:px-12 md:py-6 flex flex-col md:flex-row justify-between items-center z-50 border-b border-slate-100 bg-white/50 backdrop-blur-md gap-4 no-print">
                <div className="flex items-center gap-5">
                    <img src={logo} alt="Action Care" className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-contain bg-white shadow-xl shadow-emerald-500/20" />
                    <div>
                        <h2 className="text-base md:text-lg font-black text-slate-900 font-outfit uppercase tracking-tighter leading-none">Access Authorized</h2>
                        <p className="text-[8px] md:text-[9px] font-black text-emerald-600 mt-1.5 uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-80">Registry Clearance Phase 03/03</p>
                    </div>
                </div>
                <div className="flex items-center">
                    <div className="px-3 py-1 md:px-4 md:py-1.5 rounded-lg bg-slate-900 text-white text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                        ID: {slip.slip_token}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative z-10">
                {/* Protocol Insight Drawer */}
                <div className="hidden lg:flex w-80 bg-[#0f172a] text-white p-10 flex-col justify-center sticky top-0 h-full no-print">
                    <div className="mb-10">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                            <ShieldCheck size={24} className="text-emerald-400" />
                        </div>
                        <h3 className="text-2xl font-black font-outfit tracking-tighter mb-4 leading-tight">Registry <br /> Confirmed</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">Your visitation credentials have been successfully authenticated and synchronized with the facility security gateway.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="w-5 h-5 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-[9px] font-black shrink-0">✔</div>
                            <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider leading-relaxed">Access Granted. Proceed to designated Ward.</p>
                        </div>
                    </div>

                    <div className="mt-auto pt-10 border-t border-white/5 flex items-center gap-4 text-slate-500">
                        <Database size={14} />
                        <span className="text-[9px] font-black uppercase tracking-[0.4em]">Node_Confirmed: AUTH_OK</span>
                    </div>
                </div>

                {/* Main Interaction Console */}
                <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-10">
                    <div className="w-full max-w-5xl bg-white his-premium-card flex flex-col max-h-[92vh] shadow-[0_40px_80px_rgba(0,0,0,0.06)] overflow-hidden print-parent">

                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                            {/* Left: Instructions */}
                            <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto border-b lg:border-r border-slate-50 no-print">
                                <h1 className="text-2xl md:text-4xl font-black text-slate-900 font-outfit tracking-tighter leading-tight mb-8 md:mb-10 uppercase text-center lg:text-left">Access Protocol</h1>

                                <div className="space-y-6 md:space-y-10">
                                    <div className="flex gap-4 md:gap-8">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 text-white rounded-[1rem] flex items-center justify-center text-sm md:text-base font-black shrink-0">01</div>
                                        <div>
                                            <p className="text-slate-900 font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] mb-1">Step 01: Physical Print</p>
                                            <p className="text-slate-500 text-xs md:text-sm font-medium leading-relaxed italic">Print and carry your physical permit at all times during your stay.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 md:gap-8">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 text-white rounded-[1rem] flex items-center justify-center text-sm md:text-base font-black shrink-0">02</div>
                                        <div>
                                            <p className="text-slate-900 font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] mb-1">Step 02: Handshake</p>
                                            <p className="text-slate-500 text-xs md:text-sm font-medium leading-relaxed italic">Present the QR code to security personnel at the Ward entrance.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Metro Slip Preview - SCROLLABLE */}
                            <div className="flex-1 lg:w-[400px] lg:flex-none bg-slate-50 flex flex-col overflow-y-auto shrink-0 no-print-bg">
                                <div className="p-6 md:p-10 flex-1 flex flex-col items-center print-preview-container">
                                    <div id="print-area" className="w-full max-w-[320px] bg-white shadow-2xl relative overflow-hidden flex flex-col rounded-sm border-t-8 border-slate-900 shrink-0">
                                        {/* Medical Branding */}
                                        <div className="p-8 border-b border-dashed border-slate-200 text-center">
                                            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white mx-auto mb-3">
                                                <Activity size={22} />
                                            </div>
                                            <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-900">Action Care Hospital</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry Permit</p>
                                        </div>

                                        <div className="p-10 space-y-10">
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 italic leading-none">Authorized Visitor</p>
                                                <p className="text-2xl font-black text-slate-800 font-outfit uppercase tracking-tighter leading-tight">{relativeName}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-6">
                                                <div className="text-center border-r border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 italic leading-none">Zone</p>
                                                    <p className="text-sm font-black text-brand-500 font-outfit uppercase leading-none">{slip.ward_type}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 italic leading-none">Timestamp</p>
                                                    <p className="text-sm font-black text-slate-800 font-outfit uppercase leading-tight font-mono">
                                                        {format(new Date(), 'HH:mm')}<br />
                                                        <span className="text-[9px] text-slate-400 font-outfit">{format(new Date(), 'dd/MM/yyyy')}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 italic leading-none">Inpatient Association</p>
                                                <p className="text-sm font-black text-slate-600 font-outfit uppercase whitespace-nowrap overflow-hidden text-ellipsis leading-none">{patientName}</p>
                                            </div>

                                            <div className="flex justify-center py-4">
                                                <div className="p-4 bg-white border-2 border-slate-900 rounded-[2rem] shadow-xl">
                                                    <QRCode value={slip.slip_token} size={160} level="M" fgColor="#0F172A" />
                                                </div>
                                            </div>

                                            <div className="text-center pt-8 border-t border-dashed border-slate-100">
                                                <p className="text-xs font-black text-slate-900 font-mono tracking-widest uppercase">{slip.slip_token}</p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3 italic leading-relaxed">
                                                    {slip.valid_until
                                                        ? `EXP: ${format(new Date(slip.valid_until), 'HH:mm')} | ${format(new Date(slip.valid_until), 'dd/MM/yyyy')}`
                                                        : 'Timer activates on QR scan at gate'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Bottom Stripe */}
                                        <div className="h-6 bg-slate-900 mt-2" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fixed Actions Footer */}
                        <div className="p-6 md:p-8 lg:p-10 border-t border-slate-50 bg-slate-50/30 no-print">
                            <div className="flex flex-col gap-4 md:gap-6">
                                <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                                    <button
                                        onClick={handlePrint}
                                        className="relative flex-[2.5] bg-slate-900 hover:bg-black text-white py-4 md:py-6 text-lg md:text-xl font-black font-outfit uppercase tracking-widest rounded-2xl md:rounded-[2rem] transition-all duration-500 shadow-2xl active:scale-95 flex items-center justify-center gap-4 md:gap-6 group overflow-hidden"
                                    >
                                        <span className="relative z-10 text-sm md:text-lg">Generate Print</span>
                                        <Printer size={24} className="relative z-10 group-hover:scale-110 transition-transform duration-500 md:w-8 md:h-8" />
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    </button>

                                    <button
                                        onClick={() => navigate('/')}
                                        className="relative flex-1 bg-white border-2 border-slate-100 hover:border-slate-300 text-slate-400 hover:text-slate-900 py-4 md:py-6 text-base md:text-xl font-black font-outfit uppercase tracking-widest rounded-2xl md:rounded-[2rem] transition-all duration-500 active:scale-95 flex items-center justify-center gap-4 group overflow-hidden"
                                    >
                                        <Home size={24} className="md:w-8 md:h-8" />
                                    </button>
                                </div>

                                <div className="flex justify-center">
                                    <div className="flex items-center gap-3 px-6 py-2 bg-white rounded-full border border-slate-100 shadow-sm">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Registry Handshake Secure</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <footer className="relative bg-white border-t border-slate-100 z-50 py-4 px-6 md:px-12 flex justify-center items-center no-print">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.5em] text-slate-300 italic text-center leading-normal">Protocol: ACTION-FINAL • Audit Sequence Recorded.</span>
            </footer>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        margin: 0; 
                        size: portrait;
                    }
                    /* Aggressive display-none for UI substrates */
                    .no-print, header, footer, .lg\\:flex.w-80, .flex-1.p-10.lg\\:p-12 { 
                        display: none !important; 
                    }
                    
                    /* Clean the background for the slip container */
                    .no-print-bg {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        display: block !important;
                        width: 100% !important;
                    }
                    
                    body, .his-shell, main {
                        background: white !important;
                        height: auto !important;
                        display: block !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    
                    .his-premium-card, .print-parent, .flex-1.flex.overflow-hidden {
                        box-shadow: none !important;
                        border: none !important;
                        max-width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .print-preview-container {
                        display: block !important;
                        width: 100% !important;
                        padding-top: 40px !important;
                    }

                    #print-area {
                        position: relative !important;
                        margin: 0 auto !important;
                        width: 320px !important;
                        box-shadow: none !important;
                        border: 1px dashed #ccc !important;
                        visibility: visible !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                }
            `}} />
        </div>
    );
};

export default KioskStep3;
