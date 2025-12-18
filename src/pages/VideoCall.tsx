import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import Peer from 'peerjs'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Copy, User, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'


export default function VideoCall() {
    const navigate = useNavigate()
    const { appointmentId } = useParams()
    const { user } = useAuth()

    const [peerId, setPeerId] = useState<string>('')
    const [remotePeerIdValue, setRemotePeerIdValue] = useState('')
    const [callActive, setCallActive] = useState(false)
    const [incomingCall, setIncomingCall] = useState<any>(null)
    const [statusText, setStatusText] = useState('Initializing...')

    // Media States
    const [micOn, setMicOn] = useState(true)
    const [cameraOn, setCameraOn] = useState(true)

    const peerInstance = useRef<Peer | null>(null)
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const currentCall = useRef<any>(null)
    const localStreamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        const peer = new Peer()
        peerInstance.current = peer

        // 1. Setup Peer
        peer.on('open', (id) => {
            setPeerId(id)
            setStatusText('Waiting for other party...')
            if (appointmentId && user) {
                updateSignalingId(id)
            }
        })

        peer.on('call', (call) => {
            // Auto Answer if in same appointment context? 
            // For now, let's keep manual answer or auto-answer if we can verify.
            // Let's stick to manual answer for safety OR auto-answer if we trust the flow.
            // Given the requirement "call will automatically begin", let's AUTO ANSWER.
            setIncomingCall(call)
            // answerCall(call) - requires stream to be ready. Logic handled in incomingCall effect?
            // Better: Set it in state, then check if we have stream and answer immediately.
        })

        // 2. Get Media
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                localStreamRef.current = stream
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream
                }
            })
            .catch((err) => {
                console.error('Failed to get local stream', err)
                setStatusText('Error accessing camera')
            })

        // 3. Signaling Subscription (if appointmentId exists)
        let channel: any;
        if (appointmentId) {
            channel = supabase.channel(`room-${appointmentId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `id=eq.${appointmentId}` },
                    (payload) => {
                        handleSignalingUpdate(payload.new)
                    }
                )
                .subscribe()

            // Initial fetch to check if other party is already waiting
            checkExistingPeer()
        }

        return () => {
            peer.destroy()
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop())
            }
            if (channel) supabase.removeChannel(channel)
            // Optional: Remove ID from DB on exit?
        }
    }, [appointmentId, user])

    // Auto-Answer Effect
    useEffect(() => {
        if (incomingCall && localStreamRef.current && !callActive) {
            // Auto-answer
            console.log('Auto-answering incoming call...')
            incomingCall.answer(localStreamRef.current)
            currentCall.current = incomingCall
            incomingCall.on('stream', (remoteStream: MediaStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream
                }
                setCallActive(true)
                setStatusText('Connected')
            })
            setIncomingCall(null)
        }
    }, [incomingCall])

    const updateSignalingId = async (id: string) => {
        if (!user || !appointmentId) return

        // Determine if I am doctor or patient based on some logic or just update both?
        // Better to know who I am. We can query the appointment or use profile.
        // Quick hack: Update `doctor_peer_id` if I am the doctor_id in the row, else `patient_peer_id`.
        // We'll fetch the appointment first to know our role in it.
        const { data } = await supabase.from('appointments').select('*').eq('id', appointmentId).single()

        if (data) {
            const updates: any = {}
            if (user.id === data.doctor_id) updates.doctor_peer_id = id
            else if (user.id === data.patient_id) updates.patient_peer_id = id

            if (Object.keys(updates).length > 0) {
                await supabase.from('appointments').update(updates).eq('id', appointmentId)
            }
        }
    }

    const checkExistingPeer = async () => {
        const { data } = await supabase.from('appointments').select('*').eq('id', appointmentId).single()
        if (data) handleSignalingUpdate(data)
    }

    const handleSignalingUpdate = (data: any) => {
        if (!user || !peerInstance.current) return

        // Who am I?
        const isDoctor = user.id === data.doctor_id

        const targetPeerId = isDoctor ? data.patient_peer_id : data.doctor_peer_id

        if (targetPeerId && !currentCall.current && !incomingCall) {
            console.log('Found target peer:', targetPeerId)
            // If I am doctor, I call. If I am patient, I wait (or vice versa).
            // Let's make Doctor the caller to avoid collision.
            if (isDoctor) {
                console.log('Initiating call to', targetPeerId)
                startCall(targetPeerId)
            }
        }
    }

    // ... existing startCall needs access to localStreamRef, which is already in scope 
    // but the defined startCall function in previous code might be separate. 
    // We will overwrite/merge.



    const startCall = (remoteId: string) => {
        if (!localStreamRef.current || !peerInstance.current) return

        console.log('Calling:', remoteId)
        setStatusText('Calling...')
        const call = peerInstance.current.call(remoteId, localStreamRef.current)
        currentCall.current = call

        call.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream
            }
            setCallActive(true)
            setStatusText('Connected')
        })

        call.on('error', (err) => {
            console.error('Call error:', err)
            setStatusText('Call Failed')
        })
    }

    const endCall = () => {
        currentCall.current?.close()
        setCallActive(false)
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null
        }
    }

    const toggleMic = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !micOn)
            setMicOn(!micOn)
        }
    }

    const toggleCamera = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => track.enabled = !cameraOn)
            setCameraOn(!cameraOn)
        }
    }

    const handleExit = () => {
        // Explicitly stop tracks before navigating
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop())
        }
        navigate(-1)
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(peerId)
        alert('ID copied to clipboard!')
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-900 rounded-xl overflow-hidden relative">

            {/* Main Video Area */}
            <div className="flex-1 relative flex items-center justify-center bg-black">
                {/* Remote Video (Full Screen) */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    className="w-full h-full object-cover"
                />

                {!callActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                        <User size={64} className="mb-4 opacity-50" />
                        <p className="text-xl font-medium">{statusText}</p>
                    </div>
                )}

                {/* Local Video (PiP) */}
                <div className="absolute top-4 right-4 w-48 aspect-video bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        className="w-full h-full object-cover mirror"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                    <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                        You
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="h-24 bg-slate-800 border-t border-slate-700 flex items-center justify-between px-8">

                {/* Connection Info */}
                <div className="text-white">
                    <p className="text-xs text-slate-400 mb-1">Your Call ID</p>
                    <div className="flex items-center gap-2 bg-slate-700 px-3 py-1.5 rounded text-sm font-mono">
                        {peerId || 'Generating...'}
                        <button onClick={copyToClipboard} className="hover:text-teal-400 transition-colors">
                            <Copy size={14} />
                        </button>
                    </div>
                </div>

                {/* Call Controls */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleMic}
                        className={`p-4 rounded-full transition-all ${micOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                        title={micOn ? "Mute Microphone" : "Unmute Microphone"}
                    >
                        {micOn ? <Mic size={24} /> : <MicOff size={24} />}
                    </button>

                    <button
                        onClick={toggleCamera}
                        className={`p-4 rounded-full transition-all ${cameraOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                        title={cameraOn ? "Turn Off Camera" : "Turn On Camera"}
                    >
                        {cameraOn ? <Video size={24} /> : <VideoOff size={24} />}
                    </button>

                    {callActive ? (
                        <button
                            onClick={endCall}
                            className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
                            title="End Call"
                        >
                            <PhoneOff size={24} />
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            {/* Only show manual input if NOT in appointment mode */}
                            {!appointmentId && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Enter Peer ID"
                                        className="bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm w-48 outline-none focus:border-teal-500"
                                        value={remotePeerIdValue}
                                        onChange={e => setRemotePeerIdValue(e.target.value)}
                                    />
                                    <button
                                        onClick={() => startCall(remotePeerIdValue)}
                                        disabled={!remotePeerIdValue}
                                        className="p-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Start Call"
                                    >
                                        <Phone size={20} />
                                    </button>
                                </>
                            )}
                            {appointmentId && (
                                <div className="text-white text-sm bg-slate-700 px-4 py-2 rounded-lg animate-pulse">
                                    Auto-connecting...
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Exit Button */}
                <div className="w-48 flex justify-end">
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <LogOut size={16} />
                        Exit
                    </button>
                </div>
            </div>
        </div>
    )
}
