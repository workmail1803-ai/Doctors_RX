import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { MEDS_DATA } from '../data/meds'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

type Suggestion = {
    label: string
    subtext?: string
    value: string
}

type Props = {
    label: string
    value: string
    onChange: (value: string) => void
    onSelect?: (value: string) => void
    placeholder?: string
    table?: 'medicines' | 'diseases' // simplified for now
    rpcName?: string
    rpcParams?: (searchTerm: string) => Record<string, any>
    className?: string
}

export function SmartInput({ label, value, onChange, onSelect, placeholder, table, rpcName, rpcParams, className }: Props) {
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
                let data: any[] = []

                if (table === 'medicines') {
                    // Local Search Mode using meds.ts (FAST & RELIABLE)
                    const lowerVal = value.toLowerCase()
                    const filtered = MEDS_DATA
                        .filter(m => m.brand.toLowerCase().startsWith(lowerVal))
                        .slice(0, 50) // Increased limit since it's local and fast

                    data = filtered.map(d => ({
                        label: d.brand,
                        subtext: d.form,
                        value: d.brand
                    }))

                } else if (rpcName) {
                    // RPC Mode (Smart Suggestions)
                    const { data: rpcData, error } = await supabase.rpc(rpcName, rpcParams ? rpcParams(value) : {})
                    if (!error && rpcData) data = rpcData.map((d: any) => ({
                        label: d.brand,
                        subtext: d.form + (d.usage_count ? ` (${d.usage_count} uses)` : ''),
                        value: d.brand
                    }))
                } else if (table) {
                    // Generic Table Search via Supabase (Fallback for diseases etc)
                    const { data: tableData, error } = await supabase
                        .from(table)
                        .select('*') // Select all to be safe, filter in map if needed
                        .ilike('name', `${value}%`) // Assuming 'name' column for other tables
                        .limit(10)

                    if (!error && tableData) data = tableData.map(d => ({
                        label: d.name || d.brand, // Fallback for various table structures
                        subtext: d.form || '',
                        value: d.name || d.brand
                    }))
                }

                setSuggestions(data)
                if (data.length > 0) setShow(true)
            } catch (err) {
                console.error('Suggestion fetch error', err)
            } finally {
                setLoading(false)
            }
        }

        // Debounce (shorter delay for local data)
        const timer = setTimeout(fetchSuggestions, table === 'medicines' ? 100 : 300)
        return () => clearTimeout(timer)
    }, [value, table, rpcName])

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {label && <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>}
            <div className="relative w-full">
                <input
                    type="text"
                    className={clsx(
                        "w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-100 focus:border-slate-800 outline-none transition-all pr-10", // Added pr-10 for icon space
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
            </div>

            {show && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-slate-100 max-h-60 overflow-auto">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex flex-col"
                            onClick={() => {
                                onChange(s.value)
                                onSelect?.(s.value)
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
