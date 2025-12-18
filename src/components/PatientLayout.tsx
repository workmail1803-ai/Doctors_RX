import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from './AuthProvider'

export default function PatientLayout() {
    const { signOut, user } = useAuth()
    const navigate = useNavigate()

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Navbar */}
            <nav className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold">
                                P
                            </div>
                            <span className="font-bold text-xl text-slate-800">My Health</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-600 hidden sm:block">
                                Hello, {user?.user_metadata?.full_name || 'Patient'}
                            </span>
                            <button
                                onClick={handleSignOut}
                                className="p-2 text-slate-500 hover:text-red-600 transition-colors"
                                title="Sign Out"
                            >
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <Outlet />
            </main>
        </div>
    )
}
