import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Save, Printer, ChevronDown, ChevronUp, FileText, Loader2, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SmartInput } from '../components/SmartInput'
import { useAuth } from '../components/AuthProvider'
import clsx from 'clsx'

// Types
import type { Disease, Medicine, Test, History, AdviceItem, LayoutConfig } from '../types'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'

// Draggable Input Wrapper
const DraggableInput = ({
    x, y, onDrag, children, label, enabled, scale = 1
}: {
    x: number, y: number, onDrag: (dx: number, dy: number) => void, children: React.ReactNode, label: string, enabled: boolean, scale?: number
}) => {
    const [isDragging, setIsDragging] = useState(false)
    const startPos = useState({ x: 0, y: 0 })[0]

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!enabled) return
        if ((e.target as HTMLElement).closest('button')) return

        e.preventDefault()
        setIsDragging(true)
        startPos.x = e.clientX
        startPos.y = e.clientY
    }

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!enabled) return
        if ((e.target as HTMLElement).closest('button')) return

        // Prevent default is handled via touch-action: none in styles for this element
        // We also call preventDefault here to stop input focus/keyboard popup
        // e.preventDefault() // NOTE: Calling this on touchstart might block scrolling if not careful, 
        // but we want to BLOCK scrolling when dragging, so it is correct combined with touch-action: none.
        // However, React's synthetic event might delay it. native event is e.nativeEvent.

        setIsDragging(true)
        startPos.x = e.touches[0].clientX
        startPos.y = e.touches[0].clientY
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return
            const dx = (e.clientX - startPos.x) / scale
            const dy = (e.clientY - startPos.y) / scale
            onDrag(dx, dy)
            startPos.x = e.clientX
            startPos.y = e.clientY
        }
        const handleMouseUp = () => setIsDragging(false)

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return
            if (e.cancelable) e.preventDefault()
            const dx = (e.touches[0].clientX - startPos.x) / scale
            const dy = (e.touches[0].clientY - startPos.y) / scale
            onDrag(dx, dy)
            startPos.x = e.touches[0].clientX
            startPos.y = e.touches[0].clientY
        }
        const handleTouchEnd = () => setIsDragging(false)

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            window.addEventListener('touchmove', handleTouchMove, { passive: false })
            window.addEventListener('touchend', handleTouchEnd)
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            window.removeEventListener('touchmove', handleTouchMove)
            window.removeEventListener('touchend', handleTouchEnd)
        }
    }, [isDragging, onDrag, startPos, scale])

    return (
        <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{
                position: 'absolute',
                left: x,
                top: y,
                cursor: enabled ? 'move' : 'default',
                zIndex: 10,
                touchAction: enabled ? 'none' : 'auto'
            }}
            className={clsx(
                "transition-all group",
                enabled ? "border border-dashed border-teal-500/50 hover:border-teal-500 bg-white/40 p-1 rounded hover:bg-white/80" : ""
            )}
        >
            {enabled && (
                <div className="absolute -top-4 left-0 bg-teal-600/80 text-white text-[9px] px-1 py-0 rounded-sm shadow-sm whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    {label}
                </div>
            )}
            {children}
        </div>
    )
}

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

