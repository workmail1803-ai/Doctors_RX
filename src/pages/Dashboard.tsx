import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FilePenLine, FileClock, Users, Settings, Plus, Activity, Calendar, List } from 'lucide-react'
import { AppointmentScheduler } from '../components/AppointmentScheduler'
import { useAuth } from '../components/AuthProvider'
import { PatientQueue } from '../components/PatientQueue'


export default function Dashboard() {
    const navigate = useNavigate()
    const { user, role } = useAuth()
    const [activeTab, setActiveTab] = useState<'queue' | 'appointments'>('queue')

    // Stats State
    const [stats, setStats] = useState([
        { label: 'Today\'s Patients', value: '0', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Pending Reports', value: '0', icon: FileClock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Total Appointments', value: '0', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    ])

    useEffect(() => {
        if (user) fetchStats()
    }, [user])

    async function fetchStats() {
        if (!user) return

        const today = new Date().toISOString().split('T')[0]

        // 1. Today's Patients (Prescriptions created today)
        const { count: todayCount } = await supabase
            .from('prescriptions')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', user.id)
            .gte('created_at', `${today}T00:00:00`)

        // 2. Total Appointments (Total Prescriptions)
        const { count: totalCount } = await supabase
            .from('prescriptions')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', user.id)

        // 3. Pending Queue (Already have component, but let's get count for stats)
        const { count: pendingCount } = await supabase
            .from('prescriptions')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', user.id)
            .eq('status', 'pending')

        setStats([
            { label: 'Today\'s Patients', value: (todayCount || 0).toString(), icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Pending Queue', value: (pendingCount || 0).toString(), icon: FileClock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Total Appointments', value: (totalCount || 0).toString(), icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
        ])
    }

    if (role === 'assistant') {
        return (
            <div className="p-8 text-center">
                <p>Redirecting to Assistant Dashboard...</p>
                {(() => { setTimeout(() => navigate('/assistant'), 0); return null; })()}
            </div>
        )
    }

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
            label: 'Manage Assistant',
            desc: 'Link or change your assistant',
            icon: Users,
            action: () => navigate('/manage-assistant'),
            primary: false
        },
        {
            label: 'Settings',
            desc: 'Manage templates & profile',
            icon: Settings,
            action: () => navigate('/settings'),
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

            {/* Dashboard Tabs */}
            <div className="flex mb-6 bg-slate-100 p-1 rounded-xl w-full md:w-fit">
                <button
                    onClick={() => setActiveTab('queue')}
                    className={`flex-1 md:flex-none py-2 px-6 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'queue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <List size={18} />
                    Pending Queue
                </button>
                <button
                    onClick={() => setActiveTab('appointments')}
                    className={`flex-1 md:flex-none py-2 px-6 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'appointments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Calendar size={18} />
                    Appointments
                </button>
            </div>

            {/* Content Area */}
            <div className="mb-8">
                {activeTab === 'queue' ? (
                    <PatientQueue />
                ) : (
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6">
                        <AppointmentScheduler doctorId={user?.id || ''} />
                    </div>
                )}
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

        </div>
    )
}
