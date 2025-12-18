import { useState, useEffect } from 'react'
import { FileText, Upload, Trash2, Eye, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

type Report = {
    id: string
    title: string
    file_url: string
    file_type: string
    created_at: string
}

export default function PatientReports() {
    const { user } = useAuth()
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [showUploadModal, setShowUploadModal] = useState(false)

    // Form State
    const [title, setTitle] = useState('')
    const [file, setFile] = useState<File | null>(null)

    useEffect(() => {
        if (user) fetchReports()
    }, [user])

    const fetchReports = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('patient_reports')
            .select('*')
            .eq('patient_id', user?.id)
            .order('created_at', { ascending: false })

        if (data) setReports(data)
        setLoading(false)
    }

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file || !user || !title) return

        setUploading(true)
        try {
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}/${Date.now()}.${fileExt}`
            const { error: uploadError } = await supabase.storage
                .from('reports')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('reports')
                .getPublicUrl(fileName)

            // 2. Insert into Table
            const { error: dbError } = await supabase.from('patient_reports').insert({
                patient_id: user.id,
                title: title,
                file_url: publicUrl,
                file_type: file.type
            })

            if (dbError) throw dbError

            // Reset
            setTitle('')
            setFile(null)
            setShowUploadModal(false)
            fetchReports()
            alert('Report uploaded successfully!')

        } catch (error: any) {
            console.error(error)
            alert('Upload failed: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this report?')) return

        try {
            // Delete from DB (Row)
            const { error } = await supabase.from('patient_reports').delete().eq('id', id)
            if (error) throw error

            setReports(prev => prev.filter(r => r.id !== id))
        } catch (error: any) {
            alert('Delete failed: ' + error.message)
        }
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="text-teal-600" />
                    My Reports
                </h2>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors"
                >
                    <Upload size={16} /> Upload New
                </button>
            </div>

            {loading ? (
                <div className="text-center py-8 text-slate-500">Loading reports...</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {reports.map(report => (
                        <div key={report.id} className="group relative flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-teal-200 hover:shadow-sm transition-all">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 bg-white rounded-lg text-slate-400 group-hover:text-teal-600 transition-colors">
                                    <FileText size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-medium text-slate-900 truncate">{report.title}</h3>
                                    <p className="text-xs text-slate-500">{new Date(report.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={report.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="View"
                                >
                                    <Eye size={18} />
                                </a>
                                <button
                                    onClick={() => handleDelete(report.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {reports.length === 0 && (
                        <div className="col-span-full text-center py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
                            No reports uploaded yet. Upload your test results or prescriptions here.
                        </div>
                    )}
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900">Upload Report</h3>
                            <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Report Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g., Blood Test Dec 2024"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Attach File</label>
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:bg-slate-50 hover:border-teal-400 transition-colors text-center cursor-pointer relative">
                                    <input
                                        type="file"
                                        onChange={e => setFile(e.target.files?.[0] || null)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept="image/*,.pdf"
                                        required
                                    />
                                    <div className="space-y-2 pointer-events-none">
                                        <div className="inline-flex p-3 bg-teal-50 text-teal-600 rounded-full">
                                            <Upload size={24} />
                                        </div>
                                        <p className="text-sm text-slate-600 font-medium">
                                            {file ? file.name : 'Click to browse or drag file'}
                                        </p>
                                        <p className="text-xs text-slate-400">PDF, JPG, PNG up to 10MB</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={uploading}
                                className="w-full py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 active:scale-95 transition-all shadow-lg shadow-teal-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {uploading && <Loader2 className="animate-spin" />}
                                {uploading ? 'Uploading...' : 'Upload Report'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
