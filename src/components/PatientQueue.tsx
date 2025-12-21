import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Clock, ArrowRight } from 'lucide-react'

export function PatientQueue() {
    const navigate = useNavigate()
    const [pendingPatients, setPendingPatients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchQueue()

        // Subscribe to changes? For now just fetch on load.
        // Realtime would be nice but simple fetch is fine.
    }, [])

    async function fetchQueue() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('prescriptions')
            .select('*')
            .eq('doctor_id', user.id) // RLS enforces this anyway
            .eq('status', 'pending')
            .order('created_at', { ascending: true }) // Oldest first (FIFO)

        if (!error && data) {
            setPendingPatients(data)
        }
        setLoading(false)
    }

    if (loading) return null
    if (pendingPatients.length === 0) return null

    return (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden mb-8">
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                <h3 className="font-semibold text-amber-900 flex items-center gap-2">
                    <Clock size={20} />
                    Pending Patient Queue
                </h3>
                <span className="bg-amber-200 text-amber-800 text-xs px-2 py-1 rounded-full font-bold">
                    {pendingPatients.length} Waiting
                </span>
            </div>

            <div className="divide-y divide-amber-100">
                {pendingPatients.map(p => (
                    <div
                        key={p.id}
                        onClick={() => navigate(`/write?id=${p.id}`)}
                        className="p-4 hover:bg-amber-50 transition-colors cursor-pointer flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
                                {p.patient_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-slate-900">{p.patient_name}</div>
                                <div className="text-xs text-slate-500 flex gap-2">
                                    <span>{p.patient_info?.age} yrs</span>
                                    <span>•</span>
                                    <span>{p.patient_info?.sex}</span>
                                    {p.patient_info?.bp && (
                                        <>
                                            <span>•</span>
                                            <span className="font-semibold text-amber-700">BP: {p.patient_info.bp}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-sm font-medium mr-2">Attend</span>
                            <ArrowRight size={16} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
