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
    provisionalDiagnosis: string
    meds: Medicine[]
    tests: Test[]
    advice: AdviceItem[]
    notes: string
    bp: string
    weight: string
    history: History
}

const EXAM_OPTIONS = [
    'Anemia', 'Jaundice', 'Lymph Node', 'Heart', 'Lungs', 'Liver', 'Spleen',
    'Abdomen', 'Skin', 'Eyes', 'Hydration', 'Oedema', 'Temperature',
    'Respiratory Rate', 'Pallor', 'Cyanosis', 'Clubbing', 'BP', 'Weight'
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
            bp: '',
            weight: '',
            provisionalDiagnosis: '',
            history: {
                pastIllness: '', birthHistory: '', feedingHistory: '',
                developmentHistory: '', treatmentHistory: '', familyHistory: ''
            }
        }
    })

    const { fields: diseaseFields, append: addDisease, remove: removeDisease } = useFieldArray({ control, name: 'diseases' })
    const { fields: medFields, append: addMed, remove: removeMed } = useFieldArray({ control, name: 'meds' })
    const { fields: testFields, append: addTest, remove: removeTest } = useFieldArray({ control, name: 'tests' })
    // eslint-disable-next-line
    const { fields: _adviceFields, append: _addAdvice, remove: _removeAdvice } = useFieldArray({ control, name: 'advice' })

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
        if (p.patient_info?.history) setValue('history', p.patient_info.history)

        // Load Meds & Complaints if they exist (Clone previous Rx)
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
                patient_info: {
                    age: data.age,
                    sex: data.sex,
                    follow_up: data.followUpDays,
                    history: data.history,
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
                window.location.href = `/print/${newRx.id}`
            } else {
                alert('Prescription Saved!')
                reset()
                // Reset to today
                setValue('date', new Date().toISOString().split('T')[0])
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <div className="col-span-2 lg:col-span-2 relative">
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

                        <input
                            {...register('age')}
                            type="text"
                            className="w-full h-10 md:h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm md:text-base"
                            placeholder="e.g. 45"
                        />
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
                                onClick={() => setValue('followUpDays', '5')}
                                className={clsx(
                                    "px-3 py-2 text-sm rounded-md border transition-colors",
                                    watch('followUpDays') === '5'
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-teal-400"
                                )}
                            >
                                5 Days
                            </button>
                            <button
                                type="button"
                                onClick={() => setValue('followUpDays', '7')}
                                className={clsx(
                                    "px-3 py-2 text-sm rounded-md border transition-colors",
                                    watch('followUpDays') === '7'
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-teal-400"
                                )}
                            >
                                7 Days
                            </button>
                            <button
                                type="button"
                                onClick={() => setValue('followUpDays', '15')}
                                className={clsx(
                                    "px-3 py-2 text-sm rounded-md border transition-colors",
                                    watch('followUpDays') === '15'
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-teal-400"
                                )}
                            >
                                15 Days
                            </button>
                            <button
                                type="button"
                                onClick={() => setValue('followUpDays', '30')}
                                className={clsx(
                                    "px-3 py-2 text-sm rounded-md border transition-colors",
                                    watch('followUpDays') === '30'
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-teal-400"
                                )}
                            >
                                1 Month
                            </button>
                            <input
                                {...register('followUpDays')}
                                type="number"
                                className="w-28 h-10 px-3 border border-slate-300 rounded-lg"
                                placeholder="Custom days"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Dynamic Sections */}
            <div className="space-y-4">
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
                                                table="diseases"
                                                className="w-full h-10 px-3 border border-slate-300 rounded-md"
                                            />
                                        )}
                                    />
                                </div>
                                <input
                                    {...register(`diseases.${index}.days`)}
                                    type="text"
                                    className="w-24 h-10 px-3 border border-slate-300 rounded-md"
                                    placeholder="Days"
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
                                    placeholder="kg"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Clinical Examination Findings</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {EXAM_OPTIONS.map((opt) => (
                                    <label key={opt} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            value={opt}
                                            {...register('examination')}
                                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                        />
                                        <span className="text-sm">{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
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
                                                placeholder="Brand Name"
                                                table="medicines"
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
                                    <input
                                        {...register(`tests.${index}.name`)}
                                        className="w-full h-10 px-3 border border-slate-300 rounded-md"
                                        placeholder="Test Name"
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
