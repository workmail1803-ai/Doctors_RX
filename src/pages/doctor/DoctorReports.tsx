import { useState, useEffect } from 'react'
import { FileText, Eye, User, Calendar, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'

type Report = {
    id: string
    title: string
    file_url: string
    file_type: string
    created_at: string
    patient_id: string
    profiles: {
        full_name: string
    }
}

export default function DoctorReports() {
    const { user } = useAuth()
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        if (user) fetchReports()
    }, [user])

    const fetchReports = async () => {
        setLoading(true)
        // Note: This relies on a Join query. Ensure generic RLS allows this or use a more specific RPC if strict RLS is on.
        // For now we assume standard select RLS allows doctor to see all reports.
        const { data, error } = await supabase
            .from('patient_reports')
            .select(`
                *,
                profiles:patient_id (full_name)
            `)
            .order('created_at', { ascending: false })

        if (error) console.error(error)
        if (data) setReports(data as any)
        setLoading(false)
    }

    const filteredReports = reports.filter(r =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6 pb-20">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="text-blue-600" />
                        Patient Reports
                    </h2>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search patient or report..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-slate-500">Loading reports...</div>
                ) : (
                    <div className="grid gap-4">
                        {filteredReports.map(report => (
                            <div key={report.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-lg text-blue-600 shadow-sm">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">{report.title}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <User size={14} /> {report.profiles?.full_name || 'Unknown Patient'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar size={14} /> {new Date(report.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <a
                                    href={report.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                                >
                                    <Eye size={18} /> <span className="hidden md:inline">View</span>
                                </a>
                            </div>
                        ))}
                        {filteredReports.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                No reports found.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
