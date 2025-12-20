import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { MEDS_DATA } from '../data/meds'
import { Loader2 } from 'lucide-react'
import { VoiceInput } from './VoiceInput'
import clsx from 'clsx'

type Suggestion = {
    label: string
    subtext?: string
    value: string
    payload?: any
}

type Props = {
    label: string
    value: string
    onChange: (value: string) => void
    onSelect?: (value: string, item?: Suggestion) => void
    placeholder?: string
    table?: 'medicines' | 'diseases'
    category?: 'medicines' | 'diseases' | 'tests' | 'advice' // For history-based suggestions
    doctorId?: string
    className?: string
}

export function SmartInput({ label, value, onChange, onSelect, placeholder, table, category, doctorId, className }: Props) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [loading, setLoading] = useState(false)
    const [show, setShow] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShow(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (!value || value.length < 2) {
                setSuggestions([])
                return
            }

            setLoading(true)
            try {
                let data: Suggestion[] = []
                const lowerVal = value.toLowerCase()

                // 1. LOCAL MEDICINE DATA (Always fast, no DB call)
                if (table === 'medicines') {
                    const filtered = MEDS_DATA
                        .filter(m => m.brand.toLowerCase().startsWith(lowerVal))
                        .slice(0, 30)

                    data = filtered.map(d => ({
                        label: d.brand,
                        subtext: d.form,
                        value: d.brand,
                        payload: { form: d.form }
                    }))
                }

                // 2. HISTORY-BASED SUGGESTIONS (Direct query, no RPC)
                if (category && doctorId) {
                    // Map category to actual column name
                    const columnMap: Record<string, string> = {
                        'medicines': 'meds',
                        'diseases': 'diseases',
                        'tests': 'tests',
                        'advice': 'advice'
                    }
                    const column = columnMap[category] || category

                    const { data: prescriptions, error } = await supabase
                        .from('prescriptions')
                        .select(column)
                        .eq('doctor_id', doctorId)
                        .order('created_at', { ascending: false })
                        .limit(50)

                    if (!error && prescriptions) {
                        const historyItems: Suggestion[] = []
                        const seen = new Set<string>()

                        prescriptions.forEach((rx: any) => {
                            if (category === 'medicines' && rx.meds) {
                                // Handle JSONB array of medicines
                                const meds = Array.isArray(rx.meds) ? rx.meds : []
                                meds.forEach((m: any) => {
                                    const brand = m.brand || ''
                                    if (brand.toLowerCase().startsWith(lowerVal) && !seen.has(brand.toLowerCase())) {
                                        seen.add(brand.toLowerCase())
                                        historyItems.push({
                                            label: brand,
                                            subtext: `${m.dosage || ''} - ${m.freq || ''} (history)`,
                                            value: brand,
                                            payload: { dosage: m.dosage, freq: m.freq, duration: m.duration }
                                        })
                                    }
                                })
                            } else if (category === 'diseases' && rx.diseases) {
                                const diseases = Array.isArray(rx.diseases) ? rx.diseases : []
                                diseases.forEach((d: any) => {
                                    const name = d.name || ''
                                    if (name.toLowerCase().startsWith(lowerVal) && !seen.has(name.toLowerCase())) {
                                        seen.add(name.toLowerCase())
                                        historyItems.push({
                                            label: name,
                                            subtext: 'Previously used',
                                            value: name
                                        })
                                    }
                                })
                            } else if (category === 'tests' && rx.tests) {
                                const tests = Array.isArray(rx.tests) ? rx.tests : []
                                tests.forEach((t: any) => {
                                    const name = t.name || ''
                                    if (name.toLowerCase().startsWith(lowerVal) && !seen.has(name.toLowerCase())) {
                                        seen.add(name.toLowerCase())
                                        historyItems.push({
                                            label: name,
                                            subtext: t.notes || 'Previously used',
                                            value: name
                                        })
                                    }
                                })
                            } else if (category === 'advice' && rx.advice) {
                                const adviceLines = (rx.advice || '').split('\n').map((s: string) => s.trim()).filter(Boolean)
                                adviceLines.forEach((line: string) => {
                                    if (line.toLowerCase().startsWith(lowerVal) && !seen.has(line.toLowerCase())) {
                                        seen.add(line.toLowerCase())
                                        historyItems.push({
                                            label: line,
                                            subtext: 'Previously used',
                                            value: line
                                        })
                                    }
                                })
                            }
                        })

                        // History items first, then local data
                        data = [...historyItems.slice(0, 15), ...data]
                    }
                }

                // Deduplicate by value
                const uniqueData = data.reduce((acc: Suggestion[], current) => {
                    const exists = acc.find(item => item.value.toLowerCase() === current.value.toLowerCase())
                    return exists ? acc : [...acc, current]
                }, [])

                setSuggestions(uniqueData.slice(0, 20))
                if (uniqueData.length > 0) setShow(true)
            } catch (err) {
                console.error('Suggestion fetch error', err)
            } finally {
                setLoading(false)
            }
        }

        const timer = setTimeout(fetchSuggestions, table === 'medicines' ? 100 : 300)
        return () => clearTimeout(timer)
    }, [value, table, category, doctorId])

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {label && <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>}
            <div className="relative w-full">
                <input
                    type="text"
                    className={clsx(
                        "w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-100 focus:border-slate-800 outline-none transition-all pr-20",
                        className
                    )}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value)
                        setShow(true)
                    }}
                    onFocus={() => {
                        if (suggestions.length > 0) setShow(true)
                    }}
                />
                {loading && (
                    <div className="absolute right-3 top-2.5">
                        <Loader2 className="animate-spin text-slate-400" size={16} />
                    </div>
                )}
                {!loading && (
                    <div className="absolute right-2 top-2">
                        <VoiceInput onResult={(text) => {
                            const newVal = value ? `${value} ${text}` : text
                            onChange(newVal)
                        }} />
                    </div>
                )}
            </div>

            {show && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-slate-100 max-h-60 overflow-auto">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex flex-col"
                            onClick={() => {
                                onChange(s.value)
                                onSelect?.(s.value, s)
                                setShow(false)
                            }}
                            type="button"
                        >
                            <span className="font-medium text-slate-900">{s.label}</span>
                            {s.subtext && <span className="text-xs text-slate-500">{s.subtext}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
