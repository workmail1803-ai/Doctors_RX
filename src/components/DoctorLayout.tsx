import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { FilePenLine, FileClock, LogOut, Menu, X, Pill, Settings, Video, User, LayoutDashboard } from 'lucide-react'
import { useAuth } from './AuthProvider'
import clsx from 'clsx'

export default function DoctorLayout() {
    const { signOut, user } = useAuth()
    const location = useLocation()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const navItems = [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/write', label: 'Write Prescription', icon: FilePenLine },
        { to: '/history', label: 'History', icon: FileClock },
        { to: '/reports', label: 'Reports', icon: FilePenLine },
        { to: '/video-call', label: 'Video Call', icon: Video },
        { to: '/profile', label: 'Profile', icon: User },
        { to: '/settings', label: 'Settings', icon: Settings },
    ]

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "print:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:block",
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-600/20">
                            <Pill size={24} />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900 leading-tight">Rx Portal</h1>
                            <p className="text-xs text-slate-500 font-medium">Doctor's Panel</p>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 p-4 space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = location.pathname === item.to
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={clsx(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-teal-50 text-teal-700"
                                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                    )}
                                >
                                    <Icon size={18} className={isActive ? "text-teal-600" : "text-slate-400"} />
                                    {item.label}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User Profile */}
                    <div className="p-4 border-t border-slate-100">
                        <div className="flex items-center gap-3 mb-4 px-2">
                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-xs font-bold">
                                Dr
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                                <p className="text-xs text-teal-600">Doctor</p>
                            </div>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 flex flex-col">
                {/* Mobile Header */}
                <div className="print:hidden lg:hidden p-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                            <Pill size={18} />
                        </div>
                        <span className="font-bold text-slate-900">Rx Portal</span>
                    </div>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                <div className="flex-1 p-4 lg:p-8 overflow-auto print:p-0">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
