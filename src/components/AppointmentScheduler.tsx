import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, Clock, Plus, Check, X, Stethoscope } from 'lucide-react'
import { useAuth } from './AuthProvider'

interface Appointment {
    id: string
    patient_name: string
    patient_phone: string
    appointment_time: string
    status: 'pending' | 'confirmed' | 'cancelled' | 'rejected' | 'completed'
    type: 'online' | 'offline'
    notes: string
}

interface AppointmentSchedulerProps {
    doctorId: string
    onAttend?: (appointment: Appointment) => void
}

export function AppointmentScheduler({ doctorId, onAttend }: AppointmentSchedulerProps) {
    const { user } = useAuth()
    const isDoctor = user?.id === doctorId

    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)
    const [showBookModal, setShowBookModal] = useState(false)
    const [filter, setFilter] = useState<'upcoming' | 'pending'>('upcoming')

    // Booking Form State
    const [bookName, setBookName] = useState('')
    const [bookPhone, setBookPhone] = useState('')
    const [bookDate, setBookDate] = useState('')
    const [bookTime, setBookTime] = useState('')
    const [bookNotes, setBookNotes] = useState('')
    const [booking, setBooking] = useState(false)

    useEffect(() => {
        fetchAppointments()
    }, [doctorId, filter])

    async function fetchAppointments() {
        setLoading(true)
        try {
            const today = new Date().toISOString().split('T')[0]

            let query = supabase
                .from('appointments')
                .select('*, patient:profiles!appointments_patient_id_fkey(full_name)')
                .eq('doctor_id', doctorId)
                .order('appointment_time', { ascending: true })

            if (filter === 'upcoming') {
                // Show confirmed upcoming and today's
                query = query
                    .gte('appointment_time', `${today}T00:00:00`)
                    .eq('status', 'confirmed') // Only show confirmed. Completed ones vanish (are 'deleted' from view)
            } else {
                // Show pending requests
                query = query.eq('status', 'pending')
            }

            const { data, error } = await query

            if (error) throw error

            // Map data to handle profile fallback
            const mappedAppointments = (data || []).map((apt: any) => ({
                ...apt,
                patient_name: apt.patient_name || apt.patient?.full_name || 'Unknown Patient',
                patient_phone: apt.patient_phone || ''
            }))

            setAppointments(mappedAppointments)
        } catch (err) {
            console.error('Error fetching appointments:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleStatusChange(id: string, newStatus: string) {
        try {
            await supabase.from('appointments').update({ status: newStatus }).eq('id', id)
            fetchAppointments()
        } catch (err) {
            console.error('Error updating status:', err)
        }
    }

    // Assistant Action: Pass appointment to parent to fill form
    function handleAttendWrapper(apt: Appointment) {
        if (onAttend) {
            onAttend(apt)
        }
    }

    // Confirming State
    const [confirmingAppointment, setConfirmingAppointment] = useState<Appointment | null>(null)
    const [confirmDate, setConfirmDate] = useState('')
    const [confirmTime, setConfirmTime] = useState('')

    async function handleBookOffline(e: React.FormEvent) {
        e.preventDefault()
        setBooking(true)
        try {
            // Combine date and time
            const timestamp = `${bookDate}T${bookTime}:00`

            const { error } = await supabase.from('appointments').insert({
                doctor_id: doctorId,
                patient_name: bookName,
                patient_phone: bookPhone,
                appointment_time: timestamp,
                status: 'confirmed', // Offline is auto-confirmed
                type: 'offline',
                notes: bookNotes
            })

            if (error) throw error

            setShowBookModal(false)
            setBookName('')
            setBookPhone('')
            setBookDate('')
            setBookTime('')
            setBookNotes('')
            fetchAppointments()
            alert('Appointment booked successfully!')
        } catch (err: any) {
            alert('Error booking: ' + err.message)
        } finally {
            setBooking(false)
        }
    }

    const openConfirmModal = (apt: Appointment) => {
        setConfirmingAppointment(apt)
        // Default to Today's Date and Current Time
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')

        setConfirmDate(`${year}-${month}-${day}`)
        setConfirmTime(`${hours}:${minutes}`)
    }

    const handleConfirmWithTime = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!confirmingAppointment) return

        try {
            // Create proper local datetime and convert to ISO
            const localDateTime = new Date(`${confirmDate}T${confirmTime}:00`)
            const timestamp = localDateTime.toISOString()

            const { error } = await supabase
                .from('appointments')
                .update({
                    status: 'confirmed',
                    appointment_time: timestamp
                })
                .eq('id', confirmingAppointment.id)

            if (error) throw error

            setConfirmingAppointment(null)
            fetchAppointments()
        } catch (err: any) {
            console.error('Error confirming:', err)
            alert('Error confirming: ' + err.message)
        }
    }

    return (
        <div className="space-y-4 pb-24">
            {/* Controls */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button
                    onClick={() => setFilter('upcoming')}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${filter === 'upcoming' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                >
                    Upcoming
                </button>
                <button
                    onClick={() => setFilter('pending')}
                    className={`relative px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${filter === 'pending' ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                >
                    Requests
                </button>
            </div>

            {/* List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : appointments.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-500">
                        <Calendar className="mx-auto mb-2 opacity-50" size={24} />
                        <p>No {filter} appointments.</p>
                    </div>
                ) : (
                    appointments.map(apt => (
                        <div key={apt.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-3 active:border-blue-200 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg">{apt.patient_name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                        <Clock size={15} className="text-blue-500" />
                                        {apt.appointment_time ? (
                                            <>
                                                <span className="font-medium text-slate-600">{new Date(apt.appointment_time).toLocaleDateString()}</span>
                                                <span>{new Date(apt.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </>
                                        ) : (
                                            <span className="font-medium text-slate-500 italic">Requested (Time not set)</span>
                                        )}
                                    </div>
                                    {apt.type === 'offline' && (
                                        <span className="inline-block mt-2 text-[10px] font-bold tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">
                                            Walk-in
                                        </span>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${apt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                        apt.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                        {apt.status}
                                    </span>
                                </div>
                            </div>

                            {/* Actions for Pending */}
                            {apt.status === 'pending' && (
                                <div className="grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-slate-50">
                                    <button
                                        onClick={() => openConfirmModal(apt)}
                                        className="bg-green-600 text-white py-3 rounded-lg text-sm font-bold shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <Check size={18} /> Confirm
                                    </button>
                                    <button
                                        onClick={() => handleStatusChange(apt.id, 'rejected')}
                                        className="bg-white border border-slate-200 text-slate-700 py-3 rounded-lg text-sm font-bold shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <X size={18} /> Reject
                                    </button>
                                </div>
                            )}

                            {/* Actions for Confirmed (Cancel or Attend) */}
                            {apt.status === 'confirmed' && (
                                <div className="mt-1 pt-2 border-t border-slate-50 flex gap-2">
                                    {/* Doctor just views, Assistant Attends */}
                                    {!isDoctor && onAttend && (
                                        <button
                                            onClick={() => handleAttendWrapper(apt)}
                                            className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            <Stethoscope size={18} /> Start Visit
                                        </button>
                                    )}

                                    <button
                                        onClick={() => {
                                            if (confirm('Cancel this appointment?')) handleStatusChange(apt.id, 'cancelled')
                                        }}
                                        className={`${!isDoctor && onAttend ? 'px-4' : 'w-full'} py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-semibold transition-colors`}
                                    >
                                        {!isDoctor && onAttend ? <X size={18} /> : 'Cancel Appointment'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* FAB for Booking (Assistants Only usually, or both?) */}
            {/* Let's show FAB for both just in case, but usually assistant manages schedule */}
            <button
                onClick={() => setShowBookModal(true)}
                className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all z-30"
            >
                <Plus size={32} />
            </button>

            {/* Offline Booking Modal - Mobile Full Screen */}
            {showBookModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm">
                    <div className="bg-white w-full h-[90dvh] sm:h-auto sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl shrink-0">
                            <h3 className="font-bold text-slate-800 text-lg">Book Appointment</h3>
                            <button onClick={() => setShowBookModal(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 safe-pb">
                            <form onSubmit={handleBookOffline} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Patient Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-lg"
                                        placeholder="Full Name"
                                        value={bookName}
                                        onChange={e => setBookName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone (Optional)</label>
                                    <input
                                        type="tel"
                                        className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-lg"
                                        placeholder="Mobile Number"
                                        value={bookPhone}
                                        onChange={e => setBookPhone(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Date</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-base"
                                            value={bookDate}
                                            onChange={e => setBookDate(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Time</label>
                                        <input
                                            type="time"
                                            required
                                            className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-base"
                                            value={bookTime}
                                            onChange={e => setBookTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Notes</label>
                                    <textarea
                                        className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white min-h-[100px] text-base"
                                        placeholder="Add any details..."
                                        value={bookNotes}
                                        onChange={e => setBookNotes(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={booking}
                                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all"
                                >
                                    {booking ? 'Booking...' : 'Confirm Booking'}
                                </button>
                                <div className="h-4"></div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Confirm Modal */}
            {confirmingAppointment && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Confirm Appointment</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Set the final time for <strong>{confirmingAppointment.patient_name}</strong>.
                        </p>

                        <form onSubmit={handleConfirmWithTime} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                                    value={confirmDate}
                                    onChange={e => setConfirmDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Time</label>
                                <input
                                    type="time"
                                    required
                                    className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                                    value={confirmTime}
                                    onChange={e => setConfirmTime(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setConfirmingAppointment(null)}
                                    className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200"
                                >
                                    Confirm
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
