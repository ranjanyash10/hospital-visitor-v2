import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { io } from 'socket.io-client';
import api from '../../api';
import {
    LogOut, ShieldCheck, Activity, Monitor, Database,
    CheckCircle2, User, Building2, Clock, Wifi, WifiOff,
    QrCode, Shield, RefreshCw, ChevronLeft, ChevronRight,
    Camera, Scan, History, UserCheck, CreditCard
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { format } from 'date-fns';
import logo from '../../assets/logo.png';

const API_BASE = import.meta.env.VITE_API_URL || '';
// In dev, Vite proxies /api to the backend but NOT WebSocket connections.
// So we need the actual backend URL for Socket.io.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:5005' : window.location.origin);

const GuardDashboard = () => {
    const navigate = useNavigate();

    // Guard session
    const [guardStationId, setGuardStationId] = useState(null);
    const [qrToken, setQrToken] = useState(null);
    const [visitorUrl, setVisitorUrl] = useState(null);

    // Display mode
    const [mode, setMode] = useState('LOADING'); // LOADING → QR → SUCCESS
    const [successData, setSuccessData] = useState(null);
    const [successCountdown, setSuccessCountdown] = useState(30);

    // Socket
    const socketRef = useRef(null);
    const [socketConnected, setSocketConnected] = useState(false);

    // Dashboard stats
    const [stats, setStats] = useState({ activeSlips: 0, todaySlips: 0, lockdown: false });
    const [slips, setSlips] = useState([]);
    const [showPanel, setShowPanel] = useState(false);

    // Active visitors
    const [activeVisitors, setActiveVisitors] = useState([]);
    const lastSeenSlipIdRef = useRef(null);

    // Clock
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- 1. Start Guard Session ---
    useEffect(() => {
        startSession();
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const startSession = async () => {
        try {
            const res = await api.post('/guard/start-session');
            const stationId = res.data.guard_station_id;
            setGuardStationId(stationId);

            // Connect Socket.io
            const socket = io(SOCKET_URL, {
                path: '/api/socket.io',
                transports: ['websocket', 'polling']
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                setSocketConnected(true);
                socket.emit('join_guard_station', stationId);
                console.log('[Socket.io] Connected and joined station:', stationId);
            });

            socket.on('disconnect', () => setSocketConnected(false));

            socket.on('VISITOR_AUTH_SUCCESS', (data) => {
                console.log('[Socket.io] VISITOR_AUTH_SUCCESS:', data);
                setSuccessData(data);
                setSuccessCountdown(30);
                setMode('SUCCESS');
                fetchStats();
                fetchActiveVisitors();
            });

            // Generate static QR (one token per session)
            const qrRes = await api.get('/guard/qr-token');
            const baseUrl = window.location.origin;
            const fullUrl = `${baseUrl}/visitor?token=${qrRes.data.qr_token}`;
            setQrToken(fullUrl);
            setVisitorUrl(fullUrl);

            fetchStats();
            setMode('QR');
        } catch (err) {
            console.error('Failed to start guard session:', err);
        }
    };

    // --- 2. Regenerate QR (called when returning from SUCCESS mode) ---
    const refreshQrToken = useCallback(async () => {
        try {
            const res = await api.get('/guard/qr-token');
            const baseUrl = window.location.origin;
            const fullUrl = `${baseUrl}/visitor?token=${res.data.qr_token}`;
            setQrToken(fullUrl);
            setVisitorUrl(fullUrl);
        } catch (err) {
            console.error('Failed to refresh QR token:', err);
        }
    }, []);

    // --- 3. Success Countdown (30 seconds then revert) ---
    useEffect(() => {
        if (mode !== 'SUCCESS') return;
        const timer = setInterval(() => {
            setSuccessCountdown(prev => {
                if (prev <= 1) {
                    setMode('QR');
                    setSuccessData(null);
                    refreshQrToken();
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [mode, refreshQrToken]);

    // --- 4. Dashboard Stats ---
    const fetchStats = async () => {
        try {
            const [statsRes, slipsRes] = await Promise.all([
                api.get('/guard/dashboard'),
                api.get('/guard/slips?limit=5')
            ]);
            setStats(statsRes.data);
            const latestSlips = slipsRes.data.slips || slipsRes.data || [];
            setSlips(latestSlips);

            // Initialize lastSeenSlipId if not set
            if (lastSeenSlipIdRef.current === null && latestSlips.length > 0) {
                lastSeenSlipIdRef.current = latestSlips[0].id;
                console.log('[Polling] Initialized lastSeenSlipId:', lastSeenSlipIdRef.current);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    // --- 4b. Active Visitors ---
    const fetchActiveVisitors = useCallback(async () => {
        try {
            const res = await api.get('/guard/slips?limit=50');
            const all = res.data.slips || res.data || [];
            const active = all.filter(s => s.status === 'ACTIVE' || s.status === 'VISITING');
            setActiveVisitors(active);
        } catch (err) {
            console.error('Failed to fetch active visitors:', err);
        }
    }, []);

    useEffect(() => {
        if (mode === 'QR') fetchActiveVisitors();
    }, [mode, fetchActiveVisitors]);

    // --- 4d. Polling Fallback (every 3s) ---
    useEffect(() => {
        let pollTimer;

        const pollForNewSlips = async () => {
            if (mode !== 'QR') return;

            try {
                const res = await api.get('/guard/slips?limit=5');
                const latestSlips = res.data.slips || res.data || [];

                if (latestSlips.length > 0) {
                    const topSlip = latestSlips[0];

                    // If we see a new slip ID that is ACTIVE/VISITING
                    if (lastSeenSlipIdRef.current !== null &&
                        topSlip.id > lastSeenSlipIdRef.current &&
                        (topSlip.status === 'ACTIVE' || topSlip.status === 'VISITING')) {

                        console.log('[Polling] New authorized slip detected:', topSlip.id);

                        // Prepare data for Success Screen
                        const successInfo = {
                            slip_id: topSlip.id,
                            patient_name: topSlip.Patient?.full_name || '—',
                            room_number: topSlip.Patient?.Admissions?.[0]?.room_number || topSlip.room_number || '—',
                            bed_number: topSlip.Patient?.Admissions?.[0]?.bed_number || topSlip.bed_number || '—',
                            masked_mobile: topSlip.Relative?.mobile_number ?
                                topSlip.Relative.mobile_number.replace(/(\d{2})\d{4}(\d{4})/, '$1****$2') : '—',
                            visitor_count: topSlip.visitor_count || 1,
                            timestamp: topSlip.createdAt || new Date()
                        };

                        lastSeenSlipIdRef.current = topSlip.id;
                        setSuccessData(successInfo);
                        setSuccessCountdown(30);
                        setMode('SUCCESS');
                        fetchStats();
                        fetchActiveVisitors();
                    } else if (lastSeenSlipIdRef.current === null || topSlip.id > lastSeenSlipIdRef.current) {
                        // Just update the ref if it's new but not necessarily triggering success (or first load)
                        lastSeenSlipIdRef.current = topSlip.id;
                    }
                }
            } catch (err) {
                console.error('[Polling] Error:', err);
            }
        };

        if (mode === 'QR') {
            pollTimer = setInterval(pollForNewSlips, 3000);
        }

        return () => {
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [mode, fetchActiveVisitors]);

    // --- 4c. OK Dismiss handler ---
    const handleDismissSuccess = () => {
        setMode('QR');
        setSuccessData(null);
        setSuccessCountdown(30);
        refreshQrToken();
        fetchStats();
        fetchActiveVisitors();
    };

    // --- 4e. Manual Scan Verification (Guard scans Visitor) ---
    const [scannerActive, setScannerActive] = useState(false);
    const scannerRef = useRef(null);

    const handleVerifyToken = async (token) => {
        try {
            const res = await api.post('/guard/verify-slip', { slipToken: token });
            if (res.data.valid) {
                const s = res.data.slip;
                setSuccessData({
                    slip_id: s.id.split('-')[0],
                    patient_name: s.patient_name || '—',
                    room_number: s.room_number || '—',
                    bed_number: s.bed_number || '—',
                    visitor_name: s.visitor_name,
                    visitor_age: s.visitor_age,
                    visitor_gender: s.visitor_gender,
                    id_type: s.id_type,
                    id_number: s.id_number,
                    scanned_count: s.scanned_count,
                    max_visitors: s.max_visitors,
                    timestamp: new Date()
                });
                setMode('SUCCESS');
                setSuccessCountdown(30);
                fetchStats();
            } else {
                alert(`Invalid Slip: ${res.data.message}`);
            }
        } catch (err) {
            console.error('Verify error:', err);
            alert('Verification failed');
        }
    };

    const toggleScanner = () => {
        if (!scannerActive) {
            setScannerActive(true);
            // Wait for DOM to render the "reader" div
            setTimeout(() => {
                try {
                    const scanner = new Html5QrcodeScanner("reader", {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                        rememberLastUsedCamera: true,
                        showTorchButtonIfSupported: true
                    }, /* verbose= */ false);

                    scanner.render(
                        (text) => {
                            console.log('[Scanner] Scanned:', text);
                            scanner.clear().then(() => {
                                setScannerActive(false);
                                handleVerifyToken(text);
                            }).catch(err => {
                                console.error('[Scanner] Clear failed:', err);
                                setScannerActive(false);
                            });
                        },
                        (error) => {
                            // Too noisy to log every frame, but we can log high-level failures if needed
                        }
                    );
                    scannerRef.current = scanner;
                } catch (err) {
                    console.error('[Scanner] Initialization failed:', err);
                    alert("Could not start scanner. Please ensure you are using HTTPS or localhost.");
                }
            }, 300);
        } else {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(e => console.error("Scanner clear error", e));
                scannerRef.current = null;
            }
            setScannerActive(false);
        }
    };

    // --- 5. Logout ---
    const logout = async () => {
        try {
            await api.post('/guard/end-session');
        } catch (e) { /* ignore */ }
        if (socketRef.current) socketRef.current.disconnect();
        localStorage.removeItem('token');
        navigate('/guard/login');
    };

    // --- RENDER: SUCCESS MODE ---
    if (mode === 'SUCCESS' && successData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 flex flex-col transition-colors duration-700">
                {/* Success Header */}
                <header className="px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-emerald-600/30">
                            <ShieldCheck size={22} />
                        </div>
                        <span className="text-sm font-black text-emerald-800 uppercase tracking-wider">Access Granted</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 rounded-full bg-white/70 backdrop-blur border border-emerald-200">
                            <span className="text-lg font-black text-emerald-700 tabular-nums">{successCountdown}s</span>
                        </div>
                    </div>
                </header>

                {/* Success Content */}
                <main className="flex-1 flex items-center justify-center px-6">
                    <div className="w-full max-w-2xl text-center">
                        {/* Giant Checkmark */}
                        <div className="w-32 h-32 md:w-40 md:h-40 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/40 animate-bounce-once">
                            <CheckCircle2 size={80} className="text-white" strokeWidth={2.5} />
                        </div>

                        <h1 className="text-4xl md:text-5xl font-black text-emerald-800 mb-2 tracking-tight">
                            VISITOR AUTHORIZED
                        </h1>
                        <p className="text-emerald-600 font-bold text-sm uppercase tracking-[0.3em] mb-4">
                            Entry Clearance Confirmed
                        </p>

                        {/* Visitor count badge */}
                        {successData.visitor_count > 1 && (
                            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-full px-5 py-2 mb-8 border border-emerald-200 shadow-sm">
                                <Users size={16} className="text-brand-600" />
                                <span className="text-sm font-black text-brand-700 uppercase tracking-wider">
                                    {successData.visitor_count} Visitors Entering
                                </span>
                            </div>
                        )}
                        {(!successData.visitor_count || successData.visitor_count === 1) && <div className="mb-10" />}

                        {/* Info Cards */}
                        <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 md:p-8 shadow-xl shadow-emerald-500/10 border border-emerald-100">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Visitor Name</p>
                                    <p className="font-bold text-slate-800">{successData.visitor_name || 'Authorized Guest'}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Age / Gender</p>
                                    <p className="font-bold text-slate-800">{successData.visitor_age || '—'} / {successData.visitor_gender || '—'}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Identity ({successData.id_type})</p>
                                    <p className="font-bold text-slate-800">{successData.id_number || 'Verified'}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Quota Usage</p>
                                    <p className="font-bold text-emerald-600">Scan {successData.scanned_count} of {successData.max_visitors}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                                        <User size={10} /> To Patient
                                    </p>
                                    <p className="text-lg font-black text-slate-800 tracking-tight">{successData.patient_name}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                                        <Building2 size={10} /> Room
                                    </p>
                                    <p className="text-lg font-black text-slate-800 tracking-tight">{successData.room_number}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                                        <Activity size={10} /> Bed
                                    </p>
                                    <p className="text-lg font-black text-slate-800 tracking-tight">{successData.bed_number}</p>
                                </div>
                            </div>
                            <div className="mt-5 pt-5 border-t border-emerald-50 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    Slip ID: {successData.slip_id}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    {format(new Date(successData.timestamp), 'HH:mm:ss')}
                                </span>
                            </div>
                        </div>

                        {/* Countdown bar */}
                        <div className="mt-8 h-2 bg-emerald-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: `${(successCountdown / 30) * 100}%` }}
                            />
                        </div>

                        {/* OK Dismiss Button */}
                        <button
                            onClick={handleDismissSuccess}
                            className="mt-6 w-full max-w-xs mx-auto flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-95"
                        >
                            <CheckCircle2 size={24} />
                            OK — Return to Scanner
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // --- RENDER: QR MODE ---
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-slate-100 px-4 py-3 md:px-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
                    <div className="flex items-center gap-4">
                        <img src={logo} alt="Sri Balaji Action Medical Institute" className="w-12 h-12 object-contain drop-shadow-md" />
                        <div className="flex flex-col">
                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Sri Balaji Action</p>
                            <p className="text-[8px] font-bold text-brand-500 uppercase tracking-[0.25em]">Medical Institute</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Connection Status */}
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${socketConnected
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                            {socketConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
                            {socketConnected ? 'Live' : 'Offline'}
                        </div>

                        {/* Stats Toggle */}
                        <button
                            onClick={() => setShowPanel(!showPanel)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
                        >
                            <Monitor size={10} /> Dashboard
                            {showPanel ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
                        </button>

                        {/* Clock */}
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 tabular-nums">
                            <Clock size={10} />
                            {format(currentTime, 'HH:mm:ss')}
                        </div>

                        {/* Logout */}
                        <button onClick={logout} className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* QR Main Area */}
                <main className="flex-1 flex flex-col items-center p-6 md:p-8 overflow-y-auto">
                    {mode === 'LOADING' ? (
                        <div className="text-center">
                            <RefreshCw size={48} className="animate-spin text-brand-500 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Initializing Station...</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-6 md:mb-8">
                                <div className="flex items-center justify-center gap-3 mb-3">
                                    <QrCode size={24} className="text-brand-500" />
                                    <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Scan to Enter</h2>
                                </div>
                                <p className="text-slate-400 text-xs font-semibold">Visitors: use your phone camera to scan this QR code</p>
                            </div>

                            {/* Scanner Toggle */}
                            <div className="flex flex-col items-center gap-6 mt-12">
                                {!scannerActive ? (
                                    <button
                                        onClick={toggleScanner}
                                        className="w-64 h-64 md:w-80 md:h-80 bg-white rounded-[3rem] shadow-2xl shadow-slate-300/30 flex flex-col items-center justify-center gap-6 group hover:scale-[1.02] transition-all duration-300 border-4 border-dashed border-slate-100 hover:border-brand-200"
                                    >
                                        <div className="w-24 h-24 bg-brand-50 rounded-3xl flex items-center justify-center text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-300">
                                            <Camera size={48} />
                                        </div>
                                        <div className="text-center px-6">
                                            <p className="text-lg font-black text-slate-800 uppercase tracking-tight">Open Scanner</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ready to scan visitor pass</p>
                                        </div>
                                    </button>
                                ) : (
                                    <div className="w-full max-w-sm bg-black rounded-3xl overflow-hidden shadow-2xl relative">
                                        <div id="reader" className="w-full"></div>
                                        <button
                                            onClick={toggleScanner}
                                            className="absolute top-4 right-4 bg-white/20 backdrop-blur p-2 rounded-full text-white hover:bg-white/40 transition-colors"
                                        >
                                            <LogOut size={20} />
                                        </button>
                                        <div className="absolute bottom-6 left-0 w-full text-center">
                                            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Point at Visitor Pass</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mt-2">
                                <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
                                Station Active
                            </span>

                            {/* Quick Stats Bar */}
                            <div className="mt-8 grid grid-cols-2 md:flex gap-4">
                                <div className="px-5 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
                                    <p className="text-2xl font-black text-brand-500">{stats.activeSlips}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Active</p>
                                </div>
                                <div className="px-5 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
                                    <p className="text-2xl font-black text-slate-700">{stats.todaySlips}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Today</p>
                                </div>
                                {stats.lockdown && (
                                    <div className="col-span-2 md:col-span-1 px-5 py-3 bg-red-50 rounded-2xl border border-red-100 text-center flex items-center justify-center">
                                        <p className="text-sm font-black text-red-600 uppercase">🔒 Lockdown</p>
                                    </div>
                                )}
                            </div>

                            {/* Active Visitors Dashboard */}
                            <div className="mt-8 w-full max-w-2xl">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                        <Users size={16} className="text-brand-500" />
                                        Active Visitors Inside
                                    </h3>
                                    <button
                                        onClick={fetchActiveVisitors}
                                        className="text-[10px] font-bold text-brand-500 hover:underline flex items-center gap-1"
                                    >
                                        <RefreshCw size={10} /> Refresh
                                    </button>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    {activeVisitors.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <Users size={32} className="text-slate-200 mx-auto mb-2" />
                                            <p className="text-xs text-slate-400 font-semibold">No active visitors right now</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left min-w-[500px]">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">Visitor</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">Patient</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">Room</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">Count</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">Check-in</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {activeVisitors.map((slip, i) => (
                                                        <tr key={slip.id} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-brand-50/50 transition-colors`}>
                                                            <td className="px-4 py-3">
                                                                <p className="text-xs font-bold text-slate-700">{slip.Relative?.name || slip.visitor_name || '—'}</p>
                                                                <p className="text-[9px] text-slate-400 font-mono">{slip.Relative?.mobile_number || ''}</p>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <p className="text-xs font-bold text-slate-700">{slip.Patient?.full_name || '—'}</p>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <p className="text-xs font-bold text-brand-500">
                                                                    {slip.Patient?.Admissions?.[0]?.room_number || slip.room_number || '—'}
                                                                </p>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${slip.visitor_count > 1 ? 'bg-brand-100 text-brand-700' : 'text-slate-500'}`}>
                                                                    {slip.visitor_count > 1 ? `×${slip.visitor_count}` : '×1'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <p className="text-[10px] font-bold text-slate-500 tabular-nums">
                                                                    {slip.createdAt ? format(new Date(slip.createdAt), 'HH:mm') : '—'}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </main>

                {/* Slide-out Dashboard Panel */}
                {showPanel && (
                    <aside className="w-80 bg-white border-l border-slate-100 overflow-y-auto p-5 animate-in slide-in-from-right duration-300">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Database size={14} className="text-brand-500" /> Recent Slips
                        </h3>
                        <button onClick={fetchStats} className="mb-4 text-xs font-bold text-brand-500 flex items-center gap-1 hover:underline">
                            <RefreshCw size={10} /> Refresh
                        </button>
                        <div className="space-y-2">
                            {slips.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-8">No slips today</p>
                            ) : slips.map(slip => (
                                <div key={slip.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-slate-700">
                                            {slip.Patient?.full_name || 'Unknown'}
                                        </span>
                                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${slip.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                            slip.status === 'VISITING' ? 'bg-brand-100 text-brand-700' :
                                                slip.status === 'EXPIRED' ? 'bg-slate-100 text-slate-500' :
                                                    'bg-red-100 text-red-700'
                                            }`}>
                                            {slip.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-slate-400 font-mono">{slip.slip_token}</span>
                                        <span className="text-[9px] text-slate-400">
                                            {slip.createdAt ? format(new Date(slip.createdAt), 'HH:mm') : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
};

export default GuardDashboard;
