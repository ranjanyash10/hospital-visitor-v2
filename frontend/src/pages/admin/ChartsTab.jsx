import React, { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { TrendingUp, Users, MapPin, Calendar, RefreshCw } from 'lucide-react';
import api from '../../api';

const COLORS = ['#f26034', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

const ChartsTab = () => {
    const [monthlyData, setMonthlyData] = useState([]);
    const [dayWiseData, setDayWiseData] = useState([]);
    const [zoneData, setZoneData] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/analytics');
            setMonthlyData(res.data.monthly);
            setDayWiseData(res.data.daily);
            setZoneData(res.data.zones);
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <RefreshCw className="w-12 h-12 text-brand-500 animate-spin" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Aggregating real-time data...</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-end">
                <button
                    onClick={fetchAnalytics}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all text-xs font-bold shadow-sm"
                >
                    <RefreshCw className="w-3 h-3" /> Refresh Live Data
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Monthly Visits Chart */}
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-brand-50 rounded-xl">
                            <Calendar className="w-6 h-6 text-brand-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Monthly Visitor Traffic</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData}>
                                <defs>
                                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f26034" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f26034" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="bold" />
                                <YAxis stroke="#64748b" fontSize={10} fontWeight="bold" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#f26034' }}
                                />
                                <Area type="monotone" dataKey="visits" stroke="#f26034" fillOpacity={1} fill="url(#colorVisits)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Zone Distribution Chart */}
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-emerald-50 rounded-xl">
                            <MapPin className="w-6 h-6 text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Zone-wise Distribution</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        {zoneData && zoneData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={zoneData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {zoneData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    />
                                    <Legend
                                        layout="horizontal"
                                        align="center"
                                        verticalAlign="bottom"
                                        wrapperStyle={{ paddingTop: '20px', color: '#64748b', fontSize: '10px', fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-200">
                                <MapPin size={48} className="mb-2 opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-widest">No active visitors</p>
                                <p className="text-[10px] font-medium text-slate-400 mt-1">Check back when traffic increases</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Day-wise Trends Chart */}
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-50 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-amber-500" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Last 30 Days Visitor Trends</h3>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dayWiseData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="day" stroke="#64748b" fontSize={10} fontWeight="bold" />
                            <YAxis stroke="#64748b" fontSize={10} fontWeight="bold" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                cursor={{ fill: '#ffffff05' }}
                            />
                            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ChartsTab;
