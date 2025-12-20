import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff } from 'lucide-react'

type Props = {
    onResult: (text: string) => void
    className?: string
    iconSize?: number
}

export function VoiceInput({ onResult, className, iconSize = 18 }: Props) {
    const [isListening, setIsListening] = useState(false)
    const [isSupported, setIsSupported] = useState(true)
    const [lang, setLang] = useState<'en-US' | 'bn-IN'>('bn-IN') // Default to Indian Bangla
    const recognitionRef = useRef<any>(null)

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setIsSupported(false)
            return
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        const recognition = new SpeechRecognition()

        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = lang

        recognition.onstart = () => setIsListening(true)

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript
            if (transcript) onResult(transcript)
        }

        recognition.onerror = (_event: any) => {
            // console.warn('Speech recognition error', event.error)
            setIsListening(false)
        }

        recognition.onend = () => setIsListening(false)

        recognitionRef.current = recognition

        return () => {
            if (recognition) recognition.stop()
        }
    }, [onResult, lang])

    const toggleListening = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!isSupported) return
        if (isListening) recognitionRef.current?.stop()
        else recognitionRef.current?.start()
    }

    const toggleLang = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setLang(l => l === 'en-US' ? 'bn-IN' : 'en-US')
    }

    if (!isSupported) return null

    return (
        <div
            className={`flex items-center gap-0.5 bg-transparent rounded-lg transition-all select-none ${isListening ? 'bg-red-50 ring-1 ring-red-100' : ''
                } ${className || ''}`}
        >
            {/* Mic Button */}
            <button
                type="button"
                onClick={toggleListening}
                className={`p-1.5 rounded-md flex items-center justify-center transition-all ${isListening
                    ? 'text-red-500 animate-pulse'
                    : 'text-slate-400 hover:text-teal-600 hover:bg-slate-100'
                    }`}
                title="Click to Record"
            >
                {isListening ? <MicOff size={iconSize} /> : <Mic size={iconSize} />}
            </button>

            {/* Language Toggle (Small Text) */}
            <button
                type="button"
                onClick={toggleLang}
                className={`px-1 py-0.5 text-[9px] font-bold rounded hover:bg-slate-100 transition-colors uppercase ${lang === 'bn-IN'
                    ? 'text-teal-600'
                    : 'text-slate-400'
                    }`}
                title="Switch Language (Tap)"
            >
                {lang === 'bn-IN' ? 'বাং' : 'EN'}
            </button>
        </div>
    )
}
