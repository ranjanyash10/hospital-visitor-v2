import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { Lock, Activity, Fingerprint, ShieldCheck, User, Key, Loader2 } from 'lucide-react';
import logo from '../../assets/logo.png';

const GuardLogin = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.post('/auth/login', formData);
            localStorage.setItem('token', data.token);
            localStorage.setItem('userRole', data.role);

            if (data.role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate('/guard');
            }

        } catch (err) {
            setError(err.response?.data?.error || 'Authorization Failed: Protocol mismatch or invalid personnel ID.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="his-shell bg-[#f8fafc] items-center justify-center p-6">
            <div className="absolute inset-0 medical-subgrid opacity-10 pointer-events-none" />

            <div className="w-full max-w-md animate-fade relative z-10">
                <div className="text-center mb-10 flex flex-col items-center">
                    <img src={logo} alt="Action Care Hospital" className="w-20 h-20 object-contain drop-shadow-xl mb-6" />
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-outfit">Personnel Gateway</h1>
                    <p className="text-[10px] font-bold text-brand-500 tracking-widest mt-2 uppercase opacity-70">Institutional Domain Authorization</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden ring-1 ring-slate-200/50">
                    <div className="bg-[#1e293b] px-8 py-4 flex justify-between items-center text-white">
                        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-3">
                            <ShieldCheck size={16} className="text-brand-400" /> Security Terminal G-01
                        </span>
                        <Fingerprint size={18} className="text-white/20" />
                    </div>

                    <div className="p-6 md:p-10 space-y-6 md:space-y-8">
                        {error && (
                            <div className="p-3 md:p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl text-[10px] md:text-xs font-semibold text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                            <div className="space-y-1.5 md:space-y-2">
                                <label className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Access Identifier</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 md:px-5 md:py-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-500 outline-none transition-all text-sm md:text-base font-semibold placeholder:text-slate-300"
                                        placeholder="Personnel ID"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    />
                                    <User className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                </div>
                            </div>
                            <div className="space-y-1.5 md:space-y-2">
                                <label className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Security Keyphrase</label>
                                <div className="relative group">
                                    <input
                                        type="password"
                                        required
                                        className="w-full px-4 py-3 md:px-5 md:py-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-500 outline-none transition-all text-sm md:text-base font-semibold placeholder:text-slate-300"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                    <Key className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                </div>
                            </div>

                            <div className="pt-2 md:pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 md:py-4 bg-brand-500 text-white rounded-xl font-bold text-[11px] md:text-sm uppercase tracking-wider hover:bg-brand-600 shadow-lg shadow-brand-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    {loading ? <Loader2 size={20} className="animate-spin md:w-6 md:h-6" /> : 'Authorize Protocol'}
                                </button>
                            </div>
                            <div className="pt-2">
                                <button
                                    onClick={() => navigate('/walkin')}
                                    type="button"
                                    className="w-full py-3.5 bg-white border-2 border-slate-200 text-slate-500 rounded-xl font-bold text-[11px] md:text-xs uppercase tracking-[0.2em] hover:bg-slate-50 hover:border-brand-200 hover:text-brand-500 transition-all flex items-center justify-center gap-3 active:scale-95"
                                >
                                    Enter Walk-In Kiosk
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="bg-slate-50 px-6 md:px-10 py-4 md:py-5 border-t border-slate-100 text-center">
                        <span className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">
                            Institutional Terminal • V_2.3
                        </span>
                    </div>
                </div>

                <div className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-center gap-6 opacity-30">
                    <span>IP_AUTH</span>
                    <span>•</span>
                    <span>SSL_CORE</span>
                    <span>•</span>
                    <span>V_2.3</span>
                </div>
            </div>
        </div>
    );
};

export default GuardLogin;
