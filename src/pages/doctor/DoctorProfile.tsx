import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../components/AuthProvider'
import { User, Upload, Loader2, Save, MapPin, Plus, Trash2, Clock } from 'lucide-react'

type Chamber = {
    id: string
    name: string
    address: string
    visiting_hours: string
}

export default function DoctorProfile() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Form State
    const [fullName, setFullName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [bio, setBio] = useState('')

    // Chamber State
    const [chambers, setChambers] = useState<Chamber[]>([])
    const [newChamber, setNewChamber] = useState<Partial<Chamber>>({})
    const [isAddingChamber, setIsAddingChamber] = useState(false)

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
                setChambers(data.clinic_details?.chambers || [])
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

    const handleAddChamber = () => {
        if (!newChamber.name || !newChamber.address) {
            alert('Please fill in at least the Name and Address.')
            return
        }

        const chamber: Chamber = {
            id: crypto.randomUUID(),
            name: newChamber.name,
            address: newChamber.address,
            visiting_hours: newChamber.visiting_hours || 'Schedule TBD'
        }

        setChambers([...chambers, chamber])
        setNewChamber({})
        setIsAddingChamber(false)
    }

    const handleDeleteChamber = (id: string) => {
        setChambers(chambers.filter(c => c.id !== id))
    }

    const handleSave = async () => {
        if (!user) return
        setUpdating(true)
        try {
            // Fetch current to be safe and merge
            const { data: currentData } = await supabase.from('profiles').select('clinic_details').eq('id', user.id).single()

            const updatedDetails = {
                ...currentData?.clinic_details,
                bio: bio,
                chambers: chambers
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    clinic_details: updatedDetails
                })
                .eq('id', user.id)

            if (error) throw error
            alert('Profile updated successfully!')
        } catch (error: any) {
            alert('Error updating profile: ' + error.message)
        } finally {
            setUpdating(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Loading profile...</div>

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-20">
            <header>
                <h1 className="text-2xl font-bold text-slate-900">Doctor Profile</h1>
                <p className="text-slate-500">Manage your profile and chamber locations.</p>
            </header>

            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-8">

                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-4 border-b border-slate-100 pb-8">
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
                    <div className="text-center">
                        <h3 className="font-bold text-lg text-slate-900">{fullName || 'Your Name'}</h3>
                        <p className="text-sm text-slate-500">{user?.email}</p>
                    </div>
                </div>

                {/* Info Form */}
                <div className="grid gap-6">
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
                            rows={3}
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder="e.g. Senior Pediatrician with 10 years of experience..."
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Chamber Locations */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900">Chamber Locations</h3>
                        <button
                            onClick={() => setIsAddingChamber(!isAddingChamber)}
                            className="text-sm text-teal-600 font-medium hover:underline flex items-center gap-1"
                        >
                            <Plus size={16} /> Add Location
                        </button>
                    </div>

                    {isAddingChamber && (
                        <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200 animate-in fade-in slide-in-from-top-2">
                            <div className="grid gap-3 mb-3">
                                <input
                                    type="text"
                                    placeholder="Chamber/Clinic Name (e.g. City Hospital)"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500 text-sm"
                                    value={newChamber.name || ''}
                                    onChange={e => setNewChamber({ ...newChamber, name: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="Detailed Address"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500 text-sm"
                                    value={newChamber.address || ''}
                                    onChange={e => setNewChamber({ ...newChamber, address: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="Visiting Hours (e.g. Mon-Fri 5pm-9pm)"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-teal-500 text-sm"
                                    value={newChamber.visiting_hours || ''}
                                    onChange={e => setNewChamber({ ...newChamber, visiting_hours: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsAddingChamber(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-200 rounded-lg text-sm">Cancel</button>
                                <button onClick={handleAddChamber} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">Add Chamber</button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {chambers.map(chamber => (
                            <div key={chamber.id} className="flex items-start justify-between p-4 border border-slate-200 rounded-xl hover:border-teal-200 transition-colors bg-slate-50/50">
                                <div>
                                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                        <MapPin size={16} className="text-teal-600" />
                                        {chamber.name}
                                    </h4>
                                    <p className="text-sm text-slate-500 mt-1 ml-6">{chamber.address}</p>
                                    <p className="text-xs text-slate-400 mt-1 ml-6 flex items-center gap-1">
                                        <Clock size={12} /> {chamber.visiting_hours}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDeleteChamber(chamber.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {chambers.length === 0 && !isAddingChamber && (
                            <p className="text-center text-slate-400 py-4 italic text-sm">No chamber locations added yet.</p>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <button
                        onClick={handleSave}
                        disabled={updating}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        {updating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Save Profile & Chambers
                    </button>
                </div>

            </div>
        </div>
    )
}
