import React, { useEffect, useState } from 'react';
import api from '../../api';
import { LayoutDashboard, Users, RefreshCw, BarChart2, Shield, ShieldCheck, Settings, LogOut, Search, Layers, Activity, FileText, ChevronRight, Filter, Download, Database, Network, Server, Monitor, ShieldAlert, Clock, History, UserCheck, Pencil, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ChartsTab from './ChartsTab';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ activeSlips: 0, todaySlips: 0 });
    const [slips, setSlips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, pages: 1, total: 0 });
    const [filters, setFilters] = useState({ date: '', ward_type: '', status: '', sortBy: 'createdAt', order: 'DESC' });
    const [activeView, setActiveView] = useState('registry'); // registry, charts, human, topology, audit, settings
    const [guards, setGuards] = useState([]);
    const [audits, setAudits] = useState([]);
    const [topology, setTopology] = useState([]);
    const [settings, setSettings] = useState([]);
    const [lockdown, setLockdown] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [patients, setPatients] = useState([]);
    const [editingPatient, setEditingPatient] = useState(null);
    const [editValue, setEditValue] = useState(1);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Stats (Always fetch for KPIs)
            const statsRes = await api.get('/admin/dashboard');
            setStats(statsRes.data);
            setLockdown(statsRes.data.lockdown);

            if (activeView === 'registry') {
                const slipsRes = await api.get('/admin/slips', {
                    params: {
                        page: pagination.page,
                        limit: pagination.limit,
                        archive: filters.status === 'ARCHIVED' ? 'true' : 'false',
                        ...filters
                    }
                });
                setSlips(slipsRes.data.slips);
                setPagination(slipsRes.data.pagination);
            } else if (activeView === 'human') {
                const res = await api.get('/admin/guards');
                setGuards(res.data);
            } else if (activeView === 'topology') {
                const res = await api.get('/admin/topology');
                setTopology(res.data);
            } else if (activeView === 'audit') {
                const res = await api.get('/admin/audits', { params: { page: pagination.page } });
                setAudits(res.data.audits);
                setPagination(prev => ({ ...prev, total: res.data.total, pages: Math.ceil(res.data.total / 20) }));
            } else if (activeView === 'settings') {
                const res = await api.get('/admin/settings');
                setSettings(res.data);
                const ld = res.data.find(s => s.key === 'SYSTEM_LOCKDOWN');
                setLockdown(ld?.value === 'TRUE');
            } else if (activeView === 'patients') {
                const res = await api.get('/admin/patients');
                setPatients(res.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => {
            if (activeView === 'registry') fetchData();
        }, 30000);
        return () => clearInterval(interval);
    }, [pagination.page, pagination.limit, filters, activeView]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const revokeSlip = async (id) => {
        if (!window.confirm('Registry Revocation: Are you sure you want to terminate this visitor record?')) return;
        try {
            await api.post('/admin/revoke', { id });
            fetchData();
        } catch (error) {
            alert('Operation failure: Terminal rejected revocation handshake.');
        }
    };

    const toggleEmergency = async () => {
        const msg = lockdown
            ? "RECOVERY PROTOCOL: Are you sure you want to terminate the security lockdown and resume normal operations?"
            : "EMERGENCY PROTOCOL: Initiating institutional lockdown will freeze all registry entries. Continue?";
        if (!window.confirm(msg)) return;

        try {
            const res = await api.post('/admin/emergency/lockdown');
            setLockdown(res.data.lockdown);
            fetchData();
        } catch (error) {
            alert('Protocol Failure: Secure tunnel rejected lockdown command.');
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/guard/login');
    };

    const renderRegistry = () => (
        <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all border-l-4 border-l-blue-600">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Registry Occupancy</p>
                        <Users size={24} className="text-blue-600 opacity-20" />
                    </div>
                    <div className="flex items-end justify-between">
                        <h3 className="text-5xl font-bold text-slate-900 font-outfit leading-none">{stats.activeSlips}</h3>
                        <span className="text-blue-600 font-semibold text-[11px] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100 italic">Live Permits</span>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all border-l-4 border-l-emerald-500">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Historical Throughput</p>
                        <History size={24} className="text-emerald-500 opacity-20" />
                    </div>
                    <div className="flex items-end justify-between">
                        <h3 className="text-5xl font-bold text-slate-900 font-outfit leading-none">{stats.todaySlips}</h3>
                        <span className="text-emerald-500 font-semibold text-[11px] uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 italic">Total Today</span>
                    </div>
                </div>

                <div className={`${lockdown ? 'bg-red-600' : 'bg-[#0f172a]'} rounded-2xl p-8 flex flex-col justify-between text-white shadow-lg overflow-hidden relative group transition-colors duration-500`}>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <p className="text-[13px] font-bold text-blue-400 uppercase tracking-wider">{lockdown ? 'Institutional Lockdown' : 'Operational State'}</p>
                            <div className={`w-2 h-2 ${lockdown ? 'bg-white' : 'bg-blue-500'} rounded-full animate-pulse shadow-[0_0_10px_currentColor]`} />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-2xl font-bold font-outfit uppercase tracking-tight">Status: {lockdown ? 'SECURE_FREEZE' : 'Normal'}</h3>
                            <button onClick={toggleEmergency} className={`w-full py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${lockdown ? 'bg-white text-red-600' : 'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600 hover:text-white'}`}>
                                {lockdown ? 'Terminate Lockdown' : 'Initiate Lockdown'}
                            </button>
                        </div>
                    </div>
                    <ShieldAlert size={160} className="absolute -bottom-10 -right-10 opacity-5 group-hover:scale-110 transition-transform" />
                </div>
            </div>

            {/* Record Index Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 md:px-8 py-4 md:py-6 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center bg-slate-50/50 gap-4">
                    <div className="flex items-center gap-3 self-start">
                        <h4 className="text-base md:text-lg font-bold text-slate-800 font-outfit uppercase tracking-tight">Visitor Ledger</h4>
                        <span className={`px-2 md:px-3 py-1 ${lockdown ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'} text-[9px] md:text-[10px] font-bold rounded-md uppercase border italic`}>
                            {lockdown ? 'Locked' : 'Live Stream'}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-4 items-center w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 md:px-3 text-slate-400 flex-1 sm:flex-none">
                            <Filter size={14} />
                            <select name="status" value={filters.status} onChange={handleFilterChange} className="h-9 md:h-10 bg-transparent text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-600 outline-none w-full">
                                <option value="">Active</option>
                                <option value="ARCHIVED">History</option>
                            </select>
                        </div>
                        <input type="date" name="date" value={filters.date} onChange={handleFilterChange} className="h-9 md:h-10 px-2 md:px-4 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-600 focus:border-blue-600 outline-none transition-all shadow-sm flex-1 sm:flex-none" />
                        <select name="ward_type" value={filters.ward_type} onChange={handleFilterChange} className="h-9 md:h-10 px-2 md:px-4 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-600 focus:border-blue-600 outline-none transition-all shadow-sm flex-1 sm:flex-none">
                            <option value="">Wards</option>
                            <option value="GENERAL">General</option>
                            <option value="PRIVATE">Private</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Access Token</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Visitor</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Patient & Location</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {slips.map((slip) => (
                                <tr key={slip.id} className="group hover:bg-slate-50/50 transition-all">
                                    <td className="px-6 md:px-8 py-4 md:py-6 whitespace-nowrap">
                                        <div className="font-mono font-bold text-blue-700 text-[13px] md:text-[15px] tracking-widest uppercase">{slip.slip_token}</div>
                                        <div className="text-[10px] md:text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-tight">{format(new Date(slip.createdAt), 'HH:mm • dd MMM')}</div>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 whitespace-nowrap">
                                        <div className="font-semibold text-slate-800 text-[13px] md:text-[15px] uppercase">{slip.Relative?.name || 'GUEST'}</div>
                                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                                            <ShieldCheck size={10} /> Verified
                                        </div>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 whitespace-nowrap">
                                        <div className="font-medium text-slate-700 text-[13px] md:text-[15px] mb-1 uppercase tracking-tighter">{slip.Patient?.full_name}</div>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] md:text-[11px] font-bold rounded uppercase border border-blue-100">{slip.ward_type}</span>
                                            {slip.Patient?.Admissions?.[0] && (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] md:text-[11px] font-bold rounded uppercase border border-slate-200">
                                                    R_{slip.Patient.Admissions[0].room_number}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 whitespace-nowrap">
                                        <div className="flex flex-col gap-1.5">
                                            <span className={`px-2 py-0.5 w-fit rounded text-[9px] md:text-[11px] font-black uppercase tracking-widest border
                                                ${slip.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    slip.status === 'EXPIRED' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                        slip.status === 'REVOKED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                            'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                {slip.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 text-right whitespace-nowrap">
                                        {slip.status === 'ACTIVE' ? (
                                            <button onClick={() => revokeSlip(slip.id)} className="px-3 md:px-4 py-1.5 md:py-2 bg-red-600 text-white rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-wider hover:bg-red-700 transition-all shadow-md active:scale-95">
                                                Revoke
                                            </button>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1.5 text-slate-300">
                                                <Database size={12} />
                                                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Archive</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 md:px-8 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <span className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest">{pagination.total} Records Online</span>
                    <div className="flex items-center gap-2">
                        <button disabled={pagination.page <= 1} onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50 disabled:opacity-30">Prev</button>
                        <div className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold font-mono">{pagination.page}/{pagination.pages}</div>
                        <button disabled={pagination.page >= pagination.pages} onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50 disabled:opacity-30">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderHumanAssets = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 md:px-8 py-4 md:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h4 className="text-base md:text-lg font-bold text-slate-800 font-outfit uppercase tracking-tight">Hospital Staff</h4>
                </div>
                <div className="p-4 md:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {guards.map(guard => (
                        <div key={guard.id} className="p-4 md:p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4 hover:border-blue-300 transition-all group cursor-pointer hover:shadow-md">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-blue-600 transition-colors">
                                <Shield size={20} className="md:w-6 md:h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 text-sm md:text-[16px] uppercase tracking-tight truncate">{guard.username}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] md:text-[13px] font-black rounded uppercase border border-blue-100 tracking-widest">
                                        {guard.role || 'Guard'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderTopology = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm p-4 md:p-10 min-h-[500px] md:min-h-[600px] relative overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
                <div className="flex justify-between items-center mb-6 md:mb-10">
                    <div className="flex items-center gap-4">
                        <Layers className="text-blue-600" />
                        <h4 className="text-xl font-bold text-slate-800 font-outfit uppercase tracking-tight">Patient Bed History</h4>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {topology.map(adm => {
                        const latestSlip = adm.Patient?.VisitorSlips?.[0];
                        const isActive = latestSlip?.status === 'ACTIVE';

                        return (
                            <div key={adm.id} className={`p-6 bg-white border rounded-2xl relative group transition-all shadow-sm ${isActive ? 'border-blue-200 bg-blue-50/20' : 'border-slate-100'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="text-[13px] font-bold text-slate-400 uppercase tabular-nums tracking-widest font-mono">RM_{adm.room_number}_BD_{adm.bed_number}</div>
                                    <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-slate-200'}`} />
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-1">In-Patient</p>
                                        <div className="font-black text-slate-800 text-[16px] uppercase tracking-tight">
                                            {adm.Patient?.full_name || 'NODE_EMPTY'}
                                        </div>
                                    </div>

                                    {adm.Patient && (
                                        <div className="pt-4 border-t border-slate-100">
                                            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-2">Registry Activity</p>
                                            {latestSlip ? (
                                                <div className="space-y-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[16px] font-bold text-slate-700 uppercase">{latestSlip.Relative?.name}</span>
                                                        <span className="text-[13px] font-medium text-slate-500 font-mono tracking-tighter">{latestSlip.Relative?.mobile_number}</span>
                                                    </div>
                                                    <div className={`text-[12px] font-black px-2.5 py-1 rounded w-fit uppercase ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                                        {isActive ? 'Visit: Active' : `Expired: ${latestSlip.status}`}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-[12px] font-bold text-slate-300 uppercase italic">No Historical Data</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderAuditLog = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <Activity className="text-amber-500" />
                        <h4 className="text-2xl font-normal text-slate-800 font-outfit uppercase tracking-tight">Security History</h4>
                    </div>
                    <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl">
                        <Download size={14} /> Export Forensic Dump
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr className="text-left text-[16px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <th className="px-8 py-5">T-Minus Time</th>
                                <th className="px-8 py-5">Originator Node</th>
                                <th className="px-8 py-5">Signal Type</th>
                                <th className="px-8 py-5">Diagnostic Detail</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-mono">
                            {audits.map(audit => (
                                <tr key={audit.id} className="text-[16px] group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-5 text-slate-400 font-bold">{format(new Date(audit.createdAt), 'HH:mm:ss.SSS')}</td>
                                    <td className="px-8 py-5 font-black text-slate-700 uppercase tracking-tighter">{audit.User?.username || 'ROOT_SERVER'}</td>
                                    <td className="px-8 py-5">
                                        <span className={`px-3 py-1.5 rounded font-black text-[12px]
                                            ${audit.action.includes('DENIED') || audit.action.includes('LOCKDOWN')
                                                ? 'bg-red-600 text-white'
                                                : 'bg-slate-900 text-slate-300'}`}>
                                            {audit.action}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-slate-500 italic text-[16px] font-medium font-sans">"{audit.details}"</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderSettings = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm">
                    <h4 className="text-xl font-bold text-slate-800 font-outfit mb-8 uppercase tracking-tight">Network Handshakes</h4>
                    <div className="space-y-6">
                        {settings.map(s => (
                            <div key={s.key} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center group hover:border-blue-400 transition-all cursor-pointer">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.key}</div>
                                    <div className="text-sm font-black text-slate-800 uppercase tabular-nums">{s.value}</div>
                                </div>
                                <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-blue-600 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                    <Settings size={18} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-[#0f172a] rounded-3xl p-12 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between border border-white/5">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <Server size={24} />
                            </div>
                            <h4 className="text-2xl font-black font-outfit uppercase tracking-tight">Vault Encryption Node</h4>
                        </div>
                        <div className="bg-[#1e293b] p-8 rounded-[2rem] border border-white/5">
                            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-3">
                                <Database size={16} className="text-blue-400" />
                                Cryptographic Ledger Status
                            </h3>
                            <p className="text-slate-400 text-[11px] leading-relaxed font-medium italic">
                                Action Care HIS maintains a zero-trust encrypted cryptographic link with the Global Patients Vault. All session keys are automatically rotated via hardware HSM every 12 hours.
                            </p>
                        </div>
                        <div className="space-y-6 pt-6 border-t border-white/10">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
                                <span className="text-slate-500">Cipher Protocol</span>
                                <span className="text-blue-400 font-mono">AES-256-GCM-HKDF</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
                                <span className="text-slate-500">Synchronization Node</span>
                                <span className="font-mono text-emerald-400">VAULT-ALPHA-NODE-01</span>
                            </div>
                        </div>
                    </div>
                    <Database size={200} className="absolute -bottom-16 -right-16 opacity-[0.03] group-hover:scale-110 transition-transform" />
                </div>
            </div>
        </div>
    );

    const [editDuration, setEditDuration] = useState(1);

    const saveMaxVisitors = async (admissionId) => {
        try {
            await api.patch(`/admin/admissions/${admissionId}/max-visitors`, {
                max_visitors: editValue,
                visit_duration_hours: editDuration
            });
            setEditingPatient(null);
            fetchData();
        } catch (error) {
            console.error('Update failed:', error);
            const status = error.response?.status;
            const message = error.response?.data?.error || error.message || 'Unknown error';
            alert(`Update Failed [${status || 'Network Error'}]: ${message}`);
        }
    };

    const renderPatients = () => (
        <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 md:px-8 py-4 md:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <UserCheck className="text-indigo-600" size={20} />
                        <h4 className="text-base md:text-lg font-bold text-slate-800 font-outfit uppercase tracking-tight">Patient Visitor Quotas</h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{patients.length} Active Admissions</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Patient</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Location</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Ward</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Active</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Max Visitors</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Visit Duration</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {patients.map((p) => (
                                <tr key={p.admission_id} className="group hover:bg-slate-50/50 transition-all">
                                    <td className="px-6 md:px-8 py-4 md:py-5 whitespace-nowrap">
                                        <div className="font-bold text-slate-800 text-[13px] md:text-[15px] uppercase tracking-tight">{p.patient_name}</div>
                                        <div className="text-[10px] md:text-[11px] font-medium text-slate-400 mt-0.5 font-mono">{p.uhid}</div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 whitespace-nowrap">
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] md:text-[11px] font-bold rounded uppercase border border-blue-100">R-{p.room_number}</span>
                                        <span className="ml-1.5 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] md:text-[11px] font-bold rounded uppercase border border-slate-200">B-{p.bed_number}</span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded text-[10px] md:text-[11px] font-black uppercase tracking-widest border ${p.ward_type === 'PRIVATE' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {p.ward_type}
                                        </span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-lg font-bold tabular-nums ${p.active_visitors > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{p.active_visitors}</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">/ {p.max_visitors}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 whitespace-nowrap">
                                        {editingPatient === p.admission_id ? (
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={editValue}
                                                onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setEditValue(v === '' ? '' : parseInt(v)); }}
                                                className="w-14 h-8 px-2 bg-white border-2 border-indigo-400 rounded-lg text-sm font-bold text-center text-slate-800 outline-none focus:border-indigo-600 transition-colors"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="text-lg font-bold text-slate-800 tabular-nums">{p.max_visitors}</span>
                                        )}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 whitespace-nowrap">
                                        {editingPatient === p.admission_id ? (
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={editDuration}
                                                    onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); setEditDuration(v === '' ? '' : parseFloat(v)); }}
                                                    className="w-14 h-8 px-2 bg-white border-2 border-amber-400 rounded-lg text-sm font-bold text-center text-slate-800 outline-none focus:border-amber-600 transition-colors"
                                                />
                                                <span className="text-[10px] font-bold text-slate-400">hrs</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-lg font-bold text-slate-800 tabular-nums">{p.visit_duration_hours}</span>
                                                <span className="text-[10px] font-bold text-slate-400">hrs</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 text-right whitespace-nowrap">
                                        {editingPatient === p.admission_id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => saveMaxVisitors(p.admission_id)} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all active:scale-95">
                                                    <Check size={14} />
                                                </button>
                                                <button onClick={() => setEditingPatient(null)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all active:scale-95">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setEditingPatient(p.admission_id); setEditValue(p.max_visitors); setEditDuration(p.visit_duration_hours); }} className="px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 text-white rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-1.5 ml-auto">
                                                <Pencil size={12} /> Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    return (
        <div className="his-shell flex-col lg:flex-row bg-[#f8fafc]">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Professional Enterprise Sidebar */}
            <aside className={`fixed inset-y-0 left-0 w-72 bg-[#1e293b] flex flex-col z-[70] text-white shadow-xl lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out border-r border-white/5 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 md:p-8 border-b border-white/5 bg-[#0f172a] flex flex-col items-center">
                    <div className="group relative">
                        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl border-2 border-white/10 group-hover:scale-105 transition-transform duration-500">
                            <ShieldCheck size={28} />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0f172a] animate-pulse" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-black font-outfit tracking-tight text-white uppercase tracking-[0.2em]">Action Care HIS</h1>
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mt-1.5 opacity-80">Command Station</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 mt-6 space-y-2">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-4 py-4 mb-2">Live Node Intelligence</div>
                    <button onClick={() => { setActiveView('registry'); setPagination(p => ({ ...p, page: 1 })); setIsSidebarOpen(false); }} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'registry' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <LayoutDashboard size={16} /> Visitor Dashboard
                    </button>

                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-4 py-8 mb-2">Facility Overlook</div>
                    <button onClick={() => setActiveView('human')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'human' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <Users size={16} /> Hospital Staff
                    </button>
                    <button onClick={() => setActiveView('topology')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'topology' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <Layers size={16} /> Patient Bed History
                    </button>
                    <button onClick={() => setActiveView('charts')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'charts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <BarChart2 size={16} /> Analytical Intelligence
                    </button>
                    <button onClick={() => setActiveView('patients')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'patients' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <UserCheck size={16} /> Visitor Quotas
                    </button>

                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-4 py-8 mb-2">System Core</div>
                    <button onClick={() => setActiveView('audit')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'audit' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <ShieldAlert size={16} /> Security History
                    </button>
                </nav>

                <div className="p-6 border-t border-white/5">
                    <button onClick={logout} className="w-full py-4 flex items-center justify-center gap-3 bg-red-600/10 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-red-600 hover:text-white transition-all border border-red-500/20 active:scale-95 shadow-xl shadow-red-900/10">
                        <LogOut size={16} /> Kill Session
                    </button>
                </div>
            </aside>

            {/* Application Main Surface */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <div className="absolute inset-0 medical-subgrid opacity-[0.03] pointer-events-none" />

                {/* Dashboard Header Layer */}
                <header className="px-6 py-4 md:px-10 md:py-8 flex justify-between items-center bg-white border-b border-slate-200 z-40 relative shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 lg:hidden text-slate-600 hover:bg-slate-50 rounded-lg"
                        >
                            <LayoutDashboard size={24} />
                        </button>
                        <div>
                            <h2 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.4em]">Security Node</h2>
                            <div className="flex items-center gap-2 mt-1 md:mt-2">
                                <div className={`w-1.5 h-1.5 md:w-2 md:h-2 ${lockdown ? 'bg-red-500 animate-ping' : 'bg-emerald-500 animate-pulse'} rounded-full shadow-[0_0_8px_currentColor]`} />
                                <p className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest tabular-nums">
                                    {activeView === 'registry' ? 'VISITOR: STREAM' : `NODE: ${activeView.toUpperCase()}`}
                                </p>
                            </div>
                        </div>
                    </div>
                    {lockdown && (
                        <button
                            onClick={toggleEmergency}
                            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-600 text-white text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] rounded-full animate-pulse shadow-2xl z-50 flex items-center gap-3 lg:static lg:bottom-auto lg:left-auto lg:translate-x-0"
                        >
                            <ShieldAlert size={14} />
                            <span className="hidden sm:inline">Terminate Lockdown Protocol</span>
                            <span className="sm:hidden">OFF Lockdown</span>
                        </button>
                    )}
                    <div className="flex gap-2">
                        <button onClick={fetchData} className="w-10 h-10 md:w-12 md:h-12 bg-white border border-slate-200 text-slate-600 rounded-xl md:rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center shadow-sm active:scale-95">
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>

                {/* Main Data Viewport */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 relative z-10">
                    <div className="max-w-[1750px] mx-auto pb-10">
                        {activeView === 'registry' && renderRegistry()}
                        {activeView === 'human' && renderHumanAssets()}
                        {activeView === 'topology' && renderTopology()}
                        {activeView === 'audit' && renderAuditLog()}
                        {activeView === 'charts' && <ChartsTab />}
                        {activeView === 'patients' && renderPatients()}
                        {activeView === 'settings' && renderSettings()}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
