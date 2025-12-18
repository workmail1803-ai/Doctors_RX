import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Printer, Copy, FileText, Loader2, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import type { Prescription } from '../types'
import clsx from 'clsx'

export default function History() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [searchTerm, setSearchTerm] = useState('')
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
    const [loading, setLoading] = useState(true)
    const [limit, setLimit] = useState(20)

    useEffect(() => {
        if (!user) return

        const fetchHistory = async () => {
            setLoading(true)
            try {
                let query = supabase
                    .from('prescriptions')
                    .select('*')
                    .eq('doctor_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(limit)

                if (searchTerm) {
                    query = query.ilike('patient_name', `%${searchTerm}%`)
                }

                const { data, error } = await query

                if (error) throw error
                setPrescriptions(data || [])
            } catch (err) {
                console.error('Error fetching history:', err)
            } finally {
                setLoading(false)
            }
        }

        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchHistory()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [user, searchTerm, limit])

    const handleClone = (rx: Prescription) => {
        // Navigate to write page with this prescription data
        navigate('/write', { state: { cloneData: rx } })
    }

    const formatDate = (dateString: string) => {
        const d = new Date(dateString)
        const now = new Date()
        const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

        if (diffInSeconds < 60) return 'Just now'
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header & Search */}
            <div className="sticky top-0 bg-slate-50 pt-2 pb-4 z-10 space-y-4">
                <div className="flex items-center justify-between px-2">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Patient History</h1>
                        <p className="text-slate-500 text-sm">Track and manage past prescriptions</p>
                    </div>
                </div>

                <div className="relative px-2">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by patient name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border-0 shadow-sm ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all font-medium text-slate-700"
                    />
                </div>
            </div>

            {/* List */}
            {loading && prescriptions.length === 0 ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-teal-600" size={32} />
                </div>
            ) : (
                <div className="space-y-4 px-2">
                    {prescriptions.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileText className="text-slate-300" size={32} />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">No History Found</h3>
                            <p className="text-slate-500 mt-1">Start writing prescriptions to see them here.</p>
                        </div>
                    ) : (
                        prescriptions.map((rx) => (
                            <div
                                key={rx.id}
                                className="group bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden"
                            >
                                {/* Left Accent Stripe */}
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500/80 rounded-l-2xl" />

                                <div className="flex items-start justify-between mb-3 pl-2">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 leading-tight group-hover:text-teal-700 transition-colors">
                                            {rx.patient_name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1.5 text-xs font-medium text-slate-500">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                                {rx.patient_info?.age || 'Age N/A'}
                                            </span>
                                            {rx.patient_info?.sex && (
                                                <>
                                                    <span>•</span>
                                                    <span className={clsx(
                                                        rx.patient_info.sex === 'Male' ? 'text-blue-500' :
                                                            rx.patient_info.sex === 'Female' ? 'text-pink-500' : 'text-slate-500'
                                                    )}>
                                                        {rx.patient_info.sex}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                        <Clock size={12} />
                                        {formatDate(rx.created_at)}
                                    </div>
                                </div>

                                {/* Content Preview */}
                                <div className="pl-2 mb-4 space-y-1.5">
                                    {(rx.patient_info?.provisional_diagnosis || (rx.diseases && rx.diseases.length > 0)) ? (
                                        <div className="text-sm text-slate-600 line-clamp-2">
                                            <span className="font-semibold text-slate-400 uppercase text-xs tracking-wider mr-2">Diagnosis</span>
                                            {rx.patient_info?.provisional_diagnosis || rx.diseases.map(d => d.name).join(', ')}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-slate-400 italic">No diagnosis recorded</div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pl-2 mt-2 pt-3 border-t border-slate-50">
                                    <button
                                        onClick={() => navigate(`/print/${rx.id}`)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors active:scale-95"
                                    >
                                        <Printer size={16} /> Print
                                    </button>
                                    <button
                                        onClick={() => handleClone(rx)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-50 text-teal-700 rounded-xl text-sm font-semibold hover:bg-teal-100 transition-colors active:scale-95"
                                    >
                                        <Copy size={16} /> Re-Prescribe
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Load More Trigger */}
                    {!loading && prescriptions.length >= limit && (
                        <button
                            onClick={() => setLimit(l => l + 20)}
                            className="w-full py-4 text-center text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors"
                        >
                            Load More History...
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
