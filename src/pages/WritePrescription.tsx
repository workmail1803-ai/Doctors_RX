import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { Plus, Trash2, Save, Printer, ChevronDown, ChevronUp, FileText, Loader2, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SmartInput } from '../components/SmartInput'
import { useAuth } from '../components/AuthProvider'
import clsx from 'clsx'

// Types
import type { Disease, Medicine, Test, History, AdviceItem } from '../types'

// Types
type FormData = {
    patientName: string
    age: string
    sex: 'Male' | 'Female' | 'Other'
    date: string
    followUpDays: string
    diseases: Disease[]
    examination: string[]
    examDetails: { [key: string]: string }
    provisionalDiagnosis: string
    meds: Medicine[]
    tests: Test[]
    advice: AdviceItem[]
    notes: string
    bp: string
    weight: string
    history: History
    historyVisibility: { [key in keyof History]: boolean }
}

// Examination options - all show text input when checked
const EXAM_OPTIONS = [
    'Anemia', 'Jaundice', 'Lymph Node', 'Heart', 'Lungs', 'Liver', 'Spleen',
    'Abdomen', 'Skin', 'Eyes', 'Hydration', 'Oedema', 'Temperature',
    'Respiratory Rate', 'Pallor', 'Cyanosis', 'Clubbing'
]

// SectionCard Component (matching next-app design)
function SectionCard({ title, children, isOpen, onToggle }: { title: string, children: React.ReactNode, isOpen: boolean, onToggle: () => void }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-200">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOpen ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                        <FileText size={20} />
                    </div>
                    <span className="font-semibold text-slate-800">{title}</span>
                </div>
                {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>
            {isOpen && (
                <div className="p-4 border-t border-slate-100">
                    {children}
                </div>
            )}
        </div>
    )
}