const EXAMINATION_DATA: Record<string, { [key: string]: string[] }> = {
    'Anemia': {
        'Severity': ['Mild', 'Moderate', 'Severe'],
        'Clinical Type': ['Iron Deficiency', 'Thalassemia', 'Megaloblastic', 'Hemolytic', 'Aplastic']
    },
    'Jaundice': {
        'Severity': ['Mild', 'Moderate', 'Deep/Severe'],
        'Cause': ['Pre-hepatic', 'Hepatic', 'Post-hepatic']
    },
    'Lymph Node': {
        'Location': ['Cervical', 'Axillary', 'Inguinal', 'Supraclavicular'],
        'Consistency': ['Soft', 'Rubber', 'Hard/Matted']
    },
    'Heart': {
        'Sounds': ['S1', 'S2', 'S3', 'S4', 'Murmur'],
        'Murmurs': ['Systolic Murmur', 'Diastolic Murmur'],
        'Rhythm': ['Regular', 'Irregular (AF)']
    },
    'Lungs': {
        'Breath Sounds': ['Vesicular', 'Bronchial'],
        'Added Sounds': ['Wheeze', 'Crepitations', 'Rhonchi', 'Pleural Rub']
    },
    'Liver': {
        'Size': ['Just palpable', '1 finger', '2 finger', '3 finger'],
        'Consistency': ['Soft', 'Firm', 'Hard', 'Nodular'],
        'Tenderness': ['Tender', 'Non-tender']
    },
    'Spleen': {
        'Size': ['Mild', 'Moderate', 'Massive', 'Palpable tip']
    },
    'Abdomen': {
        'Distension': ['Gas', 'Fluid (Ascites)', 'Fetus', 'Fat', 'Tumor'],
        'Tenderness': ['Generalized', 'Localized', 'Non-tender'],
        'Ascites': ['Mild', 'Moderate', 'Tense']
    },
    'Skin': {
        'Lesions': ['Macule', 'Papule', 'Vesicle', 'Pustule'],
        'Conditions': ['Scabies', 'Ringworm', 'Eczema', 'Psoriasis'],
        'Turgor': ['Reduced']
    },
    'Eyes': {
        'Pupils': ['Dilated', 'Constricted', 'Reactive to light'],
        'Sclera': ['Icteric', 'Muddy'],
        'Conjunctiva': ['Pale', 'Congested']
    },
    'Hydration': {
        'Status': ['Well hydrated', 'Some dehydration', 'Severe dehydration']
    },
    'Oedema': {
        'Type': ['Pitting', 'Non-pitting'],
        'Location': ['Pedal', 'Sacral', 'Anasarca']
    },
    'Temperature': {
        'Type': ['Febrile', 'Hypothermia'],
        'Grade': ['Low grade', 'High grade'],
        'Pattern': ['Continuous', 'Intermittent', 'Remittent']
    },
    'Respiratory Rate': {
        'Status': ['Normal', 'Tachypnea', 'Bradypnea']
    },
    'Cyanosis': {
        'Type': ['Central', 'Peripheral']
    },
    'Clubbing': {
        'Grade': ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4']
    }
}

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

    // Assistant/Pending State
    const [searchParams] = useSearchParams()
    const pendingId = searchParams.get('id')

    // Visual Mode State
    const [isVisualMode, setIsVisualMode] = useState(false)
    const [isLayoutEditing, setIsLayoutEditing] = useState(false)
    const [templateUrl, setTemplateUrl] = useState<string | null>(null)
    const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null)
    const [savingLayout, setSavingLayout] = useState(false)
    const [scale, setScale] = useState(1)

    // Handle Mobile Response Scaling
    useEffect(() => {
        const handleResize = () => {
            const availableWidth = window.innerWidth - 32
            const BASE_WIDTH = 794

            if (availableWidth < BASE_WIDTH) {
                const newScale = availableWidth / BASE_WIDTH
                setScale(newScale)
            } else {
                setScale(1)
            }
        }
        handleResize()
    }, [])

    const zoomIn = () => setScale(s => Math.min(s + 0.1, 1.5))
    const zoomOut = () => setScale(s => Math.max(s - 0.1, 0.3))
    const fitWidth = () => {
        const availableWidth = window.innerWidth - 32
        const BASE_WIDTH = 794
        setScale(availableWidth < BASE_WIDTH ? availableWidth / BASE_WIDTH : 1)
    }

    // Defaults
    const DEFAULTS: LayoutConfig = {
        patient_name_el: { x: 50, y: 150 },
        age_el: { x: 400, y: 150 },
        sex_el: { x: 500, y: 150 },
        date_el: { x: 650, y: 150 },
        bp_el: { x: 50, y: 220 },
        weight_el: { x: 150, y: 220 },
        examination_el: { x: 50, y: 250 },
        complaints_el: { x: 50, y: 300 },
        history_el: { x: 50, y: 400 },
        tests_el: { x: 50, y: 500 },
        diagnosis_el: { x: 50, y: 600 },
        medicines_el: { x: 350, y: 300 },
        advice_el: { x: 350, y: 600 },
        follow_up_el: { x: 350, y: 750 },
        signature_el: { x: 550, y: 900 },
    }

    useEffect(() => {
        if (user?.id) {
            supabase.from('prescription_templates')
                .select('background_pdf_path, layout_config')
                .eq('doctor_id', user.id)
                .maybeSingle()
                .then(({ data }) => {
                    if (data?.background_pdf_path) {
                        setTemplateUrl(data.background_pdf_path)
                    }
                    if (data?.layout_config && Object.keys(data.layout_config).length > 0) {
                        setLayoutConfig({ ...DEFAULTS, ...data.layout_config as unknown as LayoutConfig })
                    } else {
                        setLayoutConfig(DEFAULTS)
                    }
                })
        }
    }, [user?.id])

    const handleDrag = (key: keyof LayoutConfig, dx: number, dy: number) => {
        setLayoutConfig(prev => {
            if (!prev) return DEFAULTS
            const current = (prev as any)[key] || { x: 0, y: 0 }
            return {
                ...prev,
                [key]: { x: current.x + dx, y: current.y + dy }
            }
        })
    }

    const saveLayout = async () => {
        if (!user?.id || !layoutConfig) return
        setSavingLayout(true)
        try {
            const { data: existing } = await supabase
                .from('prescription_templates')
                .select('id')
                .eq('doctor_id', user.id)
                .maybeSingle()

            if (existing) {
                await supabase.from('prescription_templates').update({ layout_config: layoutConfig }).eq('id', existing.id)
            } else {
                await supabase.from('prescription_templates').insert({ doctor_id: user.id, layout_config: layoutConfig })
            }
        } catch (e) { console.error(e) }
        finally { setSavingLayout(false) }
    }

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



    // Load Pending Prescription if ID is present
    useEffect(() => {
        if (pendingId) {
            loadPendingPrescription(pendingId)
        }
    }, [pendingId])

    async function loadPendingPrescription(id: string) {
        const { data } = await supabase
            .from('prescriptions')
            .select('*')
            .eq('id', id)
            .single()

        if (data) {
            // Populate Form
            setValue('patientName', data.patient_name)
            if (data.patient_info) {
                setValue('age', data.patient_info.age || '')
                setValue('sex', data.patient_info.sex || 'Male')
                setValue('bp', data.patient_info.bp || '')
                setValue('weight', data.patient_info.weight || '')
                setValue('examDetails', data.patient_info.exam_details || {})
                // If assistant added temp/notes in exam_details, we load them

                // Map exam_details to 'examination' checkboxes if they exist key-wise?
                // Or just keep them in details. 
                // Assistant form sets: Temperature, Notes.
                // We should probably preserve them.
            }
        }
    }

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
            const payload: any = {
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
                status: 'completed',
                created_at: pendingId ? undefined : new Date().toISOString()
            }

            if (pendingId) delete payload.created_at

            let result
            if (pendingId) {
                result = await supabase
                    .from('prescriptions')
                    .update(payload)
                    .eq('id', pendingId)
                    .select()
                    .single()
            } else {
                result = await supabase
                    .from('prescriptions')
                    .insert({ ...payload, created_at: new Date().toISOString() })
                    .select()
                    .single()
            }

            const { data: newRx, error } = result
            if (error) throw error
            if (shouldPrint && newRx) {
                window.location.href = `/print/${newRx.id}`
            } else {
                alert('Prescription Saved!')
                reset()
                setValue('date', new Date().toISOString().split('T')[0])
                setSuggestedProtocol(null)
                // If we edited a pending one, maybe go back to dashboard?
                if (pendingId) {
                    window.history.back() // or navigate('/dashboard')
                }
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
            {/* Top Toolbar Container */}
            <div className="mb-4 bg-white rounded-xl shadow-sm border border-slate-200 sticky top-0 z-30">

                {/* Row 1: Global Mode & Main Actions */}
                <div className="flex flex-col md:flex-row justify-between items-center p-3 gap-3 border-b border-slate-100">
                    <div className="flex w-full md:w-auto items-center justify-between md:justify-start gap-4">
                        {templateUrl && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-500 hidden md:inline">Mode:</span>
                                <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                                    <button
                                        onClick={() => setIsVisualMode(false)}
                                        className={clsx("px-3 py-1 rounded-md text-xs md:text-sm font-medium transition-all", !isVisualMode ? "bg-white shadow-sm text-slate-900 border border-slate-100" : "text-slate-500 hover:text-slate-700")}
                                    >
                                        Standard
                                    </button>
                                    <button
                                        onClick={() => setIsVisualMode(true)}
                                        className={clsx("px-3 py-1 rounded-md text-xs md:text-sm font-medium transition-all", isVisualMode ? "bg-teal-600 shadow-sm text-white" : "text-slate-500 hover:text-slate-700")}
                                    >
                                        Template Mode
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Mobile Action Shortcuts (hidden on desktop) */}
                        <div className="flex md:hidden gap-2">
                            <button
                                type="button"
                                onClick={handleSubmit((d) => onSubmit(d, false))}
                                disabled={saving}
                                className="p-2 bg-teal-50 text-teal-700 rounded-lg border border-teal-100"
                                title="Save"
                            >
                                <Save size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit((d) => onSubmit(d, true))}
                                disabled={saving}
                                className="p-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100"
                                title="Save & Print"
                            >
                                <Printer size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Desktop Main Actions */}
                    <div className="hidden md:flex gap-2">
                        <button
                            type="button"
                            onClick={handleSubmit((d) => onSubmit(d, false))}
                            disabled={saving}
                            className="px-4 py-2 bg-teal-600 text-white font-medium rounded-lg shadow-sm hover:bg-teal-700 flex items-center gap-2 text-sm"
                        >
                            <Save size={18} /> {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit((d) => onSubmit(d, true))}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 flex items-center gap-2 text-sm"
                        >
                            <Printer size={18} /> Save & Print
                        </button>
                    </div>
                </div>

                {/* Row 2: Visual Editor Context Controls (Only if Visual Mode) */}
                {isVisualMode && (
                    <div className="flex flex-wrap items-center justify-between p-2 bg-slate-50/80 backdrop-blur text-sm gap-y-2 rounded-b-xl">
                        {/* Left: Edit Toggle */}
                        <div className="flex items-center gap-2">
                            <div className="flex bg-white rounded-md border border-slate-200 p-0.5">
                                <button
                                    onClick={() => setIsLayoutEditing(false)}
                                    className={clsx("px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all", !isLayoutEditing ? "bg-teal-50 text-teal-700 border border-teal-100 shadow-sm" : "text-slate-500 hover:bg-slate-50")}
                                >
                                    <FileText size={12} /> Write
                                </button>
                                <button
                                    onClick={() => setIsLayoutEditing(true)}
                                    className={clsx("px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all", isLayoutEditing ? "bg-yellow-50 text-yellow-700 border border-yellow-100 shadow-sm" : "text-slate-500 hover:bg-slate-50")}
                                >
                                    <Maximize size={12} /> Adjust Layout
                                </button>
                            </div>

                            {isLayoutEditing && (
                                <button
                                    onClick={saveLayout}
                                    disabled={savingLayout}
                                    className="px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-600 font-medium hover:text-teal-600 hover:border-teal-200 disabled:opacity-50"
                                >
                                    {savingLayout ? 'Saving...' : 'Save Positions'}
                                </button>
                            )}
                        </div>

                        {/* Right: Zoom Controls */}
                        <div className="flex items-center gap-1 border bg-white border-slate-200 rounded-md p-0.5 shadow-sm">
                            <button onClick={zoomOut} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="Zoom Out"><ZoomOut size={14} /></button>
                            <span className="text-[10px] w-8 text-center text-slate-600 font-mono font-medium">{Math.round(scale * 100)}%</span>
                            <button onClick={zoomIn} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="Zoom In"><ZoomIn size={14} /></button>
                            <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
                            <button onClick={fitWidth} className="p-1 hover:bg-slate-100 rounded text-teal-600" title="Fit to Screen"><Maximize size={14} /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* Visual Editor Mode */}
            {
                isVisualMode && templateUrl && layoutConfig ? (
                    <div
                        className="relative w-full overflow-hidden bg-slate-200 p-4 md:p-8 rounded-xl border border-slate-300 flex justify-center items-start min-h-[500px]"
                    >
                        {/* Layout Shim Container - Mimics the SCALED size in the DOM flow */}
                        <div
                            style={{
                                width: `${794 * scale}px`,
                                height: `${1123 * scale}px`,
                                position: 'relative',
                                flexShrink: 0
                            }}
                        >
                            {/* Scaled A4 Content */}
                            <div
                                className="bg-white shadow-2xl origin-top-left absolute top-0 left-0"
                                style={{
                                    width: '794px', // Fixed A4 width (approx)
                                    height: '1123px', // Fixed A4 height (approx)
                                    transform: `scale(${scale})`
                                }}
                            >
                                {/* Background */}
                                <img src={templateUrl} className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" alt="" />

                                {/* Draggable Inputs */}

                                {/* Name */}
                                <DraggableInput
                                    label="Name"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.patient_name_el?.x || 0}
                                    y={layoutConfig.patient_name_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('patient_name_el', dx, dy)}
                                >
                                    <input
                                        {...register('patientName')}
                                        onChange={(e) => handlePatientSearch(e.target.value)}
                                        placeholder="Name"
                                        className={clsx(
                                            "text-sm focus:ring-1 focus:ring-teal-500 w-[180px]",
                                            isLayoutEditing ? "bg-white/80 border border-slate-300 rounded px-1 py-0.5" : "bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-400/50"
                                        )}
                                    />
                                    {/* Autocomplete */}
                                    {showPatientSuggestions && patientSuggestions.length > 0 && (
                                        <div className="absolute top-full left-0 w-full bg-white shadow-lg border rounded-b z-50 max-h-40 overflow-auto">
                                            {patientSuggestions.map(p => (
                                                <div key={p.id} onClick={() => loadPatient(p)} className="p-2 hover:bg-slate-100 cursor-pointer text-xs truncate">
                                                    {p.patient_name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </DraggableInput>

                                {/* Age */}
                                <DraggableInput
                                    label="Age"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.age_el?.x || 0}
                                    y={layoutConfig.age_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('age_el', dx, dy)}
                                >
                                    <div className={clsx("flex gap-1 w-[100px]", isLayoutEditing ? "bg-white/80 px-1 rounded border border-slate-200" : "bg-transparent p-0 border-none")}>
                                        <input
                                            value={ageNum}
                                            onChange={(e) => updateAge(e.target.value, ageUnit)}
                                            placeholder="Age"
                                            className="w-full bg-transparent text-sm outline-none p-0"
                                        />
                                        <span className="text-[10px] text-slate-500 self-center">{ageUnit}</span>
                                    </div>
                                </DraggableInput>

                                {/* Date */}
                                <DraggableInput
                                    label="Date"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.date_el?.x || 0}
                                    y={layoutConfig.date_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('date_el', dx, dy)}
                                >
                                    <input
                                        {...register('date')}
                                        type="date"
                                        className={clsx("text-sm w-[110px]", isLayoutEditing ? "bg-white/80 border border-slate-300 rounded px-1 py-0.5" : "bg-transparent border-none p-0 focus:ring-0")}
                                    />
                                </DraggableInput>

                                {/* Rx (Medicines) */}
                                <DraggableInput
                                    label="Medicines"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.medicines_el?.x || 0}
                                    y={layoutConfig.medicines_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('medicines_el', dx, dy)}
                                >
                                    <div className={clsx("w-[400px] min-h-[100px]", isLayoutEditing ? "bg-white/50 border border-slate-200/50 rounded p-2" : "p-0")}>
                                        <h3 className={clsx("text-xs font-bold mb-2 uppercase select-none", isLayoutEditing ? "text-slate-400" : "text-transparent")}>Rx</h3>
                                        <div className="space-y-1">
                                            {medFields.map((field, index) => (
                                                <div key={field.id} className={clsx("flex gap-1 items-center", isLayoutEditing ? "bg-white/80 p-1 rounded shadow-sm" : "")}>
                                                    <div className="w-1/3">
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
                                                                    placeholder="Brand"
                                                                    table="medicines"
                                                                    category="medicines"
                                                                    doctorId={user?.id}
                                                                    className="w-full text-xs border-b border-transparent focus:border-teal-500 outline-none bg-transparent font-medium p-0"
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                    <input {...register(`meds.${index}.dosage`)} placeholder="Dose" className="w-1/4 text-xs border-b border-transparent focus:border-teal-500 outline-none bg-transparent" />
                                                    <input {...register(`meds.${index}.freq`)} placeholder="Freq" className="w-1/4 text-xs border-b border-transparent focus:border-teal-500 outline-none bg-transparent" />
                                                    <button type="button" onClick={() => removeMed(index)} className={clsx("text-red-400 hover:text-red-600", !isLayoutEditing && "opacity-0 hover:opacity-100")}><Trash2 size={12} /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addMed({ brand: '', dosage: '', freq: '', duration: '' })} className="text-xs text-teal-600 hover:underline flex items-center gap-1 mt-2">
                                                <Plus size={12} /> Add Med
                                            </button>
                                        </div>
                                    </div>
                                </DraggableInput>

                                {/* Complaints */}
                                <DraggableInput label="Complaints" enabled={isLayoutEditing} scale={scale} x={layoutConfig.complaints_el?.x || 0} y={layoutConfig.complaints_el?.y || 0} onDrag={(dx, dy) => handleDrag('complaints_el', dx, dy)}>
                                    <div className={clsx("w-[250px]", isLayoutEditing ? "bg-white/50 border border-slate-200/50 rounded p-2" : "p-0")}>
                                        <h3 className={clsx("text-xs font-bold mb-1 select-none", isLayoutEditing ? "text-slate-400" : "text-transparent")}>C/C</h3>
                                        {diseaseFields.map((field, index) => (
                                            <div key={field.id} className="flex gap-1 mb-1">
                                                <input {...register(`diseases.${index}.name`)} placeholder="Complaint" className={clsx("w-full text-xs bg-transparent border-none p-0 focus:ring-0", isLayoutEditing && "bg-white/80 border rounded px-1")} />
                                                <input {...register(`diseases.${index}.days`)} placeholder="Days" className={clsx("w-[50px] text-xs bg-transparent border-none p-0 focus:ring-0", isLayoutEditing && "bg-white/80 border rounded px-1")} />
                                                <button type="button" onClick={() => removeDisease(index)} className={clsx("text-red-400", !isLayoutEditing && "opacity-0 hover:opacity-100")}><Trash2 size={12} /></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addDisease({ name: '', days: '' })} className="text-xs text-teal-600"><Plus size={10} className="inline" /> Add</button>
                                    </div>
                                </DraggableInput>

                                {/* Tests */}
                                <DraggableInput label="Tests" enabled={isLayoutEditing} scale={scale} x={layoutConfig.tests_el?.x || 0} y={layoutConfig.tests_el?.y || 0} onDrag={(dx, dy) => handleDrag('tests_el', dx, dy)}>
                                    <div className={clsx("w-[250px]", isLayoutEditing ? "bg-white/50 border border-slate-200/50 rounded p-2" : "p-0")}>
                                        <h3 className={clsx("text-xs font-bold mb-1 select-none", isLayoutEditing ? "text-slate-400" : "text-transparent")}>Tests</h3>
                                        {testFields.map((field, index) => (
                                            <div key={field.id} className="flex gap-1 mb-1">
                                                <input {...register(`tests.${index}.name`)} placeholder="Test Name" className={clsx("w-full text-xs bg-transparent border-none p-0 focus:ring-0", isLayoutEditing && "bg-white/80 border rounded px-1")} />
                                                <button type="button" onClick={() => removeTest(index)} className={clsx("text-red-400", !isLayoutEditing && "opacity-0 hover:opacity-100")}><Trash2 size={12} /></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addTest({ name: '', notes: '' })} className="text-xs text-teal-600"><Plus size={10} className="inline" /> Add</button>
                                    </div>
                                </DraggableInput>

                                {/* Diagnosis/Notes */}
                                <DraggableInput label="Diagnosis" enabled={isLayoutEditing} scale={scale} x={layoutConfig.diagnosis_el?.x || 0} y={layoutConfig.diagnosis_el?.y || 0} onDrag={(dx, dy) => handleDrag('diagnosis_el', dx, dy)}>
                                    <textarea {...register('provisionalDiagnosis')} placeholder="Diagnosis" className={clsx("w-[250px] h-[60px] text-xs resize-none", isLayoutEditing ? "bg-white/80 border border-slate-300 rounded p-1" : "bg-transparent border-none p-0 focus:ring-0")} />
                                </DraggableInput>

                                {/* Advice */}
                                <DraggableInput label="Advice" enabled={isLayoutEditing} scale={scale} x={layoutConfig.advice_el?.x || 0} y={layoutConfig.advice_el?.y || 0} onDrag={(dx, dy) => handleDrag('advice_el', dx, dy)}>
                                    <div className={clsx("w-[350px]", isLayoutEditing ? "bg-white/50 p-2 border border-slate-200/50 rounded" : "p-0")}>
                                        <h3 className={clsx("text-xs font-bold mb-1 select-none", isLayoutEditing ? "text-slate-400" : "text-transparent")}>Advice</h3>
                                        {adviceFields.map((field, index) => (
                                            <div key={field.id} className="flex gap-1 mb-1">
                                                <input {...register(`advice.${index}.text`)} className={clsx("w-full text-xs bg-transparent border-none p-0 focus:ring-0", isLayoutEditing && "bg-white/80 border rounded px-1")} />
                                                <button type="button" onClick={() => removeAdvice(index)} className={clsx("text-red-400", !isLayoutEditing && "opacity-0 hover:opacity-100")}><Trash2 size={12} /></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addAdvice({ text: '' })} className="text-xs text-teal-600"><Plus size={10} className="inline" /> Add Advice</button>
                                    </div>
                                </DraggableInput>

                                {/* Sex */}
                                <DraggableInput
                                    label="Sex"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.sex_el?.x || 0}
                                    y={layoutConfig.sex_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('sex_el', dx, dy)}
                                >
                                    <select
                                        {...register('sex')}
                                        className={clsx("text-sm w-[80px]", isLayoutEditing ? "bg-white/80 border border-slate-300 rounded px-2 py-1" : "bg-transparent border-none p-0")}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </DraggableInput>

                                {/* Vitals (BP & Weight) */}
                                <DraggableInput
                                    label="BP"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.bp_el?.x || 0}
                                    y={layoutConfig.bp_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('bp_el', dx, dy)}
                                >
                                    <div className={clsx("flex items-center gap-1 rounded px-2 py-1", isLayoutEditing ? "bg-white/80 border border-slate-300" : "bg-transparent border-none p-0")}>
                                        <span className="text-xs font-bold text-slate-500">BP:</span>
                                        <input {...register('bp')} placeholder="120/80" className="w-[80px] text-sm bg-transparent outline-none" />
                                    </div>
                                </DraggableInput>

                                <DraggableInput
                                    label="Weight"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.weight_el?.x || 0}
                                    y={layoutConfig.weight_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('weight_el', dx, dy)}
                                >
                                    <div className={clsx("flex items-center gap-1 rounded px-2 py-1", isLayoutEditing ? "bg-white/80 border border-slate-300" : "bg-transparent border-none p-0")}>
                                        <span className="text-xs font-bold text-slate-500">Wt:</span>
                                        <input {...register('weight')} placeholder="Kg" className="w-[80px] text-sm bg-transparent outline-none" />
                                    </div>
                                </DraggableInput>

                                {/* Examination */}
                                <DraggableInput
                                    label="Examination"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.examination_el?.x || 0}
                                    y={layoutConfig.examination_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('examination_el', dx, dy)}
                                >
                                    <div className={clsx("w-[250px]", isLayoutEditing ? "bg-white/50 border border-slate-200/50 rounded p-1" : "p-0")}>
                                        <h3 className={clsx("text-[10px] font-bold mb-1 select-none", isLayoutEditing ? "text-slate-400" : "text-transparent")}>O/E</h3>
                                        <div className="flex flex-wrap gap-1 max-h-[150px] overflow-y-auto">
                                            {EXAM_OPTIONS.slice(0, 8).map(opt => (
                                                <label key={opt} className={clsx("flex items-center gap-1 text-[10px] px-1 rounded", isLayoutEditing ? "bg-white/60 border" : "bg-transparent")}>
                                                    <input type="checkbox" value={opt} {...register('examination')} className="w-2.5 h-2.5" /> {opt}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </DraggableInput>

                                {/* History */}
                                <DraggableInput
                                    label="History"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.history_el?.x || 0}
                                    y={layoutConfig.history_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('history_el', dx, dy)}
                                >
                                    <textarea
                                        {...register('history.pastIllness')}
                                        placeholder="History"
                                        className={clsx("w-[250px] h-[60px] text-xs resize-none", isLayoutEditing ? "bg-white/80 border border-slate-300 rounded p-1" : "bg-transparent border-none p-0 focus:ring-0")}
                                    />
                                </DraggableInput>

                                {/* Follow Up */}
                                <DraggableInput
                                    label="Follow Up"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.follow_up_el?.x || 0}
                                    y={layoutConfig.follow_up_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('follow_up_el', dx, dy)}
                                >
                                    <div className={clsx("flex gap-1 items-center rounded px-2 py-1", isLayoutEditing ? "bg-white/80 border border-slate-300" : "bg-transparent border-none p-0")}>
                                        <span className="text-xs font-bold text-slate-500">Next:</span>
                                        <input
                                            {...register('followUpDays')}
                                            placeholder="e.g. 7 Days"
                                            className="w-[100px] text-sm bg-transparent outline-none"
                                        />
                                    </div>
                                </DraggableInput>

                                {/* Signature Placeholder */}
                                <DraggableInput
                                    label="Signature"
                                    enabled={isLayoutEditing}
                                    scale={scale}
                                    x={layoutConfig.signature_el?.x || 0}
                                    y={layoutConfig.signature_el?.y || 0}
                                    onDrag={(dx, dy) => handleDrag('signature_el', dx, dy)}
                                >
                                    <div className={clsx("w-[150px] h-[40px] flex items-end justify-center text-xs text-slate-500", isLayoutEditing ? "border-b-2 border-slate-400 bg-white/30" : "border-none bg-transparent")}>
                                        {isLayoutEditing ? "Signature" : ""}
                                    </div>
                                </DraggableInput>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
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

                                                        {isChecked && EXAMINATION_DATA[opt] && (
                                                            <div className="mt-2 pl-6 flex flex-wrap gap-2">
                                                                {Object.entries(EXAMINATION_DATA[opt]).map(([subCat, subOpts]) => (
                                                                    <div key={subCat} className="flex items-center gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-slate-400">{subCat}:</span>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {subOpts.map(so => (
                                                                                <button
                                                                                    key={so}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const current = watch(`examDetails.${opt}`) || ''
                                                                                        const newVal = current ? `${current}, ${so}` : so
                                                                                        setValue(`examDetails.${opt}`, newVal)
                                                                                    }}
                                                                                    className="px-2 py-0.5 text-xs bg-white border border-slate-200 rounded hover:border-teal-400 hover:text-teal-600 transition-colors"
                                                                                >
                                                                                    {so}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
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
        </div>
    )
}
