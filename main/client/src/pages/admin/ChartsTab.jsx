import React from 'react';
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
import { TrendingUp, Users, MapPin, Calendar } from 'lucide-react';

const monthlyData = [
    { name: 'Jan', visits: 400 },
    { name: 'Feb', visits: 300 },
    { name: 'Mar', visits: 600 },
    { name: 'Apr', visits: 800 },
    { name: 'May', visits: 500 },
    { name: 'Jun', visits: 900 },
    { name: 'Jul', visits: 1000 },
    { name: 'Aug', visits: 1200 },
    { name: 'Sep', visits: 1100 },
    { name: 'Oct', visits: 1300 },
    { name: 'Nov', visits: 1500 },
    { name: 'Dec', visits: 1800 },
];

const dayWiseData = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    count: Math.floor(Math.random() * 50) + 20
}));

const zoneData = [
    { name: 'General Ward', value: 400 },
    { name: 'Private Ward', value: 300 },
    { name: 'ICU', value: 150 },
    { name: 'OPD', value: 500 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const ChartsTab = () => {
    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Monthly Visits Chart */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <Calendar className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Monthly Visitor Traffic</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData}>
                                <defs>
                                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#60a5fa' }}
                                />
                                <Area type="monotone" dataKey="visits" stroke="#3b82f6" fillOpacity={1} fill="url(#colorVisits)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Zone Distribution Chart */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-emerald-500/20 rounded-xl">
                            <MapPin className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Zone-wise Distribution</h3>
                    </div>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={zoneData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
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
                                <Legend layout="vertical" align="right" verticalAlign="middle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Day-wise Trends Chart */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-500/20 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-amber-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Last 30 Days Visitor Trends</h3>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dayWiseData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis dataKey="day" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
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
