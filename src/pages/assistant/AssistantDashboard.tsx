import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MyDoctors } from '../../components/MyDoctors'
import { AppointmentScheduler } from '../../components/AppointmentScheduler'
import { VideoConsultationManager } from '../../components/VideoConsultationManager'
import { User, Activity, FileText, Calendar, List } from 'lucide-react'

export default function AssistantDashboard() {
    const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'queue' | 'appointments' | 'video'>('queue')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    // Form State
    const [patientName, setPatientName] = useState('')
    const [age, setAge] = useState('')
    const [sex, setSex] = useState('Male')
    const [bp, setBp] = useState('')
    const [weight, setWeight] = useState('')
    const [temp, setTemp] = useState('')
    const [notes, setNotes] = useState('')

    const [attendingAppointment, setAttendingAppointment] = useState<{ id: string, name: string } | null>(null)

    const handleAttend = (apt: any) => {
        setAttendingAppointment({ id: apt.id, name: apt.patient_name })
        setPatientName(apt.patient_name)
        // If we had more info in Appointment, we could load it here.
        // E.g. phones or notes.
        setNotes(apt.notes || '')
        setActiveTab('queue')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedDoctorId) {
            setMessage('Please select a doctor first.')
            return
        }
        if (!patientName) {
            setMessage('Patient name is required.')
            return
        }

        setLoading(true)
        setMessage('')

        try {
            const { error } = await supabase.from('prescriptions').insert({
                doctor_id: selectedDoctorId,
                patient_name: patientName,
                patient_info: {
                    age,
                    sex,
                    bp, // Stored in patient_info as requested
                    weight,
                    exam_details: {
                        Temperature: temp,
                        Notes: notes
                    }
                },
                status: 'pending', // Key: Pending status for Doctor's queue
                meds: [], // Empty for doctor to fill
                diseases: [],
                tests: []
            })

            if (error) throw error

            // If we are attending an appointment, mark it as completed/processed
            if (attendingAppointment) {
                await supabase.from('appointments').update({ status: 'completed' }).eq('id', attendingAppointment.id)
                setAttendingAppointment(null)
            }

            setMessage('Patient added to Doctor\'s queue successfully!')
            // Reset form
            setPatientName('')
            setAge('')
            setBp('')
            setWeight('')
            setTemp('')
            setNotes('')

        } catch (err: any) {
            console.error('Error saving patient:', err)
            setMessage('Error: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto pb-24 px-4 sm:px-6">
            <header className="mb-6 mt-4">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">Assistant Dashboard</h1>
                <p className="text-sm text-slate-500">Prepare patient details for the doctor.</p>
            </header>

            {/* Doctor Selector */}
            <MyDoctors
                selectedDoctorId={selectedDoctorId}
                onSelectDoctor={setSelectedDoctorId}
            />

            {selectedDoctorId ? (
                <>
                    {/* Tab Navigation */}
                    <div className="flex mb-4 bg-slate-100 p-1 rounded-xl sticky top-0 z-10 shadow-sm">
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 touch-manipulation ${activeTab === 'queue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <List size={20} />
                            Today's Queue
                        </button>
                        <button
                            onClick={() => setActiveTab('appointments')}
                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 touch-manipulation ${activeTab === 'appointments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Calendar size={20} />
                            All Appointments
                        </button>
                        <button
                            onClick={() => setActiveTab('video')}
                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 touch-manipulation ${activeTab === 'video' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Activity size={20} />
                            Video Requests
                        </button>
                    </div>

                    {activeTab === 'queue' ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-safe">
                            <div className="p-4 border-b border-slate-100 bg-slate-50">
                                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                    <User size={20} />
                                    New Patient Walk-in
                                </h2>
                            </div>

                            <form onSubmit={handleSubmit} className="p-4 space-y-5">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Patient Name</label>
                                        <input
                                            type="text"
                                            value={patientName}
                                            onChange={e => setPatientName(e.target.value)}
                                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base"
                                            placeholder="e.g. John Doe"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                                            <input
                                                type="number"
                                                value={age}
                                                onChange={e => setAge(e.target.value)}
                                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base"
                                                placeholder="45"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Sex</label>
                                            <select
                                                value={sex}
                                                onChange={e => setSex(e.target.value)}
                                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base bg-white"
                                            >
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Vitals */}
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Activity size={14} /> Vitals & Examination
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">BP</label>
                                            <input
                                                type="text"
                                                value={bp}
                                                onChange={e => setBp(e.target.value)}
                                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base"
                                                placeholder="120/80"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Weight (kg)</label>
                                            <input
                                                type="text"
                                                value={weight}
                                                onChange={e => setWeight(e.target.value)}
                                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base"
                                                placeholder="70"
                                            />
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Temp</label>
                                            <input
                                                type="text"
                                                value={temp}
                                                onChange={e => setTemp(e.target.value)}
                                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base"
                                                placeholder="98.6"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <FileText size={16} /> Initial Notes
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 text-base"
                                        placeholder="Complaints..."
                                    />
                                </div>

                                <div className="pt-2">
                                    {message && (
                                        <div className={`mb-3 p-3 rounded-lg text-sm ${message.startsWith('Error') || message.includes('select') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                            {message}
                                        </div>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm active:scale-[0.98]"
                                    >
                                        {loading ? 'Sending...' : 'Send to Doctor'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : activeTab === 'appointments' ? (
                        <AppointmentScheduler doctorId={selectedDoctorId!} onAttend={handleAttend} />
                    ) : (
                        <VideoConsultationManager doctorId={selectedDoctorId!} />
                    )}
                </>
            ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 mt-8">
                    <p className="text-base">Select a doctor above to manage patients.</p>
                </div>
            )}
        </div>
    )
}
