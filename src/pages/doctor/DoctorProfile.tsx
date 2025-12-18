import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../components/AuthProvider'
import { User, Upload, Loader2, Save } from 'lucide-react'

export default function DoctorProfile() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Form State
    const [fullName, setFullName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [bio, setBio] = useState('')

    useEffect(() => {
        if (user) fetchProfile()
    }, [user])

    const fetchProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user?.id)
                .single()

            if (error) throw error

            if (data) {
                setFullName(data.full_name || '')
                setAvatarUrl(data.avatar_url)
                setBio(data.clinic_details?.bio || '')
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !user) return

        const file = event.target.files[0]
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        setUploading(true)
        try {
            // Upload
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)

            // Update State (Preview)
            setAvatarUrl(publicUrl)

            // Auto-save to profile
            await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id)

        } catch (error: any) {
            alert('Error uploading avatar: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async () => {
        if (!user) return
        setUpdating(true)
        try {
            // Need to merge with existing clinic_details to avoid overwriting other fields
            // First fetch current to be safe (or assume we have it via other context, but fetch is safer)
            const { data: currentData } = await supabase.from('profiles').select('clinic_details').eq('id', user.id).single()

            const updatedDetails = {
                ...currentData?.clinic_details,
                bio: bio
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    clinic_details: updatedDetails
                })
                .eq('id', user.id)

            if (error) throw error
            alert('Profile updated!')
        } catch (error: any) {
            alert('Error updating profile: ' + error.message)
        } finally {
            setUpdating(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Loading profile...</div>

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-20">
            <header>
                <h1 className="text-2xl font-bold text-slate-900">Doctor Profile</h1>
                <p className="text-slate-500">Manage your public appearance for patients.</p>
            </header>

            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-8">

                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 ring-4 ring-white shadow-lg">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <User size={48} />
                                </div>
                            )}
                        </div>
                        <label className="absolute bottom-0 right-0 p-2 bg-teal-600 text-white rounded-full cursor-pointer hover:bg-teal-700 transition-colors shadow-md">
                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarUpload}
                                disabled={uploading}
                            />
                        </label>
                    </div>
                    <p className="text-xs text-slate-400">
                        Click the icon to upload a new photo.
                    </p>
                </div>

                {/* Info Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Dr. John Doe"
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Bio / Specialization</label>
                        <textarea
                            rows={4}
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder="e.g. Senior Pediatrician with 10 years of experience..."
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={updating}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        {updating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>

            </div>
        </div>
    )
}
