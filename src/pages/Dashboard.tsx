import { useNavigate } from 'react-router-dom'
import { FilePenLine, FileClock, Users, Settings, Plus, Activity, Calendar } from 'lucide-react'
import { useAuth } from '../components/AuthProvider'

export default function Dashboard() {
    const navigate = useNavigate()
    const { user } = useAuth()

    const stats = [
        { label: 'Today\'s Patients', value: '12', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Pending Reports', value: '3', icon: FileClock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Total Appointments', value: '45', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    ]

    const quickActions = [
        {
            label: 'Write New Prescription',
            desc: 'Start a new patient visit',
            icon: FilePenLine,
            action: () => navigate('/write'),
            primary: true
        },
        {
            label: 'Patient History',
            desc: 'View past records',
            icon: Users,
            action: () => navigate('/history'),
            primary: false
        },
        {
            label: 'Settings',
            desc: 'Manage templates & profile',
            icon: Settings,
            action: () => navigate('/settings'), // We might need to create this later
            primary: false
        }
    ]

    return (
        <div className="max-w-5xl mx-auto pb-20">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
                <p className="text-slate-500">Dr. {user?.user_metadata?.full_name || 'Doctor'}</p>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color}`}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                            <div className="text-sm text-slate-500">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {quickActions.map((item, i) => (
                    <button
                        key={i}
                        onClick={item.action}
                        className={`text-left p-6 rounded-xl border transition-all group flex items-start justify-between ${item.primary
                                ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                            }`}
                    >
                        <div>
                            <div className={`mb-4 w-10 h-10 rounded-lg flex items-center justify-center ${item.primary ? 'bg-white/20' : 'bg-slate-100 text-slate-600'
                                }`}>
                                <item.icon size={20} />
                            </div>
                            <h3 className={`font-semibold text-lg mb-1 ${item.primary ? 'text-white' : 'text-slate-900'}`}>
                                {item.label}
                            </h3>
                            <p className={`text-sm ${item.primary ? 'text-slate-300' : 'text-slate-500'}`}>
                                {item.desc}
                            </p>
                        </div>
                        {item.primary && (
                            <div className="bg-white/20 p-2 rounded-full">
                                <Plus size={20} />
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* Recent Activity (Placeholder) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Recent Activity</h3>
                    <button className="text-sm text-primary hover:underline">View All</button>
                </div>
                <div className="divide-y divide-slate-100">
                    {[1, 2, 3].map((_, i) => (
                        <div key={i} className="p-4 hover:bg-slate-50 flex items-center gap-4 transition-colors cursor-pointer">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                JD
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-slate-900">John Doe</div>
                                <div className="text-xs text-slate-500">General Checkup</div>
                            </div>
                            <div className="text-xs text-slate-400">2h ago</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
