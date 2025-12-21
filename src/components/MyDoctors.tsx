import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Doctor {
    id: string;
    full_name: string;
}

interface MyDoctorsProps {
    onSelectDoctor: (doctorId: string) => void;
    selectedDoctorId: string | null;
}

export function MyDoctors({ onSelectDoctor, selectedDoctorId }: MyDoctorsProps) {
    const [doctors, setDoctors] = useState<Doctor[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDoctors()
    }, [])

    async function fetchDoctors() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Get mappings from doctor_assistants
        const { data: mappings, error } = await supabase
            .from('doctor_assistants')
            .select('doctor_id')
            .eq('assistant_id', user.id)

        if (error || !mappings) {
            console.error('Error fetching doctors:', error)
            setLoading(false)
            return
        }

        const doctorIds = mappings.map(m => m.doctor_id)
        if (doctorIds.length === 0) {
            setDoctors([])
            setLoading(false)
            return
        }

        // 2. Get profiles for these doctors
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', doctorIds)

        if (profileError) {
            console.error('Error fetching doctor profiles:', profileError)
        } else {
            setDoctors(profiles || [])
            // Auto-select if only one
            if (profiles && profiles.length === 1 && !selectedDoctorId) {
                onSelectDoctor(profiles[0].id)
            }
        }
        setLoading(false)
    }

    if (loading) return <div className="text-sm text-gray-500">Loading doctors...</div>
    if (doctors.length === 0) return <div className="text-sm text-gray-500">No linked doctors found. Ask a doctor to invite you.</div>

    return (
        <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Doctor to Assist</label>
            <div className="relative">
                <select
                    value={selectedDoctorId || ''}
                    onChange={(e) => onSelectDoctor(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none shadow-sm"
                >
                    <option value="" disabled>Choose a doctor...</option>
                    {doctors.map(doc => (
                        <option key={doc.id} value={doc.id}>
                            Dr. {doc.full_name || 'Unknown'}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                </div>
            </div>
        </div>
    )
}
