// Force deployment rebuild trigger
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
import { Html5Qrcode } from 'html5-qrcode';
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
    const [allSlips, setAllSlips] = useState([]);
    const [statusFilter, setStatusFilter] = useState('VISITING');
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
            const res = await api.get('/guard/slips?limit=100');
            const all = res.data.slips || res.data || [];
            setAllSlips(all);
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
                        topSlip.status === 'VISITING') {

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

    // --- 4f. Manual Checkout ---
    const handleCheckout = async (slipId, forced = false) => {
        const msg = forced 
            ? 'SECURITY ACTION: Forcefully exit this visitor and log as security event?' 
            : 'Are you sure you want to check out this visitor?';
        if (!window.confirm(msg)) return;
        try {
            await api.post('/guard/checkout-slip', { id: slipId, forced });
            fetchActiveVisitors();
            fetchStats();
        } catch (err) {
            console.error('Checkout failed:', err);
            alert('Failed to check out visitor');
        }
    };

    // --- 4e. Manual Scan Verification (Guard scans Visitor) ---
    const [scannerActive, setScannerActive] = useState(false);
    const [manualToken, setManualToken] = useState('');
    const scannerRef = useRef(null);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!manualToken.trim()) return;
        handleVerifyToken(manualToken.trim());
        setManualToken('');
    };

    const handleVerifyToken = async (token) => {
        try {
            const res = await api.post('/guard/verify-slip', { slipToken: token });
            if (res.data.valid) {
                const s = res.data.slip;
                const status = res.data.status; // GRANTED or EXIT_GRANTED

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
                    permit_type: s.permit_type || 'REGULAR',
                    timestamp: new Date(),
                    scan_status: status 
                });
                setMode('SUCCESS');
                setSuccessCountdown(30);
                fetchStats();
            } else {
                alert(`DENIED: ${res.data.message}`);
            }
        } catch (err) {
            console.error('Verify error:', err);
            alert('Verification failed');
        }
    };

    const toggleScanner = async () => {
        if (!scannerActive) {
            setScannerActive(true);
            // Wait for DOM to render the "reader" div
            await new Promise(r => setTimeout(r, 400));

            try {
                const html5Qr = new Html5Qrcode("reader");
                scannerRef.current = html5Qr;

                const qrConfig = {
                    fps: 10,
                    qrbox: { width: 200, height: 200 }
                };

                const onSuccess = (text) => {
                    console.log('[Scanner] Scanned:', text);
                    html5Qr.stop().then(() => {
                        html5Qr.clear();
                        setScannerActive(false);
                        handleVerifyToken(text);
                    }).catch(err => {
                        console.error('[Scanner] Stop failed:', err);
                        setScannerActive(false);
                    });
                };

                const onError = () => { /* ignore per-frame decode errors */ };

                // Fallback chain: front cam → rear cam → any cam
                try {
                    // Try 1: Front camera (mobile/tablet/laptops)
                    await html5Qr.start(
                        { facingMode: "user" },
                        qrConfig, onSuccess, onError
                    );
                    console.log('[Scanner] Started with front camera');
                } catch (e1) {
                    console.warn('[Scanner] Front camera failed, trying rear:', e1);
                    try {
                        // Try 2: Rear camera (phones)
                        await html5Qr.start(
                            { facingMode: "environment" },
                            qrConfig, onSuccess, onError
                        );
                        console.log('[Scanner] Started with rear camera');
                    } catch (e2) {
                        console.warn('[Scanner] Rear camera failed, trying device list:', e2);
                        try {
                            // Try 3: First available camera by device ID
                            const devices = await Html5Qrcode.getCameras();
                            if (devices && devices.length > 0) {
                                await html5Qr.start(
                                    devices[0].id,
                                    qrConfig, onSuccess, onError
                                );
                                console.log('[Scanner] Started with device:', devices[0].label);
                            } else {
                                throw new Error('No cameras found on this device');
                            }
                        } catch (e3) {
                            console.error('[Scanner] All camera methods failed:', e3);
                            alert('Could not access any camera. Please check camera permissions in your browser settings, or use the manual code entry below.');
                            setScannerActive(false);
                        }
                    }
                }
            } catch (err) {
                console.error('[Scanner] Initialization failed:', err);
                alert('Scanner failed to start. Please use the manual code entry below.');
                setScannerActive(false);
            }
        } else {
            if (scannerRef.current) {
                try {
                    await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch (e) {
                    console.error('Scanner stop error', e);
                }
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
    // --- RENDER: SUCCESS MODE ---
    if (mode === 'SUCCESS' && successData) {
        const isExit = successData.scan_status === 'EXIT_GRANTED';
        const theme = isExit 
            ? { bg: 'from-blue-50 via-indigo-50 to-blue-100', accent: 'blue', text: 'blue', iconBg: 'bg-blue-600', shadow: 'shadow-blue-600/30' }
            : { bg: 'from-emerald-50 via-green-50 to-emerald-100', accent: 'emerald', text: 'emerald', iconBg: 'bg-emerald-600', shadow: 'shadow-emerald-600/30' };

        return (
            <div className={`min-h-screen bg-gradient-to-br ${theme.bg} flex flex-col transition-colors duration-700`}>
                {/* Success Header */}
                <header className="px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${theme.iconBg} rounded-xl flex items-center justify-center text-white shadow-xl ${theme.shadow}`}>
                            <ShieldCheck size={22} />
                        </div>
                        <span className={`text-sm font-black text-${theme.accent}-800 uppercase tracking-wider`}>
                            {isExit ? 'Checkout Complete' : 'Access Granted'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-full bg-white/70 backdrop-blur border border-${theme.accent}-200`}>
                            <span className={`text-lg font-black text-${theme.accent}-700 tabular-nums`}>{successCountdown}s</span>
                        </div>
                    </div>
                </header>

                {/* Success Content */}
                <main className="flex-1 flex items-center justify-center px-6">
                    <div className="w-full max-w-2xl text-center">
                        {/* Giant Checkmark */}
                        <div className={`w-32 h-32 md:w-40 md:h-40 ${isExit ? 'bg-blue-500' : 'bg-emerald-500'} rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-${theme.accent}-500/40 animate-bounce-once`}>
                            <CheckCircle2 size={80} className="text-white" strokeWidth={2.5} />
                        </div>

                        <h1 className={`text-4xl md:text-5xl font-black text-${theme.accent}-800 mb-2 tracking-tight`}>
                            {isExit ? 'CHECKOUT CONFIRMED' : 'VISITOR AUTHORIZED'}
                        </h1>
                        <p className={`text-${theme.accent}-600 font-bold text-sm uppercase tracking-[0.3em] mb-4`}>
                            {isExit ? 'Slot Freed for Patient' : 'Entry Clearance Confirmed'}
                        </p>

                        {successData.permit_type === 'AFTER_HOURS' && (
                            <div className="inline-flex items-center gap-2 bg-amber-100 rounded-full px-5 py-2 mb-4 border-2 border-amber-300 shadow-sm">
                                <Clock size={16} className="text-amber-600" />
                                <span className="text-sm font-black text-amber-700 uppercase tracking-wider">
                                    After Hours Permit
                                </span>
                            </div>
                        )}

                        <div className="mb-10" />

                        {/* Info Cards */}
                        <div className={`bg-white/70 backdrop-blur-lg rounded-3xl p-6 md:p-8 shadow-xl shadow-${theme.accent}-500/10 border border-${theme.accent}-100`}>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className={`text-[9px] font-black text-${theme.accent}-500 uppercase tracking-[0.2em] mb-1`}>Visitor Name</p>
                                    <p className="font-bold text-slate-800">{successData.visitor_name || 'Authorized Guest'}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className={`text-[9px] font-black text-${theme.accent}-500 uppercase tracking-[0.2em] mb-1`}>Age / Gender</p>
                                    <p className="font-bold text-slate-800">{successData.visitor_age || '—'} / {successData.visitor_gender || '—'}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className={`text-[9px] font-black text-${theme.accent}-500 uppercase tracking-[0.2em] mb-1`}>Identity ({successData.id_type})</p>
                                    <p className="font-bold text-slate-800">{successData.id_number || 'Verified'}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className={`text-[9px] font-black text-${theme.accent}-500 uppercase tracking-[0.2em] mb-1`}>Pass Status</p>
                                    <p className={`font-bold text-${theme.accent}-600`}>{isExit ? '✓ Checked Out' : '→ Checked In'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className={`text-[9px] font-black text-${theme.accent}-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5`}>
                                        <User size={10} /> To Patient
                                    </p>
                                    <p className="text-lg font-black text-slate-800 tracking-tight">{successData.patient_name}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className={`text-[9px] font-black text-${theme.accent}-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5`}>
                                        <Building2 size={10} /> Room
                                    </p>
                                    <p className="text-lg font-black text-slate-800 tracking-tight">{successData.room_number}</p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 text-left shadow-sm">
                                    <p className={`text-[9px] font-black text-${theme.accent}-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5`}>
                                        <Activity size={10} /> Bed
                                    </p>
                                    <p className="text-lg font-black text-slate-800 tracking-tight">{successData.bed_number}</p>
                                </div>
                            </div>
                            <div className={`mt-5 pt-5 border-t border-${theme.accent}-50 flex items-center justify-between`}>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    Slip ID: {successData.slip_id}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    {format(new Date(successData.timestamp), 'HH:mm:ss • dd/MM/yyyy')}
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaySlips = allSlips.filter(s => new Date(s.createdAt) >= startOfToday);

    const filteredSlips = todaySlips.filter(s => {
        if (statusFilter === 'VISITING') {
            return s.status === 'VISITING' || (s.status === 'ACTIVE' && s.scanned_count === 1 && s.ward_category === 'ICU');
        }
        if (statusFilter === 'EXPIRED') {
            return s.status === 'EXPIRED' && s.expiryReason === 'AUTO_TIMEOUT' && s.scanned_count > 0;
        }
        if (statusFilter === 'CHECKED_OUT') {
            return s.status === 'EXPIRED' && s.expiryReason !== 'AUTO_TIMEOUT' && s.scanned_count > 0;
        }
        return false;
    });

    // --- RENDER: QR MODE ---
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-slate-100 px-4 py-3 md:px-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
                    <div className="flex items-center gap-4">
                        <img src={logo} alt="Sri Balaji Action Medical Institute" className="w-16 h-16 object-contain drop-shadow-md" />
                        <div className="flex flex-col">
                            <p className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight">Sri Balaji</p>
                            <p className="text-[10px] md:text-xs font-black text-brand-500 uppercase tracking-[0.25em] mt-0.5">Action Medical Institute</p>
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
                                    <>
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

                                        {/* Manual / Barcode Scanner Gun Input */}
                                        <form onSubmit={handleManualSubmit} className="flex gap-2 w-full max-w-sm mt-8 px-4">
                                            <input
                                                type="text"
                                                value={manualToken}
                                                onChange={(e) => setManualToken(e.target.value)}
                                                placeholder="Or enter pass code manually / scan with gun"
                                                className="flex-1 px-4 py-3 bg-white rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-brand-500 text-slate-800 shadow-sm"
                                            />
                                            <button
                                                type="submit"
                                                className="px-4 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-2xl text-xs transition-colors shadow-md"
                                            >
                                                Verify
                                            </button>
                                        </form>
                                    </>
                                ) : (
                                    <div className="w-full max-w-md rounded-3xl shadow-2xl bg-slate-900 p-3">
                                        <div id="reader" className="w-full rounded-2xl overflow-hidden"></div>
                                        <button
                                            onClick={toggleScanner}
                                            className="mt-3 w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl text-xs transition-colors shadow-md flex items-center justify-center gap-2"
                                        >
                                            <LogOut size={14} />
                                            Close Scanner
                                        </button>
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
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                        <Users size={16} className="text-brand-500" />
                                        Visitor Registry
                                    </h3>
                                    <button
                                        onClick={fetchActiveVisitors}
                                        className="text-[10px] font-bold text-brand-500 hover:underline flex items-center gap-1"
                                    >
                                        <RefreshCw size={10} /> Refresh
                                    </button>
                                </div>

                                {/* Status Filters Tab Bar */}
                                <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-2xl">
                                    <button
                                        onClick={() => setStatusFilter('VISITING')}
                                        className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${statusFilter === 'VISITING' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Visiting ({todaySlips.filter(s => s.status === 'VISITING' || (s.status === 'ACTIVE' && s.scanned_count === 1 && s.ward_category === 'ICU')).length})
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('EXPIRED')}
                                        className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${statusFilter === 'EXPIRED' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Expired ({todaySlips.filter(s => s.status === 'EXPIRED' && s.expiryReason === 'AUTO_TIMEOUT' && s.scanned_count > 0).length})
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('CHECKED_OUT')}
                                        className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${statusFilter === 'CHECKED_OUT' ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Checked Out ({todaySlips.filter(s => s.status === 'EXPIRED' && s.expiryReason !== 'AUTO_TIMEOUT' && s.scanned_count > 0).length})
                                    </button>
                                </div>

                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    {filteredSlips.length === 0 ? (
                                        <div className="py-12 text-center">
                                            <Users size={32} className="text-slate-200 mx-auto mb-2" />
                                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">No matching visitors found</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left min-w-[500px]">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Visitor</th>
                                                        <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Patient</th>
                                                        <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">UHID</th>
                                                        <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Bed</th>
                                                        <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Ward</th>

                                                        <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                                            {statusFilter === 'VISITING' ? 'Check-in' : 'Check-in / Out'}
                                                        </th>
                                                        <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredSlips.map((slip, i) => (
                                                        <tr key={slip.id} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-brand-50/50 transition-colors`}>
                                                            <td className="px-4 py-4.5">
                                                                <p className="text-[15px] font-black text-slate-800 uppercase tracking-tight">{slip.Relative?.name || slip.visitor_name || 'GUEST'}</p>
                                                                <p className="text-[11px] text-slate-500 font-mono tracking-tighter mt-0.5">{slip.Relative?.mobile_number || ''}</p>
                                                            </td>
                                                            <td className="px-4 py-4.5">
                                                                <p className="text-[15px] font-black text-slate-800 uppercase tracking-tight">{slip.Patient?.full_name || '—'}</p>
                                                            </td>
                                                            <td className="px-4 py-4.5">
                                                                <p className="text-[15px] font-black text-slate-800 font-mono tracking-tight">{slip.Patient?.uhid || '—'}</p>
                                                            </td>
                                                            <td className="px-4 py-4.5">
                                                                <span className="text-[16px] font-black text-brand-600">
                                                                    B_{slip.Patient?.Admissions?.[0]?.bed_number || slip.bed_number || '??'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-4.5 whitespace-nowrap">
                                                                <span className="text-[14px] font-black text-slate-800 uppercase tracking-tight">
                                                                    {slip.ward_type || 'WARD'}
                                                                </span>
                                                            </td>

                                                            <td className="px-4 py-4.5">
                                                                <p className="text-[14px] font-black text-slate-800 tabular-nums">
                                                                    {slip.createdAt ? format(new Date(slip.createdAt), 'HH:mm • dd/MM/yyyy') : '—'}
                                                                </p>
                                                                {statusFilter !== 'VISITING' && slip.updatedAt && (
                                                                    <p className="text-[11px] font-bold text-slate-400 mt-1.5 tabular-nums">
                                                                        → {format(new Date(slip.updatedAt), 'HH:mm • dd/MM/yyyy')}
                                                                    </p>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-4.5 text-right">
                                                                {(statusFilter === 'VISITING' || statusFilter === 'EXPIRED') ? (
                                                                    <div className="flex flex-col gap-1.5 items-end">
                                                                        <button
                                                                            onClick={() => handleCheckout(slip.id)}
                                                                            className="px-4 py-1.5 bg-brand-50 text-brand-600 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-brand-500 hover:text-white transition-all shadow-sm border border-brand-100"
                                                                        >
                                                                            Exit
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleCheckout(slip.id, true)}
                                                                            className="px-4 py-1.5 bg-red-50 text-red-600 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100"
                                                                        >
                                                                            Force Remove
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="inline-block px-3 py-1.5 bg-slate-50 text-slate-500 rounded-xl text-[11px] font-black uppercase border border-slate-200">
                                                                        Checked Out
                                                                    </span>
                                                                )}
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
                                <div key={slip.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                            {slip.Patient?.full_name || 'Unknown'}
                                        </span>
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${slip.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                            slip.status === 'VISITING' ? 'bg-brand-100 text-brand-700' :
                                                slip.status === 'EXPIRED' ? 'bg-slate-100 text-slate-500' :
                                                    'bg-red-100 text-red-700'
                                            }`}>
                                            {slip.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500 font-mono tracking-tighter">{slip.slip_token}</span>
                                        <span className="text-[11px] text-slate-500 font-bold tabular-nums">
                                            {slip.createdAt ? format(new Date(slip.createdAt), 'HH:mm • dd/MM/yyyy') : ''}
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
