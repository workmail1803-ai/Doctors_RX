import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, ArrowLeft, Move, Save, RotateCcw } from 'lucide-react'
import type { Prescription, LayoutConfig } from '../types'

// Draggable Component
const Draggable = ({
    children,
    x,
    y,
    onDrag,
    enabled,
    label
}: {
    children: React.ReactNode,
    x: number,
    y: number,
    onDrag: (dx: number, dy: number) => void,
    enabled: boolean,
    label: string
}) => {
    const isDragging = useRef(false)
    const startPos = useRef({ x: 0, y: 0 })

    const getCoords = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY }
        }
        return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
    }

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!enabled) return
        e.stopPropagation()
        // Prevent default only if it's touch to ensure we don't block normal clicks too aggressively
        // though for drag handle, it's usually fine.
        isDragging.current = true
        const coords = getCoords(e)
        startPos.current = coords
    }

    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging.current) return

        // Prevent scrolling while dragging
        if (e.cancelable) e.preventDefault()

        const coords = getCoords(e)
        const dx = coords.x - startPos.current.x
        const dy = coords.y - startPos.current.y
        onDrag(dx, dy)
        startPos.current = coords
    }

    const handleEnd = () => {
        isDragging.current = false
    }

    useEffect(() => {
        if (enabled) {
            window.addEventListener('mousemove', handleMove)
            window.addEventListener('mouseup', handleEnd)
            // passive: false is required to use e.preventDefault()
            window.addEventListener('touchmove', handleMove, { passive: false })
            window.addEventListener('touchend', handleEnd)
        }
        return () => {
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleEnd)
            window.removeEventListener('touchmove', handleMove)
            window.removeEventListener('touchend', handleEnd)
        }
    }, [enabled])

    return (
        <div
            onMouseDown={handleStart}
            onTouchStart={handleStart}
            style={{
                position: 'absolute',
                top: y,
                left: x,
                cursor: enabled ? 'move' : 'default',
                zIndex: enabled ? 50 : 10,
                userSelect: 'none',
                touchAction: 'none' // Key for mobile performance
            }}
            // KEY FIX: Always keep border-2 and p-2. Just make them transparent when not enabled.
            // This prevents layout shift (jumping) when switching modes or printing.
            className={`
                min-w-[80px] min-h-[40px] rounded
                border-2 p-2 transition-colors
                ${enabled
                    ? 'border-dashed border-teal-500 bg-white/80 shadow-sm'
                    : 'border-transparent'
                }
            `}
        >
            {enabled && (
                <div className="absolute -top-6 left-0 bg-teal-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-50 pointer-events-none">
                    {label}
                </div>
            )}
            {children}
        </div>
    )
}

