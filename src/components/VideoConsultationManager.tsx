import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Video, Clock, Check, X, User } from 'lucide-react'
import clsx from 'clsx'

interface Appointment {
    id: string
    patient_name: string
    patient_phone: string
    appointment_time: string | null
    status: 'pending' | 'confirmed' | 'cancelled' | 'rejected' | 'completed'
    type: 'online' | 'offline'
    notes: string
    doctor_peer_id?: string
    patient_peer_id?: string
}

interface VideoConsultationManagerProps {
    doctorId: string
}

export function VideoConsultationManager({ doctorId }: VideoConsultationManagerProps) {
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'requests' | 'scheduled'>('requests')

    // Confirm Modal State
    const [confirmingApt, setConfirmingApt] = useState<Appointment | null>(null)
    const [confirmDate, setConfirmDate] = useState('')
    const [confirmTime, setConfirmTime] = useState('')

    useEffect(() => {
        fetchAppointments()
    }, [doctorId, activeTab])

    async function fetchAppointments() {
        setLoading(true)
        try {
            // Base query for ONLINE appointments only
            let query = supabase
                .from('appointments')
                // Using the specific FK name to ensure join works, as seen in AppointmentScheduler fix
                .select('*, patient:profiles!appointments_patient_id_fkey(full_name)')
                .eq('doctor_id', doctorId)
                .eq('type', 'online')
                .order('created_at', { ascending: true }) // Oldest requests first

            if (activeTab === 'requests') {
                query = query.eq('status', 'pending')
            } else {
                // Scheduled: confirmed or completed
                query = query.in('status', ['confirmed', 'completed'])
                    .order('appointment_time', { ascending: true })
            }

            const { data, error } = await query

            if (error) throw error

            const mapped = (data || []).map((apt: any) => ({
                ...apt,
                // Robust fallback for patient name
                patient_name: apt.patient_name || apt.patient?.full_name || 'Unknown Patient'
            }))

            setAppointments(mapped)
        } catch (err) {
            console.error('Error fetching video appointments:', err)
        } finally {
            setLoading(false)
        }
    }

    const openConfirmModal = (apt: Appointment) => {
        setConfirmingApt(apt)
        // Default to now
        const now = new Date()
        setConfirmDate(now.toISOString().split('T')[0])
        setConfirmTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
    }

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!confirmingApt) return

        try {
            const timestamp = new Date(`${confirmDate}T${confirmTime}:00`).toISOString()

            await supabase
                .from('appointments')
                .update({
                    status: 'confirmed',
                    appointment_time: timestamp
                })
                .eq('id', confirmingApt.id)

            setConfirmingApt(null)
            fetchAppointments()
        } catch (err) {
            console.error(err)
            alert('Error confirming appointment')
        }
    }

    const handleReject = async (id: string) => {
        if (!confirm('Reject this video request?')) return
        try {
            await supabase.from('appointments').update({ status: 'rejected' }).eq('id', id)
            fetchAppointments()
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
            {/* Header / Tabs */}
            <div className="border-b border-slate-100 bg-slate-50 p-1 flex gap-1">
                <button
                    onClick={() => setActiveTab('requests')}
                    className={clsx(
                        "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                        activeTab === 'requests'
                            ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                    )}
                >
                    <User size={18} />
                    Pending Requests
                    {/* Badge could go here */}
                </button>
                <button
                    onClick={() => setActiveTab('scheduled')}
                    className={clsx(
                        "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                        activeTab === 'scheduled'
                            ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                    )}
                >
                    <Video size={18} />
                    Scheduled Calls
                </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                        <p>Loading video appointments...</p>
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                            {activeTab === 'requests' ? <User size={32} className="opacity-20" /> : <Video size={32} className="opacity-20" />}
                        </div>
                        <p>No {activeTab} found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {appointments.map(apt => (
                            <div key={apt.id} className="group bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow relative overflow-hidden">
                                {apt.status === 'confirmed' && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
                                )}
                                {apt.status === 'pending' && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />
                                )}

                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pl-3">
                                    {/* Patient Info */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-900 text-lg">{apt.patient_name}</h3>
                                            <span className={clsx(
                                                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                                apt.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                    apt.status === 'confirmed' ? "bg-green-100 text-green-700" :
                                                        "bg-slate-100 text-slate-600"
                                            )}>
                                                {apt.status}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                            {/* Time Display with improved logic */}
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-teal-600" />
                                                {apt.appointment_time ? (
                                                    <span className="font-medium text-slate-700">
                                                        {new Date(apt.appointment_time).toLocaleDateString()} at {new Date(apt.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                ) : (
                                                    <span className="italic text-amber-600">Requested - Time not set</span>
                                                )}
                                            </div>

                                            {/* Connection Status Helper */}
                                            {apt.status === 'confirmed' && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <div className={clsx("w-2 h-2 rounded-full", (apt.patient_peer_id && apt.doctor_peer_id) ? "bg-green-500" : "bg-slate-300")} />
                                                    {(apt.patient_peer_id && apt.doctor_peer_id) ? "Ready to Connect" : "Waiting for participants"}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        {apt.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => openConfirmModal(apt)}
                                                    className="flex-1 sm:flex-none py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                                                >
                                                    <Check size={16} /> Confirm
                                                </button>
                                                <button
                                                    onClick={() => handleReject(apt.id)}
                                                    className="flex-1 sm:flex-none py-2 px-4 bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <X size={16} /> Reject
                                                </button>
                                            </>
                                        )}

                                        {apt.status === 'confirmed' && (
                                            <button className="flex-1 sm:flex-none py-2 px-4 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-sm font-medium flex items-center justify-center gap-2 cursor-default">
                                                <Video size={16} /> Scheduled
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Confirm Modal */}
            {confirmingApt && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-slate-800">Schedule Video Consult</h3>
                            <p className="text-xs text-slate-500">For {confirmingApt.patient_name}</p>
                        </div>
                        <form onSubmit={handleConfirm} className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Date</label>
                                <input
                                    type="date"
                                    required
                                    value={confirmDate}
                                    onChange={e => setConfirmDate(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Time</label>
                                <input
                                    type="time"
                                    required
                                    value={confirmTime}
                                    onChange={e => setConfirmTime(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setConfirmingApt(null)}
                                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-200 transition-colors"
                                >
                                    Confirm Schedule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
