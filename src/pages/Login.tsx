import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState<'doctor' | 'patient' | 'assistant'>('doctor')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSignUp, setIsSignUp] = useState(false)
    const [isPlaceholder, setIsPlaceholder] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        // Check if we are using the placeholder
        if ((supabase as any).supabaseUrl?.includes('placeholder')) {
            setIsPlaceholder(true)
        }
    }, [])

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            let userId = ''
            let userRole = role

            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            role: role,
                        }
                    }
                })
                if (error) throw error
                // If auto-confirm is on, we might have a user. If not, alert.
                if (data.user && data.session) {
                    userId = data.user.id
                    // Note: Profile is auto-created by database trigger from auth metadata
                } else {
                    alert('Success! Check your email for the confirmation link.')
                    return
                }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                })
                if (error) throw error
                if (data.user) {
                    userId = data.user.id
                    // Fetch role to redirect correctly
                    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
                    if (profile) userRole = profile.role as any
                }
            }

            // Redirect based on role
            if (userId) {
                if (userRole === 'doctor') navigate('/dashboard')
                else if (userRole === 'patient') navigate('/patient/dashboard')
                else if (userRole === 'assistant') navigate('/assistant/dashboard')
                else navigate('/write') // Fallback
            }

        } catch (err: unknown) {
            const error = err as Error
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-slate-100">

                {isPlaceholder && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-6 text-sm flex gap-2 items-start">
                        <AlertCircle className="shrink-0 mt-0.5" size={16} />
                        <div>
                            <strong>Setup Required</strong><br />
                            Supabase is not connected. Please update <code>.env.local</code> with your actual Supabase URL and Key.
                        </div>
                    </div>
                )}

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">{isSignUp ? 'Create Account' : 'Welcome Back'}</h1>
                    <p className="text-slate-500">{isSignUp ? 'Sign up to get started' : 'Sign in to your account'}</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">I am a...</label>
                                <select
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white"
                                    value={role}
                                    onChange={e => setRole(e.target.value as 'doctor' | 'patient' | 'assistant')}
                                >
                                    <option value="doctor">Doctor</option>
                                    <option value="patient">Patient</option>
                                    <option value="assistant">Assistant</option>
                                </select>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            placeholder="user@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/20"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                    >
                        {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                    </button>
                </div>
            </div>
        </div>
    )
}
