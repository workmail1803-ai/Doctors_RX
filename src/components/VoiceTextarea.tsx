import { forwardRef } from 'react'
import { VoiceInput } from './VoiceInput'
import clsx from 'clsx'

interface VoiceTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onVoiceResult?: (text: string) => void
    setValue?: (val: string) => void // Optional helper for react-hook-form
}

export const VoiceTextarea = forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(
    ({ className, onChange, onVoiceResult, setValue, value, ...props }, ref) => {

        const handleVoice = (text: string) => {
            const current = (value as string) || ''
            const newVal = current ? `${current} ${text}` : text

            // Trigger customized change if provided
            if (setValue) {
                setValue(newVal)
            } else if (onVoiceResult) {
                onVoiceResult(text)
            }

            // Note: If using raw register without Controller, setValue is key.
            // If using standard onChange, we might need to synthesize an event, 
            // but react-hook-form's setValue is cleaner.
        }

        return (
            <div className="relative w-full">
                <textarea
                    ref={ref}
                    className={clsx("pr-10", className)} // Ensure space for mic
                    value={value}
                    onChange={onChange}
                    {...props}
                />
                <div className="absolute right-2 top-2 z-10">
                    <VoiceInput onResult={handleVoice} />
                </div>
            </div>
        )
    }
)

VoiceTextarea.displayName = 'VoiceTextarea'