function PrescriptionBody({ data }: { data: Prescription }) {
    // Reusing the Standard Layout Body for non-template mode
    return (
        <div className="grid grid-cols-12 gap-8 min-h-[500px]">
            {/* Left Column: Complaints & Tests */}
            <div className="col-span-4 border-r border-slate-200 pr-4">
                {data.diseases && data.diseases.length > 0 && (
                    <div className="mb-6">
                        <h4 className="font-bold text-sm uppercase mb-2 text-slate-500">Dx / Problems</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {data.diseases.map((d, i) => (
                                <li key={i}>{d.name} {d.days && <span className="text-slate-500">({d.days})</span>}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {data.tests && data.tests.length > 0 && (
                    <div className="mb-6">
                        <h4 className="font-bold text-sm uppercase mb-2 text-slate-500">Tests</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {data.tests.map((t, i) => (
                                <li key={i}>{t.name}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {data.patient_info?.bp && (
                    <div className="mt-8 pt-4 border-t border-slate-100">
                        <p className="text-sm"><strong>BP:</strong> {data.patient_info.bp}</p>
                        {data.patient_info.weight && <p className="text-sm"><strong>Weight:</strong> {data.patient_info.weight} kg</p>}
                    </div>
                )}
            </div>

            {/* Right Column: Rx (Medicines) */}
            <div className="col-span-8">
                <h2 className="font-serif text-4xl italic text-slate-800 mb-6">Rx</h2>

                <div className="space-y-6">
                    {data.meds && data.meds.map((m, i) => (
                        <div key={i} className="mb-4">
                            <div className="flex items-baseline justify-between">
                                <h3 className="font-bold text-lg">{m.brand} <span className="text-sm font-normal text-slate-500 ml-1">{m.dosage}</span></h3>
                            </div>
                            <p className="text-sm mt-1 mb-1 font-mono">{m.freq} — {m.duration}</p>
                        </div>
                    ))}
                </div>

                {data.advice && (
                    <div className="mt-12 pt-6 border-t border-slate-200">
                        <h4 className="font-bold text-sm uppercase mb-2 text-slate-500">Advice</h4>
                        <p className="whitespace-pre-wrap">{data.advice}</p>
                    </div>
                )}

                {data.follow_up && (
                    <div className="mt-6">
                        <p className="text-sm font-bold">Follow up: <span className="font-normal">{data.follow_up}</span></p>
                    </div>
                )}
            </div>
        </div>
    )
}

// Main Component
export default function PrintPrescription() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<Prescription | null>(null)

    const [templateUrl, setTemplateUrl] = useState<string | null>(null)
    const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [savingLayout, setSavingLayout] = useState(false)

    // Scale for Mobile Responsiveness
    const [scale, setScale] = useState(1)

    // Defaults for absolute positioning
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

    // Handle Window Resize for Scale
    useEffect(() => {
        const handleResize = () => {
            // 210mm is approx 794px at 96dpi
            // We add some buffer for padding
            const a4WidthPx = 794;
            const availableWidth = window.innerWidth - 32; // 16px padding each side
            // If screen is smaller than A4, scale down. Otherwise scale is 1.
            const newScale = Math.min(1, Math.max(0.3, availableWidth / a4WidthPx));
            setScale(newScale);
        }
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        async function fetchPrescription() {
            if (!id) return
            const { data, error } = await supabase
                .from('prescriptions')
                .select('*')
                .eq('id', id)
                .single()

            if (error) {
                alert('Error fetching prescription')
                navigate('/')
            } else {
                setData(data)
                if (data.doctor_id) {
                    const { data: tmpl } = await supabase
                        .from('prescription_templates')
                        .select('background_pdf_path, layout_config')
                        .eq('doctor_id', data.doctor_id)
                        .maybeSingle()
                    if (tmpl?.background_pdf_path) setTemplateUrl(tmpl.background_pdf_path)

                    if (tmpl?.layout_config && Object.keys(tmpl.layout_config).length > 0) {
                        setLayoutConfig({ ...DEFAULTS, ...tmpl.layout_config as unknown as LayoutConfig })
                    } else {
                        setLayoutConfig(null) // Important: Standard layout by default
                    }
                }
            }
            setLoading(false)
        }
        fetchPrescription()
    }, [id, navigate])

    const handleEditLayout = () => {
        if (!layoutConfig) setLayoutConfig(DEFAULTS)
        setIsEditing(true)
    }

    const handleDrag = (key: keyof LayoutConfig, dx: number, dy: number) => {
        setLayoutConfig(prev => {
            if (!prev) return DEFAULTS // Should not happen if Draggables are rendered
            const current = (prev as any)[key] || { x: 0, y: 0 }

            // Apply Scale Correction:
            // Since the view is scaled down, a 1px mouse move equals 1/scale px in actual coordinates
            return {
                ...prev,
                [key]: { x: current.x + (dx / scale), y: current.y + (dy / scale) }
            }
        })
    }

    const handleSaveLayout = async () => {
        if (!data?.doctor_id || !layoutConfig) return
        setSavingLayout(true)
        try {
            const { data: existing } = await supabase
                .from('prescription_templates')
                .select('id')
                .eq('doctor_id', data.doctor_id)
                .maybeSingle()

            if (existing) {
                await supabase
                    .from('prescription_templates')
                    .update({ layout_config: layoutConfig })
                    .eq('id', existing.id)
            } else {
                await supabase
                    .from('prescription_templates')
                    .insert({ doctor_id: data.doctor_id, layout_config: layoutConfig })
            }
            setIsEditing(false)
            alert('Layout saved!')
        } catch (e: any) {
            alert('Error saving layout: ' + e.message)
        } finally {
            setSavingLayout(false)
        }
    }

    const handleResetLayout = async () => {
        if (!confirm("Reset layout to default? This will remove custom positioning.")) return;
        setLayoutConfig(null);
        const { data: existing } = await supabase
            .from('prescription_templates')
            .select('id')
            .eq('doctor_id', data?.doctor_id)
            .maybeSingle()
        if (existing) {
            await supabase.from('prescription_templates').update({ layout_config: {} }).eq('id', existing.id) // Save empty object to DB
        }
        setIsEditing(false)
    }

    const getPos = (key: keyof LayoutConfig) => {
        if (!layoutConfig) return { x: 0, y: 0 } // Fallback, though should be handled by showCustomLayout
        const conf = layoutConfig[key] || { x: 0, y: 0 }
        return { x: conf.x, y: conf.y }
    }

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>
    if (!data) return <div>No Data</div>

    // Show Custom Layout if: Editing OR Template Exists OR Layout is Configured
    const showCustomLayout = isEditing || !!templateUrl || !!layoutConfig;

    return (
        <div className="bg-white min-h-screen text-slate-900 leading-relaxed print:text-black">
            {/* Force A4 Page Size & Reset Margins */}
            <style type="text/css" media="print">
                {`
                    @page { size: A4; margin: 0mm; }
                    body {
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    /* Hide everything by default */
                    body * {
                        visibility: hidden;
                    }
                    /* Show only the printable area */
                    #printable-area, #printable-area * {
                        visibility: visible;
                    }
                    /* Position it strictly */
                    #printable-area {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 210mm;
                        height: 297mm;
                        margin: 0;
                        z-index: 9999;
                        background: white;
                        transform: none !important; /* Force reset scale */
                    }
                `}
            </style>

            {/* Control Bar (No Print) */}
            <div className="print:hidden p-2 md:p-4 bg-slate-100 flex items-center justify-between border-b border-slate-200 sticky top-0 z-50 shadow-sm gap-2">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium text-sm md:text-base">
                        <ArrowLeft size={18} /> <span className="hidden sm:inline">Back</span>
                    </button>
                    {isEditing && <span className="text-teal-700 font-bold bg-teal-100 px-2 py-0.5 rounded-full text-xs animate-pulse whitespace-nowrap">Editing</span>}
                </div>
                <div className="flex gap-2 overflow-x-auto">
                    {isEditing ? (
                        <>
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm whitespace-nowrap">Cancel</button>
                            <button onClick={handleResetLayout} className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Reset">
                                <RotateCcw size={18} />
                            </button>
                            <button onClick={handleSaveLayout} disabled={savingLayout} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 flex items-center gap-2 shadow-sm text-sm whitespace-nowrap">
                                {savingLayout ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleEditLayout}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium flex items-center gap-2 shadow-sm text-sm whitespace-nowrap"
                        >
                            <Move size={16} /> Edit
                        </button>
                    )}

                    <button
                        onClick={() => window.print()}
                        className="bg-slate-900 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-sm ml-1 text-sm whitespace-nowrap"
                    >
                        Print
                    </button>
                </div>
            </div>

            {/* Scaled Wrapper for Mobile */}
            <div className="flex justify-center w-full overflow-x-hidden pb-10 print:block print:w-full print:h-full print:pb-0 bg-slate-200/50">
                <div
                    style={{
                        width: scale === 1 ? '210mm' : `${scale * 794}px`, // 794px is approx 210mm
                        height: scale === 1 ? '297mm' : `${scale * 1123}px` // 1123px is approx 297mm
                    }}
                    className="relative transition-all duration-200 m-4 print:m-0"
                >
                    <div
                        id="printable-area"
                        style={{
                            transform: scale !== 1 ? `scale(${scale})` : undefined,
                            transformOrigin: 'top left',
                        }}
                        className="relative w-[210mm] h-[297mm] bg-white shadow-2xl print:shadow-none print:m-0 print:w-full print:h-full origin-top-left"
                    >

                        {/* Background Template */}
                        {templateUrl && (
                            <img
                                src={templateUrl}
                                className="absolute inset-0 w-full h-full object-cover z-0 print:block"
                                alt="Background"
                            />
                        )}

                        {/* Content Overlay */}
                        {/* Added p-8 padding here for standard layout, but removed for custom/editing to ensure Draggables are relative to the PAGE EDGES (0,0) */}
                        <div className={`relative z-10 h-full ${showCustomLayout ? '' : 'p-8'}`}>

                            {/* Standard Layout (Only if NOT Custom) */}
                            {!showCustomLayout && (
                                <>
                                    {/* Standard Header */}
                                    <header className="border-b-2 border-slate-800 pb-4 mb-6 flex justify-between items-start">
                                        <div>
                                            <h1 className="text-3xl font-bold text-slate-800 uppercase tracking-wide">Dr. Prescription</h1>
                                            <p className="font-medium text-slate-600">MBBS, FCPS (Medicine)</p>
                                            <p className="text-sm text-slate-500">Reg No: 123456</p>
                                        </div>
                                        <div className="text-right text-sm text-slate-600">
                                            <p><strong>Clinic Name</strong></p>
                                            <p>123 Medical Road, City</p>
                                            <p>Phone: +880 123 456 789</p>
                                        </div>
                                    </header>

                                    {/* Patient Info */}
                                    <div className="flex flex-wrap gap-x-8 gap-y-2 mb-6 border-b border-slate-300 pb-4 text-sm uppercase font-semibold text-slate-700">
                                        <div className="flex-1 min-w-[200px]">Name: <span className="text-black ml-1">{data.patient_name}</span></div>
                                        <div>Age: <span className="text-black ml-1">{data.patient_info?.age}Y</span></div>
                                        <div>Sex: <span className="text-black ml-1">{data.patient_info?.sex}</span></div>
                                        <div>Date: <span className="text-black ml-1">{new Date(data.created_at).toLocaleDateString()}</span></div>
                                    </div>

                                    <PrescriptionBody data={data} />

                                    {/* Footer */}
                                    <footer className="absolute bottom-8 left-8 right-8 flex justify-between items-end border-t-2 border-slate-800 pt-8">
                                        <div className="text-xs text-slate-400">
                                            Printed on {new Date().toLocaleString()}
                                        </div>
                                        <div className="text-center">
                                            <div className="h-16"></div> {/* Signature Space */}
                                            <p className="border-t border-slate-400 pt-1 px-8 text-sm font-medium">Signature</p>
                                        </div>
                                    </footer>
                                </>
                            )}

                            {/* Custom Draggable Layout */}
                            {showCustomLayout && (
                                <>
                                    {/* --- Header Info --- */}
                                    <Draggable label="Name" enabled={isEditing} {...getPos('patient_name_el')} onDrag={(dx, dy) => handleDrag('patient_name_el', dx, dy)}>
                                        <div className="text-lg font-bold">{data.patient_name}</div>
                                    </Draggable>

                                    <Draggable label="Age" enabled={isEditing} {...getPos('age_el')} onDrag={(dx, dy) => handleDrag('age_el', dx, dy)}>
                                        <div className="font-medium">{data.patient_info?.age ? `${data.patient_info.age}Y` : ''}</div>
                                    </Draggable>

                                    <Draggable label="Sex" enabled={isEditing} {...getPos('sex_el')} onDrag={(dx, dy) => handleDrag('sex_el', dx, dy)}>
                                        <div className="font-medium">{data.patient_info?.sex}</div>
                                    </Draggable>

                                    <Draggable label="Date" enabled={isEditing} {...getPos('date_el')} onDrag={(dx, dy) => handleDrag('date_el', dx, dy)}>
                                        <div className="font-medium">{new Date(data.created_at).toLocaleDateString()}</div>
                                    </Draggable>

                                    {/* --- Vitals --- */}
                                    <Draggable label="BP" enabled={isEditing} {...getPos('bp_el')} onDrag={(dx, dy) => handleDrag('bp_el', dx, dy)}>
                                        {data.patient_info?.bp && <div className="text-sm font-medium">BP: {data.patient_info.bp}</div>}
                                    </Draggable>

                                    <Draggable label="Weight" enabled={isEditing} {...getPos('weight_el')} onDrag={(dx, dy) => handleDrag('weight_el', dx, dy)}>
                                        {data.patient_info?.weight && <div className="text-sm font-medium">Wt: {data.patient_info.weight} kg</div>}
                                    </Draggable>

                                    <Draggable label="Examination" enabled={isEditing} {...getPos('examination_el')} onDrag={(dx, dy) => handleDrag('examination_el', dx, dy)}>
                                        {data.patient_info?.examination && data.patient_info.examination.length > 0 && (
                                            <div className="text-sm max-w-[200px]">
                                                <strong>O/E:</strong> {data.patient_info.examination.join(', ')}
                                            </div>
                                        )}
                                    </Draggable>

                                    {/* --- Left Column Body --- */}
                                    <Draggable label="Complaints" enabled={isEditing} {...getPos('complaints_el')} onDrag={(dx, dy) => handleDrag('complaints_el', dx, dy)}>
                                        <div className="max-w-[250px] min-h-[50px]">
                                            {data.diseases && data.diseases.length > 0 && (
                                                <div className="mb-4">
                                                    <h4 className="font-bold text-sm uppercase mb-1 text-slate-500">C/C</h4>
                                                    <ul className="space-y-1 text-sm">
                                                        {data.diseases.map((d, i) => (
                                                            <li key={i}>&bull; {d.name} {d.days && <span className="text-slate-500">({d.days})</span>}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </Draggable>

                                    <Draggable label="History" enabled={isEditing} {...getPos('history_el')} onDrag={(dx, dy) => handleDrag('history_el', dx, dy)}>
                                        {data.patient_info?.history && Object.entries(data.patient_info.history).some(([k, v]) => v && (data.patient_info.history_visibility as any)?.[k] !== false) && (
                                            <div className="max-w-[250px] text-sm">
                                                <h4 className="font-bold text-sm uppercase mb-1 text-slate-500">History</h4>
                                                {Object.entries(data.patient_info.history).map(([k, v]) => {
                                                    // Check visibility (default true)
                                                    const isVisible = (data.patient_info.history_visibility as any)?.[k] !== false
                                                    if (v && isVisible) {
                                                        return <div key={k}><span className="font-semibold">{k}:</span> {v}</div>
                                                    }
                                                    return null
                                                })}
                                            </div>
                                        )}
                                    </Draggable>

                                    <Draggable label="Tests" enabled={isEditing} {...getPos('tests_el')} onDrag={(dx, dy) => handleDrag('tests_el', dx, dy)}>
                                        <div className="max-w-[250px]">
                                            {data.tests && data.tests.length > 0 && (
                                                <div className="mb-4">
                                                    <h4 className="font-bold text-sm uppercase mb-1 text-slate-500">Tests</h4>
                                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                                        {data.tests.map((t, i) => (
                                                            <li key={i}>{t.name}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </Draggable>

                                    <Draggable label="Notes / Diagnosis" enabled={isEditing} {...getPos('diagnosis_el')} onDrag={(dx, dy) => handleDrag('diagnosis_el', dx, dy)}>
                                        {data.patient_info?.provisional_diagnosis && (
                                            <div className="max-w-[250px] text-sm">
                                                <h4 className="font-bold text-sm uppercase mb-1 text-slate-500">Note</h4>
                                                <p>{data.patient_info.provisional_diagnosis}</p>
                                            </div>
                                        )}
                                    </Draggable>

                                    {/* --- Right Column Body --- */}
                                    <Draggable label="Medicines (Rx)" enabled={isEditing} {...getPos('medicines_el')} onDrag={(dx, dy) => handleDrag('medicines_el', dx, dy)}>
                                        <div className="w-[400px] min-h-[50px]">
                                            <h2 className="font-serif text-3xl italic text-slate-800 mb-2 opacity-50">Rx</h2>
                                            <div className="space-y-4">
                                                {data.meds && data.meds.map((m, i) => (
                                                    <div key={i} className="mb-2">
                                                        <div className="font-bold text-base">{m.brand} <span className="text-sm font-normal text-slate-500 ml-1">{m.dosage}</span></div>
                                                        <div className="text-sm font-mono text-slate-600">{m.freq} — {m.duration}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </Draggable>

                                    <Draggable label="Advice" enabled={isEditing} {...getPos('advice_el')} onDrag={(dx, dy) => handleDrag('advice_el', dx, dy)}>
                                        <div className="w-[400px]">
                                            {data.advice && (
                                                <div>
                                                    <h4 className="font-bold text-sm uppercase mb-1 text-slate-500">Advice</h4>
                                                    <p className="whitespace-pre-wrap text-sm">{data.advice}</p>
                                                </div>
                                            )}
                                        </div>
                                    </Draggable>

                                    <Draggable label="Follow Up" enabled={isEditing} {...getPos('follow_up_el')} onDrag={(dx, dy) => handleDrag('follow_up_el', dx, dy)}>
                                        {data.follow_up && (
                                            <div className="text-sm font-medium">
                                                <strong className="text-slate-500 uppercase text-xs">Next Visit:</strong> {data.follow_up}
                                            </div>
                                        )}
                                    </Draggable>

                                    {/* --- Footer --- */}
                                    <Draggable label="Signature" enabled={isEditing} {...getPos('signature_el')} onDrag={(dx, dy) => handleDrag('signature_el', dx, dy)}>
                                        <div className="flex flex-col items-center">
                                            <div className="h-16 w-48 border-b border-slate-400 mb-1"></div>
                                            <div className="text-sm font-medium">Signature</div>
                                        </div>
                                    </Draggable>

                                </>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
