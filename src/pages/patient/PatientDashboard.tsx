import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
    Video, Calendar, Clock, MapPin, Search,
    LayoutDashboard, User, Building2, FileText,
    LogOut, Menu, X, Stethoscope
} from 'lucide-react'
import { useAuth } from '../../components/AuthProvider'
import PatientReports from '../../components/PatientReports'
import { type Appointment } from '../../types'

type DoctorProfile = {
    id: string
    full_name: string
    clinic_details: any
    avatar_url?: string
    specialization?: string
}

export default function PatientDashboard() {
    const { user, signOut } = useAuth()
    const [activeTab, setActiveTab] = useState<'dashboard' | 'doctors' | 'clinics' | 'appointments' | 'records'>('dashboard')
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Data State
    const [doctors, setDoctors] = useState<DoctorProfile[]>([])
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (user) fetchData()
    }, [user])

    const fetchData = async () => {
        if (!user) return
        setLoading(true)
        try {
            // Fetch Doctors
            const { data: docs } = await supabase.rpc('get_active_doctors')
            if (docs) setDoctors(docs)

            // Fetch My Appointments
            const { data: apps } = await supabase
                .from('appointments')
                .select('*')
                .eq('patient_id', user.id)
                .order('appointment_time', { ascending: true }) // Ascending for upcoming

            if (apps) setAppointments(apps as Appointment[])

        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    // State for Chamber Modal
    const [selectedDoctorForChamber, setSelectedDoctorForChamber] = useState<DoctorProfile | null>(null)

    const handleChamberClick = (doc: DoctorProfile) => {
        const chambers = doc.clinic_details?.chambers || []

        if (chambers.length === 0) {
            // No chambers defined, fallback to generic request or clinic name
            const defaultChamber = doc.clinic_details?.name ? `Clinic: ${doc.clinic_details.name}` : 'Default Chamber'
            if (confirm(`No specific chambers listed. Request appointment at ${defaultChamber}?`)) {
                requestAppointment(doc.id, 'offline', { name: defaultChamber, address: doc.clinic_details?.address || 'Address pending' })
            }
        } else if (chambers.length === 1) {
            // One chamber, auto-select
            requestAppointment(doc.id, 'offline', chambers[0])
        } else {
            // Multiple, show modal
            setSelectedDoctorForChamber(doc)
        }
    }

    const requestAppointment = async (doctorId: string, type: 'online' | 'offline' = 'online', chamberDetails?: any) => {
        if (!user) return
        try {
            const notes = chamberDetails
                ? `Chamber: ${chamberDetails.name}\nAddress: ${chamberDetails.address}\nTiming: ${chamberDetails.visiting_hours || 'N/A'}`
                : undefined

            const { error } = await supabase.from('appointments').insert({
                patient_id: user.id,
                doctor_id: doctorId,
                status: 'pending',
                patient_name: user.user_metadata?.full_name || user.email || 'Unnamed Patient',
                type: type,
                notes: notes
            })
            if (error) throw error
            const typeLabel = type === 'online' ? 'Video' : 'Chamber'
            alert(`${typeLabel} Appointment request sent for ${chamberDetails?.name || 'review'}!`)
            setSelectedDoctorForChamber(null)
            fetchData()
            setActiveTab('appointments')
        } catch (error: any) {
            alert('Error requesting appointment: ' + error.message)
        }
    }

    // Derived State
    const upcomingAppointments = appointments.filter(a =>
        a.status === 'confirmed' &&
        a.appointment_time &&
        new Date(a.appointment_time) > new Date(Date.now() - 30 * 60 * 1000) // Not expired more than 30m ago
    )

    const uniqueClinics = Array.from(new Set(doctors.map(d => d.clinic_details?.name).filter(Boolean)))
    const filteredDoctors = doctors.filter(d =>
        (d.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.clinic_details?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

    const NavItem = ({ id, icon: Icon, label }: any) => (
        <button
            onClick={() => { setActiveTab(id); setSidebarOpen(false) }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === id
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                : 'text-slate-500 hover:bg-slate-50 hover:text-teal-600'
                }`}
        >
            <Icon size={20} />
            {label}
        </button>
    )

    if (loading && !doctors.length) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed md:sticky top-0 left-0 h-screen w-72 bg-white border-r border-slate-200 p-6 flex flex-col z-50 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                }`}>
                <div className="flex items-center gap-3 mb-10 px-2">
                    <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center text-white">
                        <Stethoscope size={24} />
                    </div>
                    <div>
                        <h1 className="font-bold text-xl text-slate-900 leading-tight">Best RX</h1>
                        <p className="text-xs text-teal-600 font-medium">Patient Portal</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
                    <NavItem id="doctors" icon={User} label="Find Doctors" />
                    <NavItem id="clinics" icon={Building2} label="Clinics" />
                    <NavItem id="appointments" icon={Calendar} label="My Appointments" />
                    <NavItem id="records" icon={FileText} label="Medical Records" />
                </nav>

                <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                            {user?.email?.[0].toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold text-slate-900 truncate">{user?.user_metadata?.full_name || 'Patient'}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-3 px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                    >
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 h-screen overflow-y-auto">
                {/* Mobile Header */}
                <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
                        <Menu size={24} className="text-slate-600" />
                    </button>
                    <span className="font-bold text-slate-900">Best RX</span>
                    <div className="w-10" /> {/* Spacer */}
                </header>

                <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
                    {/* View: DASHBOARD */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl p-8 text-white shadow-xl shadow-teal-600/20">
                                <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'Patient'}!</h2>
                                <p className="text-teal-100 mb-6">Manage your health appointments and records all in one place.</p>
                                <div className="flex flex-wrap gap-4">
                                    <button onClick={() => setActiveTab('doctors')} className="px-6 py-2.5 bg-white text-teal-700 font-semibold rounded-lg shadow-sm hover:bg-teal-50 transition-colors">
                                        Book Appointment
                                    </button>
                                    <button onClick={() => setActiveTab('records')} className="px-6 py-2.5 bg-teal-700/50 text-white font-semibold rounded-lg hover:bg-teal-700/70 transition-colors backdrop-blur-sm">
                                        View Records
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={24} /></div>
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Upcoming</p>
                                            <p className="text-2xl font-bold text-slate-900">{upcomingAppointments.length}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400">Scheduled appointments</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><FileText size={24} /></div>
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Prescriptions</p>
                                            <p className="text-2xl font-bold text-slate-900">-</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400">Total prescriptions received</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg"><User size={24} /></div>
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Doctors</p>
                                            <p className="text-2xl font-bold text-slate-900">{doctors.length}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400">Available specialists</p>
                                </div>
                            </div>

                            {upcomingAppointments.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-900">Next Appointment</h3>
                                        <Link to="/appointments" onClick={() => setActiveTab('appointments')} className="text-teal-600 text-sm font-medium hover:underline">View All</Link>
                                    </div>
                                    <div className="p-6">
                                        <AppointmentCard app={upcomingAppointments[0]} doctors={doctors} currentTime={currentTime} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* View: DOCTORS */}
                    {activeTab === 'doctors' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h2 className="text-2xl font-bold text-slate-900">Find a Doctor</h2>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Search by name or clinic..."
                                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredDoctors.map(doc => (
                                    <div key={doc.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col items-center text-center group">
                                        <div className="w-24 h-24 mb-4 rounded-full bg-slate-100 overflow-hidden ring-4 ring-slate-50 group-hover:ring-teal-50 transition-all">
                                            {doc.avatar_url ? (
                                                <img src={doc.avatar_url} alt={doc.full_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-3xl">
                                                    {doc.full_name?.[0] || 'D'}
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 mb-1">{doc.full_name}</h3>
                                        <p className="text-sm text-slate-500 mb-4">{doc.clinic_details?.bio || 'General Practitioner'}</p>

                                        {doc.clinic_details?.name && (
                                            <div className="flex items-center gap-1 text-xs text-slate-400 mb-6 bg-slate-50 px-3 py-1 rounded-full">
                                                <Building2 size={12} />
                                                {doc.clinic_details.name}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-2 w-full mt-auto">
                                            <button
                                                onClick={() => requestAppointment(doc.id, 'online')}
                                                className="py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-sm shadow-teal-600/20 text-sm"
                                            >
                                                <Video size={16} /> Video
                                            </button>
                                            <button
                                                onClick={() => handleChamberClick(doc)}
                                                className="py-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
                                            >
                                                <MapPin size={16} /> Chamber
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* View: CLINICS */}
                    {activeTab === 'clinics' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-2xl font-bold text-slate-900">Partner Clinics</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {uniqueClinics.map((clinicName: any, idx) => {
                                    const clinicDoctors = doctors.filter(d => d.clinic_details?.name === clinicName)
                                    return (
                                        <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-teal-200 transition-colors">
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                        <Building2 className="text-teal-600" />
                                                        {clinicName}
                                                    </h3>
                                                    <p className="text-sm text-slate-500 mt-1">{clinicDoctors[0]?.clinic_details?.address || 'Bangladesh'}</p>
                                                </div>
                                                <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-medium">
                                                    {clinicDoctors.length} Doctors
                                                </span>
                                            </div>

                                            <div className="space-y-2 mt-4">
                                                {clinicDoctors.map(doc => (
                                                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group hover:bg-teal-50 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold overflow-hidden">
                                                                {doc.avatar_url ? (
                                                                    <img src={doc.avatar_url} alt={doc.full_name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    doc.full_name?.[0] || 'D'
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-slate-900">{doc.full_name}</p>
                                                                <p className="text-xs text-slate-500">{doc.specialization || 'General Practitioner'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); requestAppointment(doc.id, 'online') }}
                                                                title="Video Consult"
                                                                className="p-1.5 text-teal-600 hover:bg-teal-100 rounded-lg transition-colors"
                                                            >
                                                                <Video size={16} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleChamberClick(doc) }}
                                                                title="Chamber Visit"
                                                                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                                                            >
                                                                <MapPin size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                                {uniqueClinics.length === 0 && (
                                    <div className="col-span-full p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
                                        <Building2 size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>No clinics registered yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* View: APPOINTMENTS */}
                    {activeTab === 'appointments' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-2xl font-bold text-slate-900">My Appointments</h2>
                            <div className="space-y-4">
                                {appointments.map(app => (
                                    <div key={app.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 transition-all hover:shadow-md">
                                        <AppointmentCard app={app} doctors={doctors} currentTime={currentTime} />
                                    </div>
                                ))}
                                {appointments.length === 0 && (
                                    <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
                                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>No appointments found.</p>
                                        <button onClick={() => setActiveTab('doctors')} className="mt-4 text-teal-600 font-medium hover:underline">Book your first appointment</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* View: RECORDS */}
                    {activeTab === 'records' && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <PatientReports />
                        </div>
                    )}

                </div>

                {/* Chamber Selection Modal */}
                {selectedDoctorForChamber && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200 shadow-2xl">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Select Location</h3>
                                    <p className="text-sm text-slate-500">Where would you like to visit Dr. {selectedDoctorForChamber.full_name}?</p>
                                </div>
                                <button onClick={() => setSelectedDoctorForChamber(null)} className="p-1 hover:bg-slate-100 rounded-full">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                                {(selectedDoctorForChamber.clinic_details?.chambers || []).map((chamber: any) => (
                                    <button
                                        key={chamber.id}
                                        onClick={() => requestAppointment(selectedDoctorForChamber.id, 'offline', chamber)}
                                        className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 transition-all group"
                                    >
                                        <div className="font-bold text-slate-900 group-hover:text-teal-700">{chamber.name}</div>
                                        <div className="text-sm text-slate-500 mt-1">{chamber.address}</div>
                                        <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                            <Clock size={12} /> {chamber.visiting_hours}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

// Sub-component for Appointment Display
function AppointmentCard({ app, doctors, currentTime }: { app: Appointment, doctors: DoctorProfile[], currentTime: Date }) {
    const doctor = doctors.find(d => d.id === app.doctor_id)

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                    <Video size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-slate-900">
                        {doctor?.full_name || 'Unknown Doctor'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                            <Calendar size={12} />
                            {app.appointment_time ? new Date(app.appointment_time).toLocaleDateString() : 'Date pending'}
                        </span>
                        {app.appointment_time && (
                            <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                                <Clock size={12} />
                                {new Date(app.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full capitalize text-xs font-semibold ${app.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                            {app.status}
                        </span>
                    </div>
                    {doctor?.clinic_details?.name && (
                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                            <MapPin size={10} /> {doctor.clinic_details.name}
                        </p>
                    )}
                </div>
            </div>

            <div>
                {app.status === 'confirmed' && app.type === 'online' ? (
                    (() => {
                        if (!app.appointment_time) return null
                        const scheduled = new Date(app.appointment_time)
                        const diff = scheduled.getTime() - currentTime.getTime()
                        const isTooEarly = diff > 5 * 60 * 1000 // > 5 mins
                        const isExpired = currentTime.getTime() > (scheduled.getTime() + 30 * 60 * 1000)

                        if (isExpired) return (
                            <button disabled className="w-full md:w-auto px-6 py-2 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed font-medium text-sm">
                                Slot Expired
                            </button>
                        )

                        if (isTooEarly) {
                            const minutes = Math.ceil(diff / 60000)
                            return (
                                <button disabled className="w-full md:w-auto px-6 py-2 bg-slate-100 text-slate-500 rounded-lg cursor-not-allowed font-medium text-sm border border-slate-200">
                                    Starts in {minutes > 60 ? Math.round(minutes / 60) + ' hrs' : minutes + ' mins'}
                                </button>
                            )
                        }

                        return (
                            <Link to={`/video-call/${app.id}`} className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 font-medium text-sm flex items-center justify-center gap-2 animate-pulse">
                                <Video size={16} /> Join Call
                            </Link>
                        )
                    })()
                ) : (
                    <span className="text-sm text-slate-400 italic">
                        {app.status === 'pending' ? 'Waiting for approval...' : ''}
                    </span>
                )}
            </div>
        </div>
    )
}
