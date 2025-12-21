import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function AssistantManager() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [currentAssistant, setCurrentAssistant] = useState<{ email: string, full_name: string } | null>(null)

    useEffect(() => {
        fetchAssistant()
    }, [])

    async function fetchAssistant() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Join doctor_assistants -> auth.users (via profiles or rpc?)
        // Direct query to doctor_assistants
        const { data } = await supabase
            .from('doctor_assistants')
            .select('assistant_id')
            .eq('doctor_id', user.id)
            .single()

        if (data?.assistant_id) {
            // Fetch assistant details. 
            // Since we can't query auth.users directly easily from client without special policies,
            // we rely on 'profiles' table which should exist.
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name') // Assuming profile doesn't have email usually, but we might want it.
                .eq('id', data.assistant_id)
                .single()

            // To get email, we might need a secure function or if profiles has it.
            // Let's just show Name for now, or assume we can't get email easily unless stored in profile.
            // For now, showing Name is good.
            setCurrentAssistant({
                email: 'Linked', // Placeholder or need DB adjustment to store email in profile
                full_name: profile?.full_name || 'Unknown'
            })
        }
    }

    async function handleInvite() {
        if (!email) return
        setLoading(true)
        setMessage('')

        try {
            const { data, error } = await supabase.rpc('link_assistant', { assistant_email: email })

            if (error) throw error

            // data is JSONB { success, message }
            if (data.success) {
                setMessage('Success: ' + data.message)
                setEmail('')
                fetchAssistant()
            } else {
                setMessage('Error: ' + data.message)
            }
        } catch (err: any) {
            setMessage('Error: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Assistant Manager</h2>

            {currentAssistant ? (
                <div className="mb-4 p-4 bg-green-50 rounded border border-green-200">
                    <p className="text-green-800">
                        <span className="font-semibold">Current Assistant:</span> {currentAssistant.full_name}
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                        To change assistant, simply invite a new one below. The old one will be replaced.
                    </p>
                </div>
            ) : (
                <p className="text-gray-500 mb-4">You have no assistant linked.</p>
            )}

            <div className="flex gap-4 items-end">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assistant Email
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="assistant@example.com"
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <button
                    onClick={handleInvite}
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? 'Linking...' : 'Link Assistant'}
                </button>
            </div>

            {message && (
                <p className={`mt-3 text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {message}
                </p>
            )}
        </div>
    )
}
