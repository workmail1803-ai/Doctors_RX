import { AssistantManager } from '../../components/AssistantManager'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function ManageAssistant() {
    const navigate = useNavigate()

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 transition-colors"
            >
                <ArrowLeft size={20} />
                Back
            </button>

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Manage Assistant</h1>
                <p className="text-slate-500">Link an assistant to your account to delegate patient vitals entry.</p>
            </div>

            <AssistantManager />
        </div>
    )
}
