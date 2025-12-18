import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthContextType = {
    session: Session | null
    user: User | null
    role: 'doctor' | 'assistant' | 'patient' | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    role: null,
    loading: true,
    signOut: async () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [role, setRole] = useState<'doctor' | 'assistant' | 'patient' | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) fetchRole(session.user.id)
            else setLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) fetchRole(session.user.id)
            else {
                setRole(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    async function fetchRole(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single()

            if (error) {
                console.error('Error fetching role:', error)
            } else {
                setRole(data?.role as 'doctor' | 'assistant' | 'patient')
            }
        } finally {
            setLoading(false)
        }
    }

    async function signOut() {
        await supabase.auth.signOut()
        setRole(null)
        setUser(null)
        setSession(null)
    }

    return (
        <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
            {!loading ? children : <div className="h-screen flex items-center justify-center">Loading...</div>}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
