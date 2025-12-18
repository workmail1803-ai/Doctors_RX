import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Video, Calendar, Clock } from 'lucide-react'
import { useAuth } from '../../components/AuthProvider'
import PatientReports from '../../components/PatientReports'
import { type Appointment } from '../../types'

type DoctorProfile = {
    id: string
    full_name: string
    clinic_details: any
    avatar_url?: string
}

export default function PatientDashboard() {
    const { user } = useAuth()
    const [doctors, setDoctors] = useState<DoctorProfile[]>([])
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        // Update time every 30 seconds to refresh button states
        const timer = setInterval(() => setCurrentTime(new Date()), 30000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        fetchData()
    }, [user])

    const fetchData = async () => {
        if (!user) return
        setLoading(true)
        try {
            // Fetch Doctors
            const { data: docs } = await supabase.rpc('get_active_doctors')
            if (docs) setDoctors(docs)

            // Fetch My Appointments
            const { data: apps } = await supabase
                .from('appointments')
                .select('*')
                .eq('patient_id', user.id)
                .order('created_at', { ascending: false })

            if (apps) setAppointments(apps as Appointment[])

        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const requestAppointment = async (doctorId: string) => {
        if (!user) return
        try {
            const { error } = await supabase.from('appointments').insert({
                patient_id: user.id,
                doctor_id: doctorId,
                status: 'pending'
            })
            if (error) throw error
            alert('Appointment requested!')
            fetchData()
        } catch (error: any) {
            alert('Error requesting appointment: ' + error.message)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading your health data...</div>
    }

    return (
        <div className="space-y-6">
            <PatientReports />

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Video className="text-teal-600" />
                    Available Doctors
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {doctors.map(doc => (
                        <div key={doc.id} className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow flex flex-col items-center text-center">
                            <div className="w-20 h-20 rounded-full bg-slate-100 mb-3 overflow-hidden">
                                {doc.avatar_url ? (
                                    <img src={doc.avatar_url} alt={doc.full_name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-2xl">
                                        {doc.full_name?.[0] || 'D'}
                                    </div>
                                )}
                            </div>
                            <h3 className="font-semibold text-lg">{doc.full_name || 'Unknown Doctor'}</h3>
                            <p className="text-sm text-slate-500 mb-4">{doc.clinic_details?.bio || 'General Practice'}</p>
                            <button
                                onClick={() => requestAppointment(doc.id)}
                                className="w-full py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                            >
                                Request Video Consult
                            </button>
                        </div>
                    ))}
                    {doctors.length === 0 && <p className="text-slate-500">No doctors currently available.</p>}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar className="text-blue-600" />
                    My Appointments
                </h2>
                <div className="space-y-3">
                    {appointments.map(app => (
                        <div key={app.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                            <div>
                                <p className="font-medium text-slate-900">
                                    Appointment with {doctors.find(d => d.id === app.doctor_id)?.full_name || 'Doctor'}
                                </p>
                                <p className="text-sm text-slate-500">
                                    Status: <span className={`font-semibold capitalize ${app.status === 'approved' ? 'text-green-600' :
                                        app.status === 'pending' ? 'text-amber-600' : 'text-red-600'
                                        }`}>{app.status}</span>
                                </p>
                                {app.scheduled_at && (
                                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                                        <Clock size={12} /> {new Date(app.scheduled_at).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            {app.status === 'approved' && (
                                (() => {
                                    // Use currentTime state to ensure updates
                                    const scheduled = app.scheduled_at ? new Date(app.scheduled_at) : new Date()
                                    // STRICT: diff > 0 means scheduled is in future.
                                    const diff = scheduled.getTime() - currentTime.getTime()

                                    // If diff is positive, it's too early.
                                    const isTooEarly = diff > 0

                                    // Calculate friendly "wait time" string
                                    const minutesWait = Math.ceil(diff / 60000)

                                    console.log(`App ${app.id}: Scheduled: ${scheduled.toISOString()}, Now: ${currentTime.toISOString()}, isTooEarly: ${isTooEarly}`)

                                    // 30 minute slot
                                    const slotDuration = 30 * 60 * 1000
                                    const endTime = new Date(scheduled.getTime() + slotDuration)
                                    const isExpired = currentTime.getTime() > endTime.getTime()

                                    console.log(`App ${app.id}: Ends: ${endTime.toISOString()}, Expired: ${isExpired}`)

                                    if (isExpired) {
                                        return (
                                            <button disabled className="px-4 py-2 bg-red-50 text-red-400 text-sm rounded-lg cursor-not-allowed inline-block text-center min-w-[120px] font-medium border border-red-100">
                                                Call Not Available
                                            </button>
                                        )
                                    }

                                    if (isTooEarly) {
                                        return (
                                            <button disabled className="px-4 py-2 bg-slate-300 text-slate-500 text-sm rounded-lg cursor-not-allowed inline-block text-center min-w-[120px]">
                                                {minutesWait > 60
                                                    ? `On ${scheduled.toLocaleDateString()}`
                                                    : `Starts in ${minutesWait} min`
                                                }
                                            </button>
                                        )
                                    }

                                    return (
                                        <Link to={`/video-call/${app.id}`} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-600/20 inline-block text-center animate-pulse">
                                            Join Call
                                        </Link>
                                    )
                                })()
                            )}
                        </div>
                    ))}
                    {appointments.length === 0 && <p className="text-slate-500">No appointments yet.</p>}
                </div>
            </div>
        </div>
    )
}
