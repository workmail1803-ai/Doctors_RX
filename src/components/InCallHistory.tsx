import { useState, useEffect } from 'react'
import { FileText, Eye, Calendar, X, Pill } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function InCallHistory({ patientId, onClose }: { patientId?: string, onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<'reports' | 'prescriptions'>('reports')
    const [reports, setReports] = useState<any[]>([])
    const [prescriptions, setPrescriptions] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchData()
    }, [activeTab])

    const fetchData = async () => {
        setLoading(true)
        // If we don't have a patientId (e.g. widely open), we might fetch recent or all.
        // Ideally we filter by the patient in the call.
        // For now, fetching ALL for demonstration if patientId is missing, logic to be refined.

        if (activeTab === 'reports') {
            let q = supabase.from('patient_reports').select('*, profiles:patient_id(full_name)').order('created_at', { ascending: false })
            if (patientId) q = q.eq('patient_id', patientId)
            const { data } = await q
            if (data) setReports(data)
        } else {
            let q = supabase.from('prescriptions').select('*').order('created_at', { ascending: false })
            if (patientId) q = q.eq('patient_id', patientId)
            const { data } = await q
            if (data) setPrescriptions(data)
        }
        setLoading(false)
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">Patient History</h3>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'reports' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                >
                    Reports
                </button>
                <button
                    onClick={() => setActiveTab('prescriptions')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'prescriptions' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                >
                    Prescriptions
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                {loading ? (
                    <div className="text-center py-8 text-slate-400">Loading...</div>
                ) : (
                    <>
                        {activeTab === 'reports' && (
                            <div className="space-y-3">
                                {reports.map(r => (
                                    <div key={r.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <FileText className="text-teal-600" size={20} />
                                            <div>
                                                <p className="font-medium text-sm text-slate-900">{r.title}</p>
                                                <p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <a href={r.file_url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-semibold hover:underline">View</a>
                                    </div>
                                ))}
                                {reports.length === 0 && <p className="text-center text-slate-400 text-sm">No reports found.</p>}
                            </div>
                        )}

                        {activeTab === 'prescriptions' && (
                            <div className="space-y-3">
                                {prescriptions.map(p => (
                                    <div key={p.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Pill className="text-blue-600" size={20} />
                                            <div>
                                                <p className="font-medium text-sm text-slate-900">{p.patient_name}</p>
                                                <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => window.open(`/print/${p.id}`, '_blank')} className="text-blue-600 text-xs font-semibold hover:underline">View</button>
                                    </div>
                                ))}
                                {prescriptions.length === 0 && <p className="text-center text-slate-400 text-sm">No prescriptions found.</p>}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