export default function WritePrescription() {
    const { user } = useAuth()
    const [saving, setSaving] = useState(false)
    const [activeSection, setActiveSection] = useState<string>('patient')

    // Patient Search State
    const [patientSuggestions, setPatientSuggestions] = useState<any[]>([])
    const [showPatientSuggestions, setShowPatientSuggestions] = useState(false)
    const [searchingPatients, setSearchingPatients] = useState(false)

    const { control, register, handleSubmit, watch, setValue, reset } = useForm<FormData>({
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            sex: 'Male',
            followUpDays: '',
            diseases: [{ name: '', days: '' }],
            meds: [{ brand: '', dosage: '', freq: '', duration: '' }],
            tests: [],
            advice: [],
            examination: [],
            examDetails: {},
            bp: '',
            weight: '',
            provisionalDiagnosis: '',
            history: {
                pastIllness: '', birthHistory: '', feedingHistory: '',
                developmentHistory: '', treatmentHistory: '', familyHistory: ''
            },
            historyVisibility: {
                pastIllness: true, birthHistory: true, feedingHistory: true,
                developmentHistory: true, treatmentHistory: true, familyHistory: true
            }
        }
    })

    const { fields: diseaseFields, append: addDisease, remove: removeDisease } = useFieldArray({ control, name: 'diseases' })
    const { fields: medFields, append: addMed, remove: removeMed } = useFieldArray({ control, name: 'meds' })
    const { fields: testFields, append: addTest, remove: removeTest } = useFieldArray({ control, name: 'tests' })
    const { fields: adviceFields, append: addAdvice, remove: removeAdvice } = useFieldArray({ control, name: 'advice' })

    // Age Composite State
    const [ageNum, setAgeNum] = useState('')
    const [ageUnit, setAgeUnit] = useState('Years')

    // Sync simple age string to composite state (when loading patient)
    const watchedAge = watch('age')
    useEffect(() => {
        if (!watchedAge) {
            setAgeNum('')
            return
        }
        // Try to parse "5 Months", "5 Years", "5"
        const parts = watchedAge.split(' ')
        if (parts.length >= 2) {
            const num = parts[0]
            const unit = parts.slice(1).join(' ') // "Years", "Months", "Days"
            // check if unit is valid
            if (['Years', 'Months', 'Days'].includes(unit)) {
                setAgeNum(num)
                setAgeUnit(unit)
            } else {
                setAgeNum(watchedAge) // Fallback
                setAgeUnit('Years')
            }
        } else {
            // Just a number or random string
            setAgeNum(watchedAge)
            // If it's just a number, assume years? Or keep current unit?
            // Let's assume input "45" means 45 Years by default if unit is already Years
        }
    }, [watchedAge])

    const updateAge = (num: string, unit: string) => {
        setAgeNum(num)
        setAgeUnit(unit)
        if (num) {
            setValue('age', `${num} ${unit}`)
        } else {
            setValue('age', '')
        }
    }

    // Load cloned data on mount
    useEffect(() => {
        const state = (location as any).state as { cloneData?: any } | null
        if (state?.cloneData) {
            loadPatient(state.cloneData)
            // Optional: clear state so it doesn't reload if user navigates back and forth?
            // Actually nice to keep it if they accidentally went back.
            // But we should reset the ID or something? 
            // The `onSubmit` creates a NEW prescription, so we don't need to worry about ID.
        }
    }, [location])


    // Auto-search patients debounced
    useEffect(() => {
        // Close dropdown when clicking outside
        const handleClick = () => setTimeout(() => setShowPatientSuggestions(false), 200) // Delay to allow click
        window.addEventListener('click', handleClick)
        return () => window.removeEventListener('click', handleClick)
    }, [])

    const handlePatientSearch = async (val: string) => {
        setValue('patientName', val)
        if (val.length < 2) {
            setPatientSuggestions([])
            setShowPatientSuggestions(false)
            return
        }

        setSearchingPatients(true)
        const { data: pats } = await supabase
            .from('prescriptions')
            .select('*')
            .eq('doctor_id', user?.id)
            .ilike('patient_name', `${val}%`)
            .order('created_at', { ascending: false })
            .limit(10)

        if (pats) {
            // Dedup by name
            const unique = pats.reduce((acc: any[], current) => {
                const x = acc.find(item => item.patient_name === current.patient_name);
                return x ? acc : acc.concat([current]);
            }, []);
            setPatientSuggestions(unique)
            setShowPatientSuggestions(true)
        }
        setSearchingPatients(false)
    }

    const loadPatient = (p: any) => {
        setValue('patientName', p.patient_name)
        setValue('age', p.patient_info?.age || '')
        setValue('sex', p.patient_info?.sex || 'Male')
        setValue('bp', p.patient_info?.bp || '')
        setValue('weight', p.patient_info?.weight || '') // Update if needed, or user can edit

        // Load History
        if (p.patient_info?.history) {
            setValue('history', p.patient_info.history)
            if (p.patient_info.history_visibility) {
                setValue('historyVisibility', p.patient_info.history_visibility)
            }
        }

        // Load Meds & Complaints if they exist (Clone previous Rx)
        if (p.meds && p.meds.length > 0) setValue('meds', p.meds)
        if (p.diseases && p.diseases.length > 0) setValue('diseases', p.diseases)
        if (p.tests && p.tests.length > 0) setValue('tests', p.tests)

        setShowPatientSuggestions(false)
    }

    // Protocol Suggestion State
    const [suggestedProtocol, setSuggestedProtocol] = useState<{
        match_type: string
        meds: Medicine[]
        tests: Test[]
        advice: string
        matched_diseases: string[]
    } | null>(null)

    const watchedDiseases = watch('diseases')

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(async () => {
            const diseaseNames = watchedDiseases
                .map(d => d.name)
                .filter(n => n && n.length > 2)

            if (diseaseNames.length === 0) {
                setSuggestedProtocol(null)
                return
            }

            // Don't search if we already have a suggestion for this exact set?
            // Actually, keep searching to handle updates.

            try {
                const { data, error } = await supabase.rpc('get_protocol_matches', {
                    doc_id: user?.id,
                    query_diseases: diseaseNames
                })

                if (!error && data && data.length > 0) {
                    // Parse advice from string to array check
                    // The RPC returns matching row.
                    // Mapping to local state
                    const match = data[0] // take best match
                    setSuggestedProtocol({
                        match_type: match.match_type,
                        meds: match.meds || [],
                        tests: match.tests || [],
                        advice: match.advice || '',
                        matched_diseases: match.matched_diseases || []
                    })
                } else {
                    setSuggestedProtocol(null)
                }
            } catch (err) {
                console.error(err)
            }
        }, 800) // 800ms debounce
        return () => clearTimeout(timer)
    }, [watchedDiseases, user?.id])

    const applyProtocol = () => {
        if (!suggestedProtocol) return

        // Confirm if overwriting? Or just append?
        // Usually protocols replace or user manually edits. 
        // Let's replace empty fields, append to others? 
        // Simplest: Replace Meds/Tests/Advice if they are empty, otherwise Append.
        // Actually, just SetValue is easier.

        setValue('meds', suggestedProtocol.meds)
        setValue('tests', suggestedProtocol.tests)

        // Parse Advice
        // The RPC returns a string joined by \n (from legacy or as stored).
        // Our form uses { text: string }[]
        const adviceArray = suggestedProtocol.advice.split('\n').filter(Boolean).map(t => ({ text: t }))
        setValue('advice', adviceArray)

        setSuggestedProtocol(null) // Hide after applying
    }

    const onSubmit = async (data: FormData, shouldPrint = false) => {
        if (!user) return
        setSaving(true)
        try {
            const { data: newRx, error } = await supabase.from('prescriptions').insert({
                doctor_id: user.id,
                patient_name: data.patientName,
                patient_info: {
                    age: data.age,
                    sex: data.sex,
                    follow_up: data.followUpDays,
                    history: data.history,
                    history_visibility: data.historyVisibility,
                    examination: data.examination,
                    exam_details: data.examDetails,
                    provisional_diagnosis: data.provisionalDiagnosis,
                    bp: data.bp,
                    weight: data.weight
                },
                diseases: data.diseases,
                meds: data.meds,
                tests: data.tests,
                advice: data.advice.map(item => item.text).join('\n'),
                created_at: new Date().toISOString()
            })
                .select()
                .single()
            if (error) throw error
            if (shouldPrint && newRx) {
                window.location.href = `/print/${newRx.id}`
            } else {
                alert('Prescription Saved!')
                reset()
                setValue('date', new Date().toISOString().split('T')[0])
                setSuggestedProtocol(null)
            }
        } catch (e: unknown) {
            const err = e as Error
            alert('Error saving: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 pb-20 px-2 md:px-4">
            {/* Top Actions */}
            <div className="flex flex-wrap gap-2 justify-end mb-2 md:mb-4 sticky sticky-mobile-safe bg-slate-50 py-2 z-20">
                <button
                    type="button"
                    onClick={handleSubmit((d) => onSubmit(d, false))}
                    disabled={saving}
                    className="px-3 py-1.5 md:px-4 md:py-2 bg-teal-600 text-white font-medium rounded-lg shadow-sm hover:bg-teal-700 flex items-center gap-1.5 md:gap-2 text-sm md:text-base"
                >
                    <Save size={16} className="md:w-[18px] md:h-[18px]" /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                    type="button"
                    onClick={handleSubmit((d) => onSubmit(d, true))}
                    disabled={saving}
                    className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 flex items-center gap-1.5 md:gap-2 text-sm md:text-base"
                >
                    <Printer size={16} className="md:w-[18px] md:h-[18px]" /> Save & Print
                </button>
            </div>

            {/* Patient Details Card - Always Visible */}
            <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm space-y-3 md:space-y-4">
                <h2 className="text-base md:text-lg font-bold text-slate-800 border-b pb-2">Patient Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 relative">
                        <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <div className="relative">
                            <input
                                {...register('patientName', { required: true })}
                                onChange={(e) => handlePatientSearch(e.target.value)}
                                className="w-full h-10 md:h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm md:text-base"
                                placeholder="e.g. John Doe (Type to search)"
                                autoComplete="off"
                            />
                            {searchingPatients && (
                                <div className="absolute right-3 top-2.5 md:top-3">
                                    <Loader2 className="animate-spin text-slate-400" size={16} />
                                </div>
                            )}
                        </div>

                        {/* Autocomplete Dropdown */}
                        {showPatientSuggestions && patientSuggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] md:text-xs font-semibold text-slate-500">
                                    PREVIOUS PATIENTS
                                </div>
                                {patientSuggestions.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => loadPatient(p)}
                                        className="w-full text-left px-4 py-3 hover:bg-teal-50 transition-colors border-b border-slate-50 last:border-none group"
                                    >
                                        <div className="font-medium text-slate-900 group-hover:text-teal-700 flex items-center justify-between text-sm">
                                            {p.patient_name}
                                            <span className="text-[10px] md:text-xs font-normal text-slate-400 flex items-center gap-1">
                                                <Clock size={12} /> {new Date(p.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                                            {p.patient_info?.age} • {p.patient_info?.sex} • {p.meds?.length || 0} Meds
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">Age</label>
                        <div className="flex gap-2">
                            <input
                                value={ageNum}
                                onChange={(e) => updateAge(e.target.value, ageUnit)}
                                type="number"
                                className="flex-1 w-full h-10 md:h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm md:text-base"
                                placeholder="0"
                            />
                            <select
                                value={ageUnit}
                                onChange={(e) => updateAge(ageNum, e.target.value)}
                                className="w-24 h-10 md:h-11 px-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-sm md:text-base"
                            >
                                <option value="Years">Years</option>
                                <option value="Months">Months</option>
                                <option value="Days">Days</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">Sex</label>
                        <select
                            {...register('sex')}
                            className="w-full h-10 md:h-11 px-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-sm md:text-base"
                        >
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                        <input
                            {...register('date')}
                            type="date"
                            className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Follow Up (Days)</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setValue('followUpDays', '১ দিন পরে আসবেন')}
                                className={clsx(
                                    "px-3 py-2 text-sm rounded-md border transition-colors",
                                    watch('followUpDays') === '১ দিন পরে আসবেন'
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-teal-400"
                                )}
                            >
                                ১ দিন
                            </button>
                            <button
                                type="button"
                                onClick={() => setValue('followUpDays', '২ দিন পরে আসবেন')}
                                className={clsx(
                                    "px-3 py-2 text-sm rounded-md border transition-colors",
                                    watch('followUpDays') === '২ দিন পরে আসবেন'
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-teal-400"
                                )}
                            >
                                ২ দিন
                            </button>
                            <button
                                type="button"
                                onClick={() => setValue('followUpDays', '৭ দিন পরে আসবেন')}
                                className={clsx(
                                    "px-3 py-2 text-sm rounded-md border transition-colors",
                                    watch('followUpDays') === '৭ দিন পরে আসবেন'
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-teal-400"
                                )}
                            >
                                ৭ দিন
                            </button>
                            <button
                                type="button"
                                onClick={() => setValue('followUpDays', '১৪ দিন পরে আসবেন')}
                                className={clsx(
                                    "px-3 py-2 text-sm rounded-md border transition-colors",
                                    watch('followUpDays') === '১৪ দিন পরে আসবেন'
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-teal-400"
                                )}
                            >
                                ১৪ দিন
                            </button>
                            <button
                                type="button"
                                onClick={() => setValue('followUpDays', '১ মাস পরে আসবেন')}
                                className={clsx(
                                    "px-3 py-2 text-sm rounded-md border transition-colors",
                                    watch('followUpDays') === '১ মাস পরে আসবেন'
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-teal-400"
                                )}
                            >
                                ১ মাস
                            </button>
                            <input
                                {...register('followUpDays')}
                                type="text"
                                className="w-28 h-10 px-3 border border-slate-300 rounded-lg"
                                placeholder="Custom days"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Dynamic Sections */}
            <div className="space-y-4">
                {/* Protocol Suggestion Alert */}
                {suggestedProtocol && (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4">
                        <div className="p-2 bg-teal-100 rounded-full text-teal-600 mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" /></svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-teal-900 mb-1">
                                Found Protocol for {suggestedProtocol.matched_diseases.join(', ')}
                            </h3>
                            <p className="text-sm text-teal-700 mb-3">
                                Previous treatment: {suggestedProtocol.meds.length} Medicines, {suggestedProtocol.tests.length} Tests.
                                {suggestedProtocol.meds.length > 0 && (
                                    <span className="block mt-1 text-xs opacity-75">
                                        Includes: {suggestedProtocol.meds.slice(0, 3).map(m => m.brand).join(', ')}
                                        {suggestedProtocol.meds.length > 3 && '...'}
                                    </span>
                                )}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={applyProtocol}
                                    className="px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                                >
                                    Apply Treatment
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSuggestedProtocol(null)}
                                    className="px-3 py-1.5 bg-white border border-teal-200 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-50 transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Diseases Section */}
                <SectionCard
                    title="Complaints / Diseases"
                    isOpen={activeSection === 'diseases'}
                    onToggle={() => setActiveSection(activeSection === 'diseases' ? '' : 'diseases')}
                >
                    <div className="space-y-3">
                        {diseaseFields.map((field, index) => (
                            <div key={field.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="flex-1 w-full">
                                    <Controller
                                        control={control}
                                        name={`diseases.${index}.name`}
                                        render={({ field: { onChange, value } }) => (
                                            <SmartInput
                                                label=""
                                                value={value}
                                                onChange={onChange}
                                                placeholder="Disease/Symptom"
                                                category="diseases"
                                                doctorId={user?.id}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-md"
                                            />
                                        )}
                                    />
                                </div>
                                <input
                                    {...register(`diseases.${index}.days`)}
                                    type="text"
                                    className="w-24 h-10 px-3 border border-slate-300 rounded-md"
                                    placeholder="Duration"
                                />
                                <button type="button" onClick={() => removeDisease(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addDisease({ name: '', days: '' })} className="flex items-center gap-2 text-teal-600 font-medium px-2 py-1 hover:bg-teal-50 rounded-lg">
                            <Plus size={18} /> Add Complaint
                        </button>
                    </div>
                </SectionCard>

                {/* Examination Section */}
                <SectionCard
                    title="Examination & Vitals"
                    isOpen={activeSection === 'exam'}
                    onToggle={() => setActiveSection(activeSection === 'exam' ? '' : 'exam')}
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                            <div>
                                <label className="text-sm font-medium">BP</label>
                                <input
                                    {...register('bp')}
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg mt-1"
                                    placeholder="120/80"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Weight</label>
                                <input
                                    {...register('weight')}
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg mt-1"
                                    placeholder="e.g. 10kg 500gm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Clinical Examination Findings</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {EXAM_OPTIONS.map((opt) => {
                                    const watchedExam = watch('examination') || []
                                    const isChecked = watchedExam.includes(opt)

                                    return (
                                        <div key={opt} className={clsx(
                                            "p-3 border rounded-lg transition-all",
                                            isChecked ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:bg-slate-50"
                                        )}>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    value={opt}
                                                    {...register('examination')}
                                                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                                />
                                                <span className="text-sm font-medium">{opt}</span>
                                            </label>

                                            {isChecked && (
                                                <div className="mt-2 pl-6">
                                                    <input
                                                        type="text"
                                                        {...register(`examDetails.${opt}` as any)}
                                                        placeholder="Enter details..."
                                                        className="w-full h-8 px-2 text-sm border border-slate-300 rounded focus:ring-teal-500"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* History Section */}
                <SectionCard
                    title="History"
                    isOpen={activeSection === 'history'}
                    onToggle={() => setActiveSection(activeSection === 'history' ? '' : 'history')}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { key: 'pastIllness', label: 'Past Illness' },
                            { key: 'familyHistory', label: 'Family History' },
                            { key: 'treatmentHistory', label: 'Treatment History' },
                            { key: 'birthHistory', label: 'Birth History' },
                            { key: 'feedingHistory', label: 'Feeding History' },
                            { key: 'developmentHistory', label: 'Development History' }
                        ].map((item: any) => (
                            <div key={item.key} className="relative">
                                <textarea
                                    {...register(`history.${item.key}` as any)}
                                    className="w-full h-20 p-3 border border-slate-300 rounded-lg text-sm"
                                    placeholder={item.label}
                                />
                                <div className="absolute top-2 right-2">
                                    <label className="flex items-center gap-1 bg-white/80 px-2 py-1 rounded text-xs cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            {...register(`historyVisibility.${item.key}` as any)}
                                            className="rounded text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="text-slate-500 font-medium">Print</span>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                {/* Treatment Section */}
                <SectionCard
                    title="Treatment (Medicines)"
                    isOpen={activeSection === 'treatment'}
                    onToggle={() => setActiveSection(activeSection === 'treatment' ? '' : 'treatment')}
                >
                    <div className="space-y-3 md:space-y-4">
                        <div className="hidden md:flex gap-4 px-3 text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wider">
                            <div className="flex-[2]">Medicine</div>
                            <div className="flex-1">Dosage</div>
                            <div className="flex-1">Freq</div>
                            <div className="flex-1">Duration</div>
                            <div className="w-10"></div>
                        </div>
                        {medFields.map((field, index) => (
                            <div key={field.id} className="flex flex-col md:flex-row gap-2 md:gap-3 bg-white md:bg-transparent p-3 md:p-0 rounded-xl border border-slate-200 md:border-none shadow-sm md:shadow-none">
                                <div className="flex-[2] min-w-0">
                                    <label className="text-xs font-medium text-slate-600 md:hidden mb-1 block">Medicine</label>
                                    <Controller
                                        control={control}
                                        name={`meds.${index}.brand`}
                                        render={({ field: { onChange, value } }) => (
                                            <SmartInput
                                                label=""
                                                value={value}
                                                onChange={onChange}
                                                onSelect={(_, item) => {
                                                    if (item?.payload) {
                                                        const p = item.payload
                                                        if (p.dosage) setValue(`meds.${index}.dosage`, p.dosage)
                                                        if (p.freq) setValue(`meds.${index}.freq`, p.freq)
                                                        if (p.duration) setValue(`meds.${index}.duration`, p.duration)
                                                    }
                                                }}
                                                placeholder="Brand Name"
                                                table="medicines"
                                                category="medicines"
                                                doctorId={user?.id}
                                                className="w-full h-10 md:h-11 px-3 border border-slate-300 rounded-lg text-sm md:text-base"
                                            />
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 md:contents gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-medium text-slate-600 md:hidden mb-1 block">Dosage</label>
                                        <input
                                            {...register(`meds.${index}.dosage`)}
                                            className="w-full h-10 md:h-11 px-3 border border-slate-300 rounded-lg text-sm md:text-base"
                                            placeholder="500mg"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-medium text-slate-600 md:hidden mb-1 block">Frequency</label>
                                        <input
                                            {...register(`meds.${index}.freq`)}
                                            className="w-full h-10 md:h-11 px-3 border border-slate-300 rounded-lg text-sm md:text-base"
                                            placeholder="1+0+1"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-slate-600 md:hidden mb-1 block">Duration</label>
                                    <input
                                        {...register(`meds.${index}.duration`)}
                                        className="w-full h-10 md:h-11 px-3 border border-slate-300 rounded-lg text-sm md:text-base"
                                        placeholder="7 Days"
                                    />
                                </div>
                                <div className="md:hidden pt-1">
                                    <button type="button" onClick={() => removeMed(index)} className="w-full py-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center gap-2 text-sm font-medium border border-red-100">
                                        <Trash2 size={16} /> Remove Medicine
                                    </button>
                                </div>
                                <div className="hidden md:flex items-center justify-center">
                                    <button type="button" onClick={() => removeMed(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={() => addMed({ brand: '', dosage: '', freq: '', duration: '' })} className="w-full py-3 md:py-4 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:border-teal-500 hover:text-teal-600 font-medium transition-colors flex flex-col items-center justify-center gap-1 text-sm md:text-base">
                            <Plus size={20} className="md:w-6 md:h-6" />
                            Add Medicine
                        </button>
                    </div>
                </SectionCard>

                {/* Advice Section */}
                <SectionCard
                    title="Advice"
                    isOpen={activeSection === 'advice'}
                    onToggle={() => setActiveSection(activeSection === 'advice' ? '' : 'advice')}
                >
                    <div className="space-y-3">
                        {adviceFields.map((field, index) => (
                            <div key={field.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <Controller
                                    control={control}
                                    name={`advice.${index}.text`}
                                    render={({ field: { onChange, value } }) => (
                                        <SmartInput
                                            label=""
                                            value={value}
                                            onChange={onChange}
                                            placeholder="Advice"
                                            category="advice"
                                            doctorId={user?.id}
                                            className="w-full h-10 px-3 border border-slate-300 rounded-md"
                                        />
                                    )}
                                />
                                <button type="button" onClick={() => removeAdvice(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addAdvice({ text: '' })} className="flex items-center gap-2 text-teal-600 font-medium px-2 py-1 hover:bg-teal-50 rounded-lg">
                            <Plus size={18} /> Add Advice
                        </button>
                    </div>
                </SectionCard>

                {/* Tests Section */}
                <SectionCard
                    title="Investigations"
                    isOpen={activeSection === 'tests'}
                    onToggle={() => setActiveSection(activeSection === 'tests' ? '' : 'tests')}
                >
                    <div className="space-y-3">
                        {testFields.map((field, index) => (
                            <div key={field.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-slate-50 p-3 sm:p-2 rounded-lg border border-slate-200 sm:border-none">
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-medium text-slate-600 sm:hidden mb-1 block">Test Name</label>
                                    <Controller
                                        control={control}
                                        name={`tests.${index}.name`}
                                        render={({ field: { onChange, value } }) => (
                                            <SmartInput
                                                label=""
                                                value={value}
                                                onChange={onChange}
                                                placeholder="Test Name"
                                                category="tests"
                                                doctorId={user?.id}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-md"
                                            />
                                        )}
                                    />
                                </div>
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-medium text-slate-600 sm:hidden mb-1 block">Notes</label>
                                    <input
                                        {...register(`tests.${index}.notes`)}
                                        className="w-full h-10 px-3 border border-slate-300 rounded-md"
                                        placeholder="Notes"
                                    />
                                </div>
                                <button type="button" onClick={() => removeTest(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-md self-end sm:self-auto">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addTest({ name: '', notes: '' })} className="flex items-center gap-2 text-teal-600 font-medium px-2 py-1 hover:bg-teal-50 rounded-lg">
                            <Plus size={18} /> Add Test
                        </button>
                    </div>
                </SectionCard>

                {/* Notes Section */}
                <SectionCard
                    title="Clinical Notes"
                    isOpen={activeSection === 'notes'}
                    onToggle={() => setActiveSection(activeSection === 'notes' ? '' : 'notes')}
                >
                    <textarea
                        {...register('notes')}
                        className="w-full min-h-[120px] p-3 border border-slate-300 rounded-lg"
                        placeholder="Extra notes..."
                    />
                </SectionCard>
            </div>
        </div>
    )
}
