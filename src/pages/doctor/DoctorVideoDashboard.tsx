import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Video, Calendar, Clock, User } from 'lucide-react'
import { useAuth } from '../../components/AuthProvider'

export default function DoctorVideoDashboard() {
    const { user } = useAuth()
    const [appointments, setAppointments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (user) fetchAppointments()
    }, [user])

    const fetchAppointments = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select('*, profiles:patient_id(full_name)')
                .eq('doctor_id', user?.id)
                .order('created_at', { ascending: false })

            if (data) console.log('Doctor appointments:', data)
            if (error) throw error
            setAppointments(data)
        } catch (error) {
            console.error('Error fetching appointments:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Loading appointments...</div>

    return (
        <div className="space-y-6 p-6">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Video className="text-teal-600" />
                Video Consultations
            </h1>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {appointments.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <Video size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No appointments found.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {appointments.map(app => (
                            <div key={app.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-lg text-slate-900">
                                                {app.profiles?.full_name || 'Patient'}
                                            </h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${app.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                {app.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={14} />
                                                {new Date(app.created_at).toLocaleDateString()}
                                            </span>
                                            {app.scheduled_at && (
                                                <span className="flex items-center gap-1">
                                                    <Clock size={14} />
                                                    {new Date(app.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {app.status === 'approved' ? (
                                    (() => {
                                        if (!app.scheduled_at) return (
                                            <Link to={`/video-call/${app.id}`} className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-lg shadow-teal-600/20 font-medium transition-all flex items-center gap-2">
                                                <Video size={18} /> Join Call (Anytime)
                                            </Link>
                                        )

                                        const scheduled = new Date(app.scheduled_at)
                                        const endTime = new Date(scheduled.getTime() + 30 * 60 * 1000)
                                        const isExpired = currentTime.getTime() > endTime.getTime()

                                        // Optional: Doctor can verify earlier, but patient cannot? 
                                        // Usually doctor should be able to join 5 mins early.
                                        const isTooEarly = currentTime.getTime() < (scheduled.getTime() - 5 * 60 * 1000)

                                        if (isExpired) {
                                            return (
                                                <button disabled className="px-6 py-2.5 bg-red-50 text-red-400 border border-red-100 rounded-lg cursor-not-allowed font-medium flex items-center gap-2">
                                                    <Video size={18} /> Call Expired
                                                </button>
                                            )
                                        }

                                        if (isTooEarly) {
                                            return (
                                                <button disabled className="px-6 py-2.5 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed font-medium flex items-center gap-2">
                                                    <Clock size={18} /> Wait for time
                                                </button>
                                            )
                                        }

                                        return (
                                            <Link
                                                to={`/video-call/${app.id}`}
                                                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-lg shadow-teal-600/20 font-medium transition-all flex items-center gap-2 animate-pulse"
                                            >
                                                <Video size={18} />
                                                Join Call
                                            </Link>
                                        )
                                    })()
                                ) : (
                                    <button disabled className="px-6 py-2.5 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed font-medium flex items-center gap-2">
                                        <Video size={18} />
                                        Join Call
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
