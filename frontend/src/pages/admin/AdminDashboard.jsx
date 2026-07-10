import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../../api';
import { LayoutDashboard, Users, RefreshCw, BarChart2, Shield, ShieldCheck, Settings, LogOut, Search, Layers, Activity, FileText, ChevronRight, Filter, Download, Database, Network, Server, Monitor, ShieldAlert, Clock, History, UserCheck, Pencil, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ChartsTab from './ChartsTab';
import logo from '../../assets/logo.png';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ activeSlips: 0, todaySlips: 0 });
    const [slips, setSlips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, pages: 1, total: 0 });
    const [filters, setFilters] = useState({ date: '', ward_type: '', status: '', sortBy: 'createdAt', order: 'DESC' });
    const [activeView, setActiveView] = useState('registry'); // registry, charts, human, topology, audit, settings, account
    const [guards, setGuards] = useState([]);
    const [audits, setAudits] = useState([]);
    const [topology, setTopology] = useState([]);
    const [settings, setSettings] = useState([]);
    const [lockdown, setLockdown] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [patients, setPatients] = useState([]);
    const [editingPatient, setEditingPatient] = useState(null);
    const [editValue, setEditValue] = useState(1);
    const [editContact, setEditContact] = useState({ admission_id: null, name: '', mobile: '' });

    // Patient Quotas pagination & search state
    const [patientPagination, setPatientPagination] = useState({ page: 1, limit: 15, pages: 1, total: 0 });
    const [patientSearch, setPatientSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchTimerRef = useRef(null);

    // Debounce patientSearch → debouncedSearch (300ms)
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearch(patientSearch);
        }, 300);
        return () => clearTimeout(searchTimerRef.current);
    }, [patientSearch]);

    // Account Management State
    const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [accountLoading, setAccountLoading] = useState(false);
    const [accountMsg, setAccountMsg] = useState({ type: '', text: '' });

    // Guard Management State
    const [showCreateGuard, setShowCreateGuard] = useState(false);
    const [newGuard, setNewGuard] = useState({ username: '', password: '' });
    const [editingGuard, setEditingGuard] = useState(null);
    const [editingGuardName, setEditingGuardName] = useState('');
    const [resetGuardId, setResetGuardId] = useState(null);
    const [resetGuardPass, setResetGuardPass] = useState('');

    // V2 Admission Form State
    const [showAdmitForm, setShowAdmitForm] = useState(false);
    const [newAdmission, setNewAdmission] = useState({
        uhid: '', full_name: '', mobile_number: '', relative_name: '',
        ward_type: 'GENERAL', ward_category: 'WARD', room_number: '', bed_number: '',
        max_visitors: 1, visit_duration_hours: 1
    });

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
                const res = await api.get('/admin/patients', {
                    params: {
                        page: patientPagination.page,
                        limit: patientPagination.limit,
                        search: debouncedSearch
                    }
                });
                setPatients(res.data.patients);
                setPatientPagination(prev => ({ ...prev, ...res.data.pagination }));
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
    }, [pagination.page, pagination.limit, filters, activeView, patientPagination.page, debouncedSearch]);

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

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            setAccountMsg({ type: 'error', text: 'Passwords do not match' });
            return;
        }
        setAccountLoading(true);
        setAccountMsg({ type: '', text: '' });
        try {
            await api.post('/admin/update-password', {
                oldPassword: passwords.oldPassword,
                newPassword: passwords.newPassword
            });
            setAccountMsg({ type: 'success', text: 'Password updated successfully' });
            setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            setAccountMsg({ type: 'error', text: error.response?.data?.error || 'Failed to update password' });
        } finally {
            setAccountLoading(false);
        }
    };

    const handleCreateGuard = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/guards', newGuard);
            setShowCreateGuard(false);
            setNewGuard({ username: '', password: '' });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to create guard');
        }
    };

    const handleUpdateGuard = async (id) => {
        try {
            await api.patch(`/admin/guards/${id}`, { username: editingGuardName });
            setEditingGuard(null);
            fetchData();
        } catch (error) {
            alert('Update failed');
        }
    };

    const handleResetGuardPassword = async (id) => {
        try {
            await api.post(`/admin/guards/${id}/reset-password`, { newPassword: resetGuardPass });
            setResetGuardId(null);
            setResetGuardPass('');
            alert('Password reset successfully');
        } catch (error) {
            alert('Reset failed');
        }
    };

    const handleAdmitPatient = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/patients/admit', newAdmission);
            setShowAdmitForm(false);
            setNewAdmission({
                uhid: '', full_name: '', mobile_number: '', relative_name: '',
                ward_type: 'GENERAL', ward_category: 'WARD', room_number: '', bed_number: '',
                max_visitors: 2, visit_duration_hours: 1
            });
            fetchData();
            alert('Patient admitted successfully & WhatsApp notification triggered.');
        } catch (error) {
            alert(error.response?.data?.error || 'Admission failed');
        }
    };

    const renderRegistry = () => (
        <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all border-l-4 border-l-brand-500">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Registry Occupancy</p>
                        <Users size={24} className="text-brand-500 opacity-20" />
                    </div>
                    <div className="flex items-end justify-between">
                        <h3 className="text-5xl font-bold text-slate-900 font-outfit leading-none">{stats.activeSlips}</h3>
                        <span className="text-brand-500 font-semibold text-[11px] uppercase tracking-widest bg-brand-50 px-3 py-1 rounded-full border border-brand-100 italic">Live Permits</span>
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
                            <p className="text-[13px] font-bold text-brand-400 uppercase tracking-wider">{lockdown ? 'Institutional Lockdown' : 'Operational State'}</p>
                            <div className={`w-2 h-2 ${lockdown ? 'bg-white' : 'bg-brand-500'} rounded-full animate-pulse shadow-[0_0_10px_currentColor]`} />
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

            {/* Admin Dashboard Sidebar Toggle (Mobile) */}
            <div className="lg:hidden fixed bottom-6 right-6 z-[60]">
                {/* ... existing code ... */}
            </div>


            {/* Record Index Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 md:px-8 py-4 md:py-6 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center bg-slate-50/50 gap-4">
                    <div className="flex items-center gap-3 self-start">
                        <h4 className="text-base md:text-lg font-bold text-slate-800 font-outfit uppercase tracking-tight">Visitor Ledger</h4>
                        <span className={`px-2 md:px-3 py-1 ${lockdown ? 'bg-red-50 text-red-600 border-red-100' : 'bg-brand-50 text-brand-500 border-brand-100'} text-[9px] md:text-[10px] font-bold rounded-md uppercase border italic`}>
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
                        <input type="date" name="date" value={filters.date} onChange={handleFilterChange} className="h-9 md:h-10 px-2 md:px-4 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-600 focus:border-brand-500 outline-none transition-all shadow-sm flex-1 sm:flex-none" />
                        <select name="ward_type" value={filters.ward_type} onChange={handleFilterChange} className="h-9 md:h-10 px-2 md:px-4 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-600 focus:border-brand-500 outline-none transition-all shadow-sm flex-1 sm:flex-none">
                            <option value="">All Areas</option>
                            <option value="GENERAL">General Ward</option>
                            <option value="PRIVATE">Private Suite</option>
                            <optgroup label="ICU & Critical Care">
                                <option value="MEDICAL_ICU_1_11">Medical ICU 1-11</option>
                                <option value="MEDICAL_ICU_12_23">Medical ICU 12-23</option>
                                <option value="NEURO_ICU">Neuro ICU</option>
                                <option value="SURGICAL_ICU">Surgical ICU</option>
                                <option value="ICU_2">ICU-2</option>
                                <option value="HEART_COMMAND">Heart Command</option>
                                <option value="ICU_3">ICU-3</option>
                                <option value="NEPHRO_ICU">Nephro ICU</option>
                                <option value="NICU">NICU</option>
                            </optgroup>
                            <option value="WARD">Ward / Other</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Access Token</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Visitor</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Patient</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Bed / Room</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Zone / Ward</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {slips.map((slip) => (
                                <tr key={slip.id} className="group hover:bg-slate-50/50 transition-all">
                                    <td className="px-6 md:px-8 py-4 md:py-6 whitespace-nowrap">
                                        <div className="font-mono font-bold text-brand-700 text-[13px] md:text-[15px] tracking-widest uppercase">{slip.slip_token}</div>
                                        <div className="text-[10px] md:text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-tight">{format(new Date(slip.createdAt), 'HH:mm • dd MMM')}</div>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 whitespace-nowrap">
                                        <div className="font-semibold text-slate-800 text-[13px] md:text-[15px] uppercase">{slip.Relative?.name || 'GUEST'}</div>
                                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                                            <ShieldCheck size={10} /> Verified
                                        </div>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 whitespace-nowrap">
                                        <div className="font-bold text-slate-900 text-[14px] md:text-[16px] uppercase tracking-tight">{slip.Patient?.full_name}</div>
                                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{slip.Patient?.uhid}</div>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <div className="font-black text-brand-600 text-[15px] md:text-[18px] leading-none">B_{slip.Patient?.Admissions?.[0]?.bed_number || 'N/A'}</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">RM_{slip.Patient?.Admissions?.[0]?.room_number || '---'}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 md:px-8 py-4 md:py-6 whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[13px] md:text-[15px] font-bold text-slate-800 uppercase tracking-tight">
                                                {slip.ward_category?.replace(/_/g, ' ') || slip.ward_type}
                                            </span>
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded w-fit uppercase border border-slate-200 tracking-tighter">
                                                {slip.ward_type} Unit
                                            </span>
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
                        <div className="px-3 py-1.5 bg-brand-500 text-white rounded-lg text-[10px] font-bold font-mono">{pagination.page}/{pagination.pages}</div>
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
                    <button
                        onClick={() => setShowCreateGuard(true)}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md"
                    >
                        Provision New Guard
                    </button>
                </div>
                <div className="p-4 md:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {guards.map(guard => (
                        <div key={guard.id} className="p-4 md:p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 hover:border-brand-300 transition-all group hover:shadow-md">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-brand-500 transition-colors">
                                    <Shield size={20} className="md:w-6 md:h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    {editingGuard === guard.id ? (
                                        <div className="flex gap-2">
                                            <input
                                                className="bg-white border border-slate-200 rounded px-2 py-1 text-sm w-full font-bold uppercase"
                                                value={editingGuardName}
                                                onChange={(e) => setEditingGuardName(e.target.value)}
                                            />
                                            <button onClick={() => handleUpdateGuard(guard.id)} className="text-emerald-600"><Check size={18} /></button>
                                            <button onClick={() => setEditingGuard(null)} className="text-red-600"><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center">
                                            <div className="font-bold text-slate-800 text-sm md:text-[16px] uppercase tracking-tight truncate">{guard.username}</div>
                                            <button onClick={() => { setEditingGuard(guard.id); setEditingGuardName(guard.username); }} className="text-slate-400 hover:text-brand-500 opacity-0 group-hover:opacity-100 transition-all">
                                                <Pencil size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 bg-brand-50 text-brand-500 text-[10px] md:text-[13px] font-black rounded uppercase border border-brand-100 tracking-widest">
                                            {guard.role || 'Guard'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
                                {resetGuardId === guard.id ? (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="password"
                                            placeholder="Enter New Password"
                                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold"
                                            value={resetGuardPass}
                                            onChange={(e) => setResetGuardPass(e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => handleResetGuardPassword(guard.id)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase">Reset</button>
                                            <button onClick={() => setResetGuardId(null)} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setResetGuardId(guard.id)}
                                        className="w-full py-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all"
                                    >
                                        Reset Password
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create Guard Modal Overlay */}
            {showCreateGuard && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800 font-outfit uppercase">New Guard Personnel</h3>
                            <button onClick={() => setShowCreateGuard(false)} className="text-slate-400 hover:text-red-500">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateGuard} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Username</label>
                                <input
                                    required
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 transition-all font-bold"
                                    value={newGuard.username}
                                    onChange={(e) => setNewGuard({ ...newGuard, username: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initial Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 transition-all font-bold"
                                    value={newGuard.password}
                                    onChange={(e) => setNewGuard({ ...newGuard, password: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-4 bg-brand-600 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-brand-500/20 hover:bg-brand-700 active:scale-95 transition-all"
                            >
                                Secure Enlistment
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    const renderAccountSettings = () => (
        <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-8 md:p-10 border-b border-slate-100 bg-brand-900 text-white relative">
                    <h4 className="text-xl md:text-2xl font-black font-outfit uppercase tracking-tight">Access Control Center</h4>
                    <p className="text-brand-300 text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] mt-2 opacity-80">Credential Rotation Module</p>
                    <ShieldCheck size={120} className="absolute -bottom-6 -right-6 opacity-5 group-hover:scale-110 transition-transform" />
                </div>

                <form onSubmit={handleUpdatePassword} className="p-8 md:p-10 space-y-8">
                    {accountMsg.text && (
                        <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-widest border ${accountMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {accountMsg.text}
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previous Password (MANDATORY)</label>
                            <input
                                type="password"
                                required
                                value={passwords.oldPassword}
                                onChange={(e) => setPasswords({ ...passwords, oldPassword: e.target.value })}
                                className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-500 font-bold transition-all shadow-sm"
                                placeholder="••••••••••••"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Secret Key</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.newPassword}
                                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                                    className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-500 font-bold transition-all shadow-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verify New Key</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.confirmPassword}
                                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                    className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-500 font-bold transition-all shadow-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={accountLoading}
                        className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black text-[13px] uppercase tracking-[0.3em] shadow-xl shadow-brand-500/20 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        {accountLoading ? <RefreshCw className="animate-spin" size={18} /> : (
                            <>
                                <ShieldCheck size={18} />
                                Commit Credential Change
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );

    const renderTopology = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm p-4 md:p-10 min-h-[500px] md:min-h-[600px] relative overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
                <div className="flex justify-between items-center mb-6 md:mb-10">
                    <div className="flex items-center gap-4">
                        <Layers className="text-brand-500" />
                        <h4 className="text-xl font-bold text-slate-800 font-outfit uppercase tracking-tight">Patient Bed History</h4>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {topology.map(adm => {
                        const latestSlip = adm.Patient?.VisitorSlips?.[0];
                        const isActive = latestSlip?.status === 'ACTIVE';

                        return (
                            <div key={adm.id} className={`p-6 bg-white border rounded-2xl relative group transition-all shadow-sm ${isActive ? 'border-brand-200 bg-brand-50/20' : 'border-slate-100'}`}>
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
                                    <td className="px-8 py-5 text-slate-400 font-bold">{format(new Date(audit.createdAt), 'HH:mm:ss.SSS • dd/MM/yyyy')}</td>
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
                            <div key={s.key} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center group hover:border-brand-400 transition-all cursor-pointer">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.key}</div>
                                    <div className="text-sm font-black text-slate-800 uppercase tabular-nums">{s.value}</div>
                                </div>
                                <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-brand-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                    <Settings size={18} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-[#0f172a] rounded-3xl p-12 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between border border-white/5">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                                <Server size={24} />
                            </div>
                            <h4 className="text-2xl font-black font-outfit uppercase tracking-tight">Vault Encryption Node</h4>
                        </div>
                        <div className="bg-[#1e293b] p-8 rounded-[2rem] border border-white/5">
                            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-3">
                                <Database size={16} className="text-brand-400" />
                                Cryptographic Ledger Status
                            </h3>
                            <p className="text-slate-400 text-[11px] leading-relaxed font-medium italic">
                                Sri Balaji Action Medical Institute maintains a zero-trust encrypted cryptographic link with the Global Patients Vault. All session keys are automatically rotated via hardware HSM every 12 hours.
                            </p>
                        </div>
                        <div className="space-y-6 pt-6 border-t border-white/10">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
                                <span className="text-slate-500">Cipher Protocol</span>
                                <span className="text-brand-400 font-mono">AES-256-GCM-HKDF</span>
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

    const saveContactDetails = async (admissionId) => {
        try {
            await api.patch(`/admin/admissions/${admissionId}/contact`, {
                name: editContact.name,
                mobile_number: editContact.mobile
            });
            setEditContact({ admission_id: null, name: '', mobile: '' });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || 'Update failed');
        }
    };

    const renderPatients = () => (
        <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 md:px-8 py-4 md:py-6 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center bg-slate-50/50 gap-4">
                    <div className="flex items-center gap-3 self-start">
                        <UserCheck className="text-indigo-600" size={20} />
                        <h4 className="text-base md:text-lg font-bold text-slate-800 font-outfit uppercase tracking-tight">Patient Visitor Quotas</h4>
                        <span className="px-2 md:px-3 py-1 bg-indigo-50 text-indigo-500 text-[9px] md:text-[10px] font-bold rounded-md uppercase border border-indigo-100 italic">
                            {patientPagination.total} Admissions
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-4 items-center w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 md:px-3 text-slate-400 flex-1 sm:flex-none">
                            <Search size={14} />
                            <input
                                type="text"
                                placeholder="Search UHID or Name..."
                                value={patientSearch}
                                onChange={(e) => {
                                    setPatientSearch(e.target.value);
                                    setPatientPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="h-9 md:h-10 bg-transparent text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-600 outline-none w-full min-w-[160px] placeholder:normal-case placeholder:tracking-normal placeholder:font-medium"
                            />
                            {patientSearch && (
                                <button onClick={() => { setPatientSearch(''); setPatientPagination(prev => ({ ...prev, page: 1 })); }} className="text-slate-300 hover:text-red-500 transition-colors">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowAdmitForm(true)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
                        >
                            <Activity size={14} /> New Admission
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                <th className="px-6 md:px-8 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Patient</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Location</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Visitor Contact</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Active</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Max Visitors</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Duration</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[11px] md:text-[13px] font-semibold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {patients.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-8 py-12 text-center">
                                        <div className="text-slate-300 text-sm font-bold uppercase tracking-widest">
                                            {patientSearch ? `No patients matching "${patientSearch}"` : 'No active admissions'}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {patients.map((p) => (
                                <tr key={p.admission_id} className="group hover:bg-slate-50/50 transition-all">
                                    <td className="px-6 md:px-8 py-4 md:py-5 whitespace-nowrap">
                                        <div className="font-bold text-slate-800 text-[13px] md:text-[15px] uppercase tracking-tight">{p.patient_name}</div>
                                        <div className="text-[10px] md:text-[11px] font-medium text-slate-400 mt-0.5 font-mono">{p.uhid}</div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 whitespace-nowrap">
                                        {p.room_number && p.room_number !== '-' && p.room_number !== '—' && p.room_number.trim() !== '' && (
                                            <span className="px-2 py-0.5 bg-brand-50 text-brand-500 text-[10px] md:text-[11px] font-bold rounded uppercase border border-brand-100">R-{p.room_number}</span>
                                        )}
                                        <span className={`${p.room_number && p.room_number !== '-' && p.room_number !== '—' && p.room_number.trim() !== '' ? 'ml-1.5' : ''} px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] md:text-[11px] font-bold rounded uppercase border border-slate-200`}>{p.ward_type ? `${p.ward_type} - ` : ''}B-{p.bed_number}</span>
                                        {p.ward_category && p.ward_category !== 'WARD' && p.ward_category !== 'GENERAL' && p.ward_category !== 'PRIVATE' && (
                                            <span className="ml-1.5 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] md:text-[11px] font-bold rounded uppercase border border-red-100">{p.ward_category.replace(/_/g, ' ')}</span>
                                        )}
                                        {p.visiting_allowed !== undefined && (
                                            <div className="mt-1">
                                                <span className={`px-2 py-0.5 text-[8px] md:text-[9px] font-bold rounded uppercase border ${p.visiting_allowed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                    {p.visiting_allowed ? `✓ ${p.visiting_session} Window` : `✗ Closed${p.visiting_next ? ` • Next: ${p.visiting_next.from}` : ''}`}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 whitespace-nowrap">
                                        {editContact.admission_id === p.admission_id ? (
                                            <div className="flex flex-col gap-1">
                                                <input
                                                    className="bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-bold uppercase w-32"
                                                    value={editContact.name}
                                                    onChange={e => setEditContact({ ...editContact, name: e.target.value })}
                                                />
                                                <input
                                                    className="bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-bold w-32"
                                                    value={editContact.mobile}
                                                    onChange={e => setEditContact({ ...editContact, mobile: e.target.value })}
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="text-[12px] font-bold text-slate-800 uppercase tabular-nums">{p.relative_name || 'N/A'}</div>
                                                <div className="text-[10px] font-medium text-slate-400 font-mono tracking-tighter">{p.relative_mobile || 'NO_MOBILE'}</div>
                                            </div>
                                        )}
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
                                                className="w-12 h-7 px-1.5 bg-white border border-indigo-300 rounded text-[12px] font-bold text-center text-slate-800 outline-none focus:border-indigo-500 ring-2 ring-indigo-100"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="text-lg font-bold text-slate-800 tabular-nums">{p.max_visitors}</span>
                                        )}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 whitespace-nowrap">
                                        {editingPatient === p.admission_id ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={editDuration}
                                                    onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); setEditDuration(v === '' ? '' : parseFloat(v)); }}
                                                    className="w-12 h-7 px-1.5 bg-white border border-amber-300 rounded text-[12px] font-bold text-center text-slate-800 outline-none focus:border-amber-500 ring-2 ring-amber-100"
                                                />
                                                <span className="text-[9px] font-bold text-slate-400">H</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <span className="text-[14px] font-bold text-slate-800 tabular-nums">{p.visit_duration_hours}</span>
                                                <span className="text-[9px] font-bold text-slate-400">HRS</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 md:py-5 text-right whitespace-nowrap">
                                        <div className="flex gap-1.5 items-center justify-end">
                                            {editContact.admission_id === p.admission_id ? (
                                                <>
                                                    <button onClick={() => saveContactDetails(p.admission_id)} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all" title="Save Contact"><Check size={14} /></button>
                                                    <button onClick={() => setEditContact({ admission_id: null, name: '', mobile: '' })} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all" title="Cancel"><X size={14} /></button>
                                                </>
                                            ) : editingPatient === p.admission_id ? (
                                                <>
                                                    <button onClick={() => saveMaxVisitors(p.admission_id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1.5" title="Save Quota"><Check size={14} /> Save</button>
                                                    <button onClick={() => setEditingPatient(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all" title="Cancel"><X size={14} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => setEditContact({ admission_id: p.admission_id, name: p.relative_name, mobile: p.relative_mobile })}
                                                        className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-1"
                                                        title="Edit Contact"
                                                    >
                                                        <Users size={12} /> Contact
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingPatient(p.admission_id); setEditValue(p.max_visitors); setEditDuration(p.visit_duration_hours); }}
                                                        className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-100 hover:border-indigo-300 transition-all flex items-center gap-1"
                                                        title="Edit Visitor Quota & Duration"
                                                    >
                                                        <Pencil size={12} /> Quota
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 md:px-8 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <span className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        {patientPagination.total} Records • Page {patientPagination.page} of {patientPagination.pages || 1}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={patientPagination.page <= 1}
                            onClick={() => setPatientPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50 disabled:opacity-30 transition-all"
                        >
                            Prev
                        </button>
                        <div className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold font-mono">
                            {patientPagination.page}/{patientPagination.pages || 1}
                        </div>
                        <button
                            disabled={patientPagination.page >= patientPagination.pages}
                            onClick={() => setPatientPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50 disabled:opacity-30 transition-all"
                        >
                            Next
                        </button>
                    </div>
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
            <aside className={`fixed inset-y-0 left-0 w-72 bg-brand-900 flex flex-col z-[70] text-white shadow-xl lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out border-r border-white/10 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 md:p-8 border-b border-white/10 bg-brand-950/50 flex flex-col items-center">
                    <div className="group relative">
                        <img src={logo} alt="Action Care Hospital" className="w-20 h-20 object-contain drop-shadow-2xl mb-4" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-brand-900 animate-pulse" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-xl font-black font-outfit tracking-tight text-white uppercase tracking-wider leading-tight">Sri Balaji Action Medical Institute</h1>
                        <p className="text-[9px] font-black text-brand-200 uppercase tracking-[0.4em] mt-2 opacity-80">Command Station</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 mt-6 space-y-2">
                    <div className="text-[10px] font-black text-brand-200/50 uppercase tracking-[0.3em] px-4 py-4 mb-2">Live Node Intelligence</div>
                    <button onClick={() => { setActiveView('registry'); setPagination(p => ({ ...p, page: 1 })); setIsSidebarOpen(false); }} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'registry' ? 'bg-white text-brand-600 shadow-lg shadow-black/20' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}>
                        <LayoutDashboard size={16} /> Visitor Dashboard
                    </button>

                    <div className="text-[10px] font-black text-brand-200/50 uppercase tracking-[0.3em] px-4 py-8 mb-2">Facility Overlook</div>
                    <button onClick={() => setActiveView('human')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'human' ? 'bg-white text-brand-600 shadow-lg shadow-black/20' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}>
                        <Users size={16} /> Hospital Staff
                    </button>
                    <button onClick={() => setActiveView('topology')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'topology' ? 'bg-white text-brand-600 shadow-lg shadow-black/20' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}>
                        <Layers size={16} /> Patient Bed History
                    </button>
                    <button onClick={() => setActiveView('charts')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'charts' ? 'bg-white text-brand-600 shadow-lg shadow-black/20' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}>
                        <BarChart2 size={16} /> Analytical Intelligence
                    </button>
                    <button onClick={() => setActiveView('patients')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'patients' ? 'bg-white text-brand-600 shadow-lg shadow-black/20' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}>
                        <UserCheck size={16} /> Visitor Quotas
                    </button>

                    <div className="text-[10px] font-black text-brand-200/50 uppercase tracking-[0.3em] px-4 py-8 mb-2">System Core</div>
                    <button onClick={() => setActiveView('audit')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'audit' ? 'bg-white text-brand-600 shadow-lg shadow-black/20' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}>
                        <ShieldAlert size={16} /> Security History
                    </button>
                    <button onClick={() => setActiveView('account')} className={`w-full px-5 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeView === 'account' ? 'bg-white text-brand-600 shadow-lg shadow-black/20' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}>
                        <ShieldCheck size={16} /> My Account
                    </button>
                </nav>

                <div className="p-6 border-t border-white/10">
                    <button onClick={logout} className="w-full py-4 flex items-center justify-center gap-3 bg-black/20 text-brand-200 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-red-600 hover:text-white transition-all border border-white/5 active:scale-95 shadow-xl shadow-red-900/10">
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
                        {activeView === 'account' && renderAccountSettings()}

                        {/* V2 Admit Patient Modal - Moved here for global access */}
                        {showAdmitForm && (
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 scrollbar-hide overflow-y-auto max-h-[90vh]">
                                    <div className="p-8 border-b border-slate-100 bg-indigo-50 flex justify-between items-center sticky top-0 z-10">
                                        <h3 className="text-xl font-bold text-indigo-900 font-outfit uppercase">Patient Admission Entry</h3>
                                        <button onClick={() => setShowAdmitForm(false)} className="text-slate-400 hover:text-red-500">
                                            <X size={24} />
                                        </button>
                                    </div>
                                    <form onSubmit={handleAdmitPatient} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UHID (Medical Record ID)</label>
                                            <input required className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold" value={newAdmission.uhid} onChange={e => setNewAdmission({ ...newAdmission, uhid: e.target.value })} placeholder="e.g. UHID12345" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Full Name</label>
                                            <input required className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold" value={newAdmission.full_name} onChange={e => setNewAdmission({ ...newAdmission, full_name: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Relative Mobile</label>
                                            <input required className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold" value={newAdmission.mobile_number} onChange={e => setNewAdmission({ ...newAdmission, mobile_number: e.target.value })} placeholder="10-digit number" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Relative Name</label>
                                            <input className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold" value={newAdmission.relative_name} onChange={e => setNewAdmission({ ...newAdmission, relative_name: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ward Category (ICU/Area)</label>
                                            <select className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold appearance-none" value={newAdmission.ward_category} onChange={e => {
                                                const cat = e.target.value;
                                                const isICU = !['GENERAL', 'PRIVATE', 'WARD'].includes(cat);
                                                setNewAdmission({ ...newAdmission, ward_category: cat, ward_type: isICU ? 'GENERAL' : (cat === 'PRIVATE' ? 'PRIVATE' : 'GENERAL') });
                                            }}>
                                                <optgroup label="Standard Wards">
                                                    <option value="GENERAL">General Ward</option>
                                                    <option value="PRIVATE">Private Suite</option>
                                                    <option value="WARD">Ward / Other Area</option>
                                                </optgroup>
                                                <optgroup label="ICU & Critical Care">
                                                    <option value="MEDICAL_ICU_1_11">Medical ICU Bed 1–11</option>
                                                    <option value="MEDICAL_ICU_12_23">Medical ICU Bed 12–23</option>
                                                    <option value="NEURO_ICU">Neuro ICU</option>
                                                    <option value="SURGICAL_ICU">Surgical ICU</option>
                                                    <option value="ICU_2">ICU-2</option>
                                                    <option value="HEART_COMMAND">Heart Command</option>
                                                    <option value="ICU_3">ICU-3</option>
                                                    <option value="NEPHRO_ICU">Nephro ICU</option>
                                                    <option value="NICU">NICU</option>
                                                </optgroup>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Room</label>
                                                <input required className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold" value={newAdmission.room_number} onChange={e => setNewAdmission({ ...newAdmission, room_number: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bed</label>
                                                <input required className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold" value={newAdmission.bed_number} onChange={e => setNewAdmission({ ...newAdmission, bed_number: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max Visitors (Quota)</label>
                                            <input type="number" required className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold" value={newAdmission.max_visitors} onChange={e => setNewAdmission({ ...newAdmission, max_visitors: parseInt(e.target.value) })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visit Duration (Hrs)</label>
                                            <input type="number" required className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold" value={newAdmission.visit_duration_hours} onChange={e => setNewAdmission({ ...newAdmission, visit_duration_hours: parseFloat(e.target.value) })} />
                                        </div>

                                        <button
                                            type="submit"
                                            className="md:col-span-2 w-full py-5 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                                        >
                                            <Check size={20} />
                                            Confirm Admission & Notify Relative
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
