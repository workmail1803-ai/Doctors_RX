import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { MEDS_DATA } from '../data/meds'
import { Play, CheckCircle, AlertCircle } from 'lucide-react'

export default function AdminMigration() {
    const [progress, setProgress] = useState(0)
    const [total] = useState(MEDS_DATA.length)
    const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
    const [log, setLog] = useState<string[]>([])

    const BATCH_SIZE = 500

    const runMigration = async () => {
        if (!confirm(`Ready to migrate ${total} medicines?`)) return
        setStatus('running')
        setLog([])

        let processed = 0
        try {
            // Create chunks
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const chunk = MEDS_DATA.slice(i, i + BATCH_SIZE).map(m => ({
                    brand: m.brand,
                    form: m.form
                }))

                const { error } = await supabase.from('medicines').insert(chunk)

                if (error) {
                    throw error
                }

                processed += chunk.length
                setProgress(processed)
                setLog(prev => [`Inserted ${processed}/${total}...`, ...prev.slice(0, 4)])
            }
            setStatus('done')
            setLog(prev => ['Migration Complete!', ...prev])
        } catch (err: unknown) {
            const error = err as Error
            console.error(error)
            setStatus('error')
            setLog(prev => [`Error: ${error.message}`, ...prev])
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-8 space-y-6">
            <div className="bg-white rounded-xl shadow border p-6">
                <h1 className="text-2xl font-bold mb-4">Data Migration</h1>
                <p className="text-slate-600 mb-6">
                    Migrate <strong>{total}</strong> entries from <code>meds.ts</code> to Supabase.
                </p>

                <div className="mb-6">
                    <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${(progress / total) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                        <span>0</span>
                        <span>{progress} / {total}</span>
                    </div>
                </div>

                {status === 'idle' && (
                    <button onClick={runMigration} className="btn-primary w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg font-bold">
                        <Play size={20} /> Start Migration
                    </button>
                )}

                {status === 'running' && (
                    <div className="text-center text-primary font-medium animate-pulse">
                        Migrating... Please wait.
                    </div>
                )}

                {status === 'done' && (
                    <div className="text-center text-green-600 font-bold flex items-center justify-center gap-2">
                        <CheckCircle size={24} /> Done!
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center text-red-600 font-bold flex items-center justify-center gap-2">
                        <AlertCircle size={24} /> Failed
                    </div>
                )}

                <div className="mt-6 bg-slate-900 text-slate-400 p-4 rounded-lg font-mono text-xs h-32 overflow-auto">
                    {log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
            </div>
        </div>
    )
}
