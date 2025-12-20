import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { Plus, Trash2, Save, Printer, ChevronDown, ChevronUp, FileText, Loader2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SmartInput } from './SmartInput'
import { VoiceTextarea } from './VoiceTextarea'
import { useAuth } from './AuthProvider'
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

const EXAM_OPTIONS = [
    'Anemia', 'Jaundice', 'Lymph Node', 'Heart', 'Lungs', 'Liver', 'Spleen',
    'Abdomen', 'Skin', 'Eyes', 'Hydration', 'Oedema', 'Temperature',
    'Respiratory Rate', 'Pallor', 'Cyanosis', 'Clubbing', 'BP', 'Weight'
]

// SectionCard Component (Internal Helper)
function SectionCard({ title, children, isOpen, onToggle }: { title: string, children: React.ReactNode, isOpen: boolean, onToggle: () => void }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-200 mb-4">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                tabIndex={-1} // Prevent tab focus mainly for button if not needed
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOpen ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                        <FileText size={20} />
                    </div>
                    <span className="font-semibold text-slate-800 text-left">{title}</span>
                </div>
                {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>
            {isOpen && (
                <div className="p-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    )
}

interface PrescriptionFormProps {
    initialPatientName?: string
    onSave?: () => void
    onCancel?: () => void
    isModal?: boolean
}

export default function PrescriptionForm({ initialPatientName = '', onSave, onCancel, isModal = false }: PrescriptionFormProps) {
    const { user } = useAuth()
    const [saving, setSaving] = useState(false)
    const [activeSection, setActiveSection] = useState<string>('patient')

    // Patient Search State
    const [patientSuggestions, setPatientSuggestions] = useState<any[]>([])
    const [showPatientSuggestions, setShowPatientSuggestions] = useState(false)
    const [searchingPatients, setSearchingPatients] = useState(false)

    const { control, register, handleSubmit, setValue, reset } = useForm<FormData>({
        defaultValues: {
            patientName: initialPatientName,
            date: new Date().toISOString().split('T')[0],
            sex: 'Male',
            followUpDays: '',
            diseases: [{ name: '', days: '' }],
            meds: [{ brand: '', dosage: '', freq: '', duration: '' }],
            tests: [],
            advice: [],
            examination: [],
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

    // Update form if prop changes
    useEffect(() => {
        if (initialPatientName) setValue('patientName', initialPatientName)
    }, [initialPatientName, setValue])

    const { fields: diseaseFields, append: addDisease, remove: removeDisease } = useFieldArray({ control, name: 'diseases' })
    const { fields: medFields, append: addMed, remove: removeMed } = useFieldArray({ control, name: 'meds' })
    const { fields: testFields, append: addTest, remove: removeTest } = useFieldArray({ control, name: 'tests' })
    const { fields: adviceFields, append: addAdvice, remove: removeAdvice } = useFieldArray({ control, name: 'advice' })

    // Auto-search patients debounced (Click outside handler)
    useEffect(() => {
        const handleClick = () => setTimeout(() => setShowPatientSuggestions(false), 200)
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
        setValue('weight', p.patient_info?.weight || '')

        if (p.patient_info?.history) {
            setValue('history', p.patient_info.history)
            if (p.patient_info.history_visibility) {
                setValue('historyVisibility', p.patient_info.history_visibility)
            }
        }

        if (p.meds && p.meds.length > 0) setValue('meds', p.meds)
        if (p.diseases && p.diseases.length > 0) setValue('diseases', p.diseases)
        if (p.tests && p.tests.length > 0) setValue('tests', p.tests)

        setShowPatientSuggestions(false)
    }

    const onSubmit = async (data: FormData, shouldPrint = false) => {
        if (!user) return
        setSaving(true)
        try {
            const { data: newRx, error } = await supabase.from('prescriptions').insert({
                doctor_id: user.id,
                patient_name: data.patientName,
                // TODO: If we had a confirmed patient_id passed in props, we should use it here!
                // patient_id: props.patientId, 
                patient_info: {
                    age: data.age,
                    sex: data.sex,
                    follow_up: data.followUpDays,
                    history: data.history,
                    history_visibility: data.historyVisibility,
                    examination: data.examination,
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
                window.open(`/print/${newRx.id}`, '_blank')
            } else {
                if (!isModal) alert('Prescription Saved!')
                reset()
                setValue('date', new Date().toISOString().split('T')[0])
                if (onSave) onSave()
            }
        } catch (e: unknown) {
            const err = e as Error
            alert('Error saving: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className={clsx("w-full bg-slate-50", isModal ? "p-0" : "max-w-4xl mx-auto space-y-4 md:space-y-6 pb-20 px-2 md:px-4")}>

            {/* Header / Actions */}
            <div className={clsx(
                "flex flex-wrap items-center justify-between gap-2 mb-4 bg-white p-3 rounded-xl border border-slate-200 sticky top-0 z-30 shadow-sm",
                isModal && "rounded-t-none border-t-0 border-x-0"
            )}>
                <h2 className="text-lg font-bold text-slate-800 px-2">
                    {isModal ? 'Write Prescription' : 'New Prescription'}
                </h2>
                <div className="flex gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden"
                        >
                            <X size={20} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSubmit((d) => onSubmit(d, false))}
                        disabled={saving}
                        className="px-3 py-1.5 md:px-4 md:py-2 bg-teal-600 text-white font-medium rounded-lg shadow-sm hover:bg-teal-700 flex items-center gap-1.5 md:gap-2 text-sm"
                    >
                        <Save size={16} /> {saving ? 'Saving...' : 'Send/Save'}
                    </button>
                    {!isModal && (
                        <button
                            type="button"
                            onClick={handleSubmit((d) => onSubmit(d, true))}
                            disabled={saving}
                            className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 flex items-center gap-1.5 md:gap-2 text-sm"
                        >
                            <Printer size={16} /> Print
                        </button>
                    )}
                </div>
            </div>

            <div className={clsx(isModal && "px-4 pb-20 overflow-y-auto h-[calc(100vh-140px)]")}>
                {/* Patient Details Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 mb-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="col-span-2 lg:col-span-2 relative">
                            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                            <div className="relative">
                                <input
                                    {...register('patientName', { required: true })}
                                    onChange={(e) => handlePatientSearch(e.target.value)}
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-base md:text-sm"
                                    placeholder="Patient Name"
                                    autoComplete="off"
                                />
                                {searchingPatients && (
                                    <div className="absolute right-3 top-2.5">
                                        <Loader2 className="animate-spin text-slate-400" size={16} />
                                    </div>
                                )}
                            </div>

                            {/* Autocomplete Dropdown */}
                            {showPatientSuggestions && patientSuggestions.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                    {patientSuggestions.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => loadPatient(p)}
                                            className="w-full text-left px-4 py-3 hover:bg-teal-50 transition-colors border-b border-slate-50 group"
                                        >
                                            <div className="font-medium text-slate-900 group-hover:text-teal-700 text-sm">
                                                {p.patient_name}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {p.patient_info?.age} • {p.patient_info?.sex}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Age</label>
                            <input
                                {...register('age')}
                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-base md:text-sm"
                                placeholder="Age"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Sex</label>
                            <select
                                {...register('sex')}
                                className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-white text-base md:text-sm"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Diagnosis Section */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Provisional Diagnosis / সম্ভাব্য রোগ</label>
                    <Controller
                        control={control}
                        name="provisionalDiagnosis"
                        render={({ field: { onChange, value } }) => (
                            <SmartInput
                                label=""
                                value={value}
                                onChange={onChange}
                                placeholder="Enter Diagnosis / রোগ লিখুন"
                                category="diseases"
                                doctorId={user?.id}
                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-base md:text-sm"
                            />
                        )}
                    />
                </div>

                {/* Collapsible Sections */}

                <SectionCard title="Complaints / সমস্যা" isOpen={activeSection === 'diseases'} onToggle={() => setActiveSection(activeSection === 'diseases' ? '' : 'diseases')}>
                    <div className="space-y-3">
                        {diseaseFields.map((field, index) => (
                            <div key={field.id} className="flex gap-2 items-center">
                                <div className="flex-1">
                                    <Controller
                                        control={control}
                                        name={`diseases.${index}.name`}
                                        render={({ field: { onChange, value } }) => (
                                            <SmartInput
                                                label=""
                                                value={value}
                                                onChange={onChange}
                                                placeholder="Complaint"
                                                table="diseases"
                                                className="w-full h-10 px-3 border border-slate-300 rounded-md text-base md:text-sm"
                                            />
                                        )}
                                    />
                                </div>
                                <input
                                    {...register(`diseases.${index}.days`)}
                                    className="w-20 h-10 px-3 border border-slate-300 rounded-md text-base md:text-sm"
                                    placeholder="Days"
                                />
                                <button type="button" onClick={() => removeDisease(index)} className="p-2 text-red-500 bg-red-50 rounded-md">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addDisease({ name: '', days: '' })} className="text-teal-600 text-sm font-medium flex items-center gap-1">
                            <Plus size={16} /> Add Complaint
                        </button>
                    </div>
                </SectionCard>

                <SectionCard title="History / ইতিহাস" isOpen={activeSection === 'history'} onToggle={() => setActiveSection(activeSection === 'history' ? '' : 'history')}>
                    <Controller
                        control={control}
                        name="history.pastIllness"
                        render={({ field: { onChange, value } }) => (
                            <VoiceTextarea
                                value={value}
                                onChange={onChange} // Standard onChange works now as VoiceTextarea handles events
                                setValue={(val) => setValue('history.pastIllness', val)} // Direct set value for voice result
                                className="w-full h-20 p-3 border border-slate-300 rounded-lg text-base md:text-sm"
                                placeholder="Past Illness, History / অতীত ইতিহাস..."
                            />
                        )}
                    />
                </SectionCard>

                <SectionCard title="Vitals & Exam / শারীরিক পরীক্ষা" isOpen={activeSection === 'exam'} onToggle={() => setActiveSection(activeSection === 'exam' ? '' : 'exam')}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input {...register('bp')} placeholder="BP (120/80)" className="h-10 px-3 border border-slate-300 rounded-lg text-base md:text-sm" />
                        <input {...register('weight')} placeholder="Weight (kg)" className="h-10 px-3 border border-slate-300 rounded-lg text-base md:text-sm" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {EXAM_OPTIONS.slice(0, 8).map(opt => (
                            <label key={opt} className="px-2 py-1 border rounded text-xs cursor-pointer hover:bg-slate-50">
                                <input type="checkbox" value={opt} {...register('examination')} className="mr-1" /> {opt}
                            </label>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title="Medicines / ঔষধ" isOpen={activeSection === 'treatment'} onToggle={() => setActiveSection(activeSection === 'treatment' ? '' : 'treatment')}>
                    <div className="space-y-3">
                        {medFields.map((field, index) => (
                            <div key={field.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                                <Controller
                                    control={control}
                                    name={`meds.${index}.brand`}
                                    render={({ field: { onChange, value } }) => (
                                        <SmartInput label="" value={value} onChange={onChange} placeholder="Medicine Name / ঔষধের নাম" table="medicines" className="w-full h-10 px-3 border border-slate-300 rounded-md text-base md:text-sm font-medium" />
                                    )}
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <input {...register(`meds.${index}.dosage`)} placeholder="Dose (500mg)" className="h-9 px-2 border rounded text-base md:text-sm" />
                                    <input {...register(`meds.${index}.freq`)} placeholder="Freq (1+0+1)" className="h-9 px-2 border rounded text-base md:text-sm" />
                                    <input {...register(`meds.${index}.duration`)} placeholder="Dur (5d)" className="h-9 px-2 border rounded text-base md:text-sm" />
                                </div>
                                <button type="button" onClick={() => removeMed(index)} className="w-full py-1 text-red-500 text-xs bg-white border border-red-100 rounded">Remove</button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addMed({ brand: '', dosage: '', freq: '', duration: '' })} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                            <Plus size={18} /> Add Medicine
                        </button>
                    </div>
                </SectionCard>

                <SectionCard title="Advice & Tests / পরামর্শ ও পরীক্ষা" isOpen={activeSection === 'advice'} onToggle={() => setActiveSection(activeSection === 'advice' ? '' : 'advice')}>
                    <div className="space-y-3">
                        {testFields.map((field, index) => (
                            <div key={field.id} className="flex gap-2">
                                <Controller
                                    control={control}
                                    name={`tests.${index}.name`}
                                    render={({ field: { onChange, value } }) => (
                                        <SmartInput
                                            label=""
                                            value={value}
                                            onChange={onChange}
                                            placeholder="Test Name / পরীক্ষার নাম"
                                            category="tests"
                                            doctorId={user?.id}
                                            className="flex-1 h-9 px-2 border rounded text-base md:text-sm"
                                        />
                                    )}
                                />
                                <button type="button" onClick={() => removeTest(index)} className="text-red-500"><Trash2 size={16} /></button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addTest({ name: '', notes: '' })} className="text-teal-600 text-xs font-bold uppercase mb-4">+ Add Test</button>

                        {adviceFields.map((field, index) => (
                            <div key={field.id} className="flex gap-2">
                                <input {...register(`advice.${index}.text`)} placeholder="Advice / পরামর্শ" className="flex-1 h-9 px-2 border rounded text-base md:text-sm" />
                                <button type="button" onClick={() => removeAdvice(index)} className="text-red-500"><Trash2 size={16} /></button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addAdvice({ text: '' })} className="text-teal-600 text-xs font-bold uppercase">+ Add Advice</button>
                    </div>
                </SectionCard>

                {/* Additional Notes */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Additional Notes / মন্তব্য</label>
                    <Controller
                        control={control}
                        name="notes"
                        render={({ field: { onChange, value } }) => (
                            <VoiceTextarea
                                value={value}
                                onChange={onChange}
                                setValue={(val) => setValue('notes', val)}
                                className="w-full h-20 p-3 border border-slate-300 rounded-lg text-base md:text-sm"
                                placeholder="Any private notes / মন্তব্য..."
                            />
                        )}
                    />
                </div>
            </div>
        </div>
    )
}
