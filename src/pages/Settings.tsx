import { useState, useEffect } from 'react'
import { Upload, Loader2, FileImage, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'

export default function Settings() {
    const { user } = useAuth()
    const [uploading, setUploading] = useState(false)
    const [templateUrl, setTemplateUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) return

        const fetchSettings = async () => {
            try {
                // 1. Get existing template URL from DB
                const { data } = await supabase
                    .from('prescription_templates')
                    .select('background_pdf_path')
                    .eq('doctor_id', user?.id)
                    .maybeSingle()

                if (data?.background_pdf_path) {
                    setTemplateUrl(data.background_pdf_path)
                }
            } catch (error) {
                const err = error as Error
                console.error('Error fetching settings:', err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchSettings()
    }, [user])

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !user) {
            return
        }

        const file = event.target.files[0]
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/template-${Date.now()}.${fileExt}`

        setUploading(true)
        try {
            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('templates')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('templates')
                .getPublicUrl(fileName)

            // 3. Update DB
            const { data: existing } = await supabase
                .from('prescription_templates')
                .select('id')
                .eq('doctor_id', user.id)
                .maybeSingle()

            let dbError
            if (existing) {
                const { error } = await supabase
                    .from('prescription_templates')
                    .update({ background_pdf_path: publicUrl })
                    .eq('id', existing.id)
                dbError = error
            } else {
                const { error } = await supabase
                    .from('prescription_templates')
                    .insert({
                        doctor_id: user.id,
                        background_pdf_path: publicUrl
                    })
                dbError = error
            }

            if (dbError) throw dbError

            setTemplateUrl(publicUrl)
            alert('Template uploaded successfully!')

        } catch (error: unknown) {
            const err = error as Error
            alert('Error uploading template: ' + err.message)
        } finally {
            setUploading(false)
        }
    }

    const handleDeleteTemplate = async () => {
        if (!user || !templateUrl) return
        if (!confirm('Are you sure you want to delete this template?')) return

        setUploading(true)
        try {
            const { error } = await supabase
                .from('prescription_templates')
                .update({ background_pdf_path: null })
                .eq('doctor_id', user.id)

            if (error) throw error
            setTemplateUrl(null)
        } catch (error: unknown) {
            const err = error as Error
            alert('Error deleting template: ' + err.message)
        } finally {
            setUploading(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Loading settings...</div>

    return (
        <div className="max-w-2xl mx-auto p-6 md:p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800 mb-2">Prescription Template</h2>
                    <p className="text-sm text-slate-500">Upload your clinic letterhead (Image/PNG/JPG) to use as a background for printed prescriptions.</p>
                </div>

                <div className="p-8 flex flex-col items-center justify-center gap-6">
                    {/* Preview Area */}
                    <div className="relative w-full aspect-[210/297] max-w-[300px] border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
                        {templateUrl ? (
                            <img
                                src={templateUrl}
                                alt="Template Preview"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="text-center p-4">
                                <FileImage className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                <span className="text-slate-400 text-sm">No template uploaded</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {templateUrl ? (
                        <div className="flex gap-4">
                            <label className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium bg-white">
                                <Upload size={16} /> Change
                                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                            </label>
                            <button onClick={handleDeleteTemplate} disabled={uploading} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium">
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    ) : (
                        <label className="btn-primary cursor-pointer">
                            {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                            <span>Upload Letterhead Image</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleUpload}
                                disabled={uploading}
                            />
                        </label>
                    )}

                    <div className="text-xs text-slate-400 text-center max-w-xs">
                        Recommended: A4 size image (2480 x 3508 px) for best print quality.
                        <br />
                        Supports: JPG, PNG.
                    </div>
                </div>
            </div>

            <style>{`
                .btn-primary { @apply flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium shadow-lg shadow-slate-900/20 active:translate-y-0.5; }
            `}</style>
        </div>
    )
}
