import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Check, X } from 'lucide-react'
import { type Appointment } from '../../types'

export default function AssistantDashboard() {
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAppointments()
    }, [])

    const fetchAppointments = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select('*, profiles:patient_id(full_name)') // Join to get patient details
                .order('created_at', { ascending: false })

            if (error) throw error
            setAppointments(data as any[])
        } catch (error) {
            console.error('Error fetching appointments:', error)
        } finally {
            setLoading(false)
        }
    }

    const updateStatus = async (id: string, status: 'approved' | 'rejected', scheduledDate?: string) => {
        try {
            const updates: any = { status }
            if (status === 'approved') {
                updates.scheduled_at = scheduledDate || new Date().toISOString()
            }

            const { error } = await supabase
                .from('appointments')
                .update(updates)
                .eq('id', id)

            if (error) throw error
            fetchAppointments()
        } catch (error) {
            console.error('Error updating appointment:', error)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading appointments...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Appointment Requests</h1>
                <button onClick={fetchAppointments} className="text-sm text-blue-600 hover:underline">
                    Refresh
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Patient</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Requested</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {appointments.map((app: any) => (
                            <tr key={app.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-slate-900">
                                        {app.profiles?.full_name || 'Unknown Patient'}
                                    </div>
                                    <div className="text-xs text-slate-500">ID: {app.patient_id.slice(0, 8)}...</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {new Date(app.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${app.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {app.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {app.status === 'pending' && (
                                        <div className="flex items-center justify-end gap-2">
                                            {/* Date Picker for Scheduling */}
                                            <input
                                                type="datetime-local"
                                                className="border border-slate-300 rounded px-2 py-1 text-xs"
                                                id={`date-${app.id}`}
                                                defaultValue={(() => {
                                                    const now = new Date()
                                                    now.setMinutes(now.getMinutes() + 10) // 10 mins future
                                                    // Convert to local ISO string for input: YYYY-MM-DDTHH:mm
                                                    const offset = now.getTimezoneOffset() * 60000
                                                    const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16)
                                                    return localISOTime
                                                })()}
                                            />
                                            <button
                                                onClick={() => {
                                                    const dateInput = document.getElementById(`date-${app.id}`) as HTMLInputElement
                                                    const dateVal = dateInput?.value ? new Date(dateInput.value).toISOString() : new Date().toISOString()
                                                    updateStatus(app.id, 'approved', dateVal)
                                                }}
                                                className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded-full hover:bg-green-100 transition-colors"
                                                title="Approve & Schedule"
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button
                                                onClick={() => updateStatus(app.id, 'rejected')}
                                                className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-full hover:bg-red-100 transition-colors"
                                                title="Reject"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {appointments.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        No appointments found.
                    </div>
                )}
            </div>
        </div>
    )
}
