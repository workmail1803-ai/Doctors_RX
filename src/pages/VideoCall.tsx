import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import Peer from 'peerjs'
import { PhoneOff, Mic, MicOff, Video, VideoOff, Copy, User, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PrescriptionForm from '../components/PrescriptionForm'
import InCallHistory from '../components/InCallHistory'
import { X, FileText } from 'lucide-react'


export default function VideoCall() {
    const navigate = useNavigate()
    const { appointmentId } = useParams()
    const { user } = useAuth()

    const [peerId, setPeerId] = useState<string>('')
    // Manual peer ID state removed
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

    const [streamReady, setStreamReady] = useState(false)
    const [queuedRemoteId, setQueuedRemoteId] = useState<string | null>(null)
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
    const [showHistoryModal, setShowHistoryModal] = useState(false)

    useEffect(() => {
        const peer = new Peer()
        peerInstance.current = peer

        // 1. Setup Peer
        peer.on('open', (id) => {
            console.log('Peer Opened with ID:', id)
            setPeerId(id)
            setStatusText('Waiting for other party...')
            if (appointmentId && user) {
                updateSignalingId(id)
            }
        })

        peer.on('call', (call) => {
            console.log('Incoming Call received')
            setIncomingCall(call)
        })

        // 2. Get Media
        console.log('Requesting User Media...')
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                console.log('User Media retrieved successfully')
                localStreamRef.current = stream
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream
                }
                setStreamReady(true)
            })
            .catch((err) => {
                console.error('Failed to get local stream', err)
                setStatusText('Error accessing camera')
            })

        // 3. Signaling Subscription
        let channel: any;
        if (appointmentId) {
            console.log('Subscribing to appointment channel:', appointmentId)
            channel = supabase.channel(`room-${appointmentId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `id=eq.${appointmentId}` },
                    (payload) => {
                        console.log('Realtime Update Received:', payload.new)
                        handleSignalingUpdate(payload.new)
                    }
                )
                .subscribe((status) => {
                    console.log('Subscription Status:', status)
                    if (status === 'SUBSCRIBED') {
                        checkExistingPeer()
                    }
                })
        }

        return () => {
            peer.destroy()
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop())
            }
            if (channel) supabase.removeChannel(channel)
        }
    }, [appointmentId, user])

    // Auto-Answer Effect
    useEffect(() => {
        if (incomingCall && streamReady && localStreamRef.current && !callActive) {
            console.log('Auto-answering call now that stream is ready...')
            const stream = localStreamRef.current
            incomingCall.answer(stream)
            currentCall.current = incomingCall

            incomingCall.on('stream', (remoteStream: MediaStream) => {
                console.log('Remote stream received')
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream
                }
                setCallActive(true)
                setStatusText('Connected')
            })

            // IMPORTANT: Handle remote close events
            incomingCall.on('close', () => {
                console.log('Call closed by remote')
                handleCallClose()
            })

            incomingCall.on('error', (err: any) => {
                console.error('Incoming call error:', err)
                handleCallClose()
            })

            setIncomingCall(null)
        }
    }, [incomingCall, streamReady])

    // Process Queued Call using new State
    useEffect(() => {
        if (streamReady && queuedRemoteId) {
            console.log('Stream ready! Processing queued call to:', queuedRemoteId)
            startCall(queuedRemoteId)
            setQueuedRemoteId(null)
        }
    }, [streamReady, queuedRemoteId])

    const updateSignalingId = async (id: string) => {
        if (!user || !appointmentId) return

        console.log('Updating Signaling ID in DB...')
        const { data, error: fetchError } = await supabase.from('appointments').select('*').eq('id', appointmentId).single()

        if (fetchError) console.error('Error fetching appt for signaling:', fetchError)

        if (data) {
            const updates: any = {}
            if (user.id === data.doctor_id) updates.doctor_peer_id = id
            else if (user.id === data.patient_id) updates.patient_peer_id = id

            console.log('Updating DB with:', updates)
            if (Object.keys(updates).length > 0) {
                const { error } = await supabase.from('appointments').update(updates).eq('id', appointmentId)
                if (error) console.error('Error updating peer ID:', error)
                else console.log('Peer ID updated successfully')
            }
        }
    }

    const [remoteName, setRemoteName] = useState<string>('')

    const checkExistingPeer = async () => {
        console.log('Checking for existing peer...')
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                *,
                patient:patient_id(full_name),
                doctor:doctor_id(full_name)
            `)
            .eq('id', appointmentId)
            .single()

        if (error) console.error('Error checking existing peer:', error)
        if (data) {
            console.log('Initial appointment data loaded:', data)

            if (data.scheduled_at) {
                const now = new Date().getTime()
                const start = new Date(data.scheduled_at).getTime()
                const slotDuration = 30 * 60 * 1000
                const end = start + slotDuration
                const earlyBuffer = 10 * 60 * 1000

                if (now > end) {
                    alert('This appointment slot has expired (30 min limit).')
                    navigate(-1)
                    return
                }

                if (now < (start - earlyBuffer)) {
                    alert('It is too early to join this call. Please wait for your scheduled time.')
                    navigate(-1)
                    return
                }
            }

            handleSignalingUpdate(data)

            if (user?.id === data.doctor_id) {
                const name = data.patient_name || data.patient?.full_name || 'Patient'
                setRemoteName(name)
            } else {
                const name = data.doctor?.full_name || 'Doctor'
                setRemoteName(name)
            }
        }
    }

    const handleSignalingUpdate = (data: any) => {
        if (!user || !peerInstance.current) return

        const isDoctor = user.id === data.doctor_id
        console.log('Handle Signaling: I am', isDoctor ? 'Doctor' : 'Patient')

        const targetPeerId = isDoctor ? data.patient_peer_id : data.doctor_peer_id
        console.log('Target Peer ID:', targetPeerId)

        if (targetPeerId && !currentCall.current && !incomingCall) {
            console.log('Conditions met to initiate call.')
            if (isDoctor) {
                if (streamReady) {
                    console.log('Stream ready, initiating call to', targetPeerId)
                    startCall(targetPeerId)
                } else {
                    console.log('Stream NOT ready, queuing call to', targetPeerId)
                    setQueuedRemoteId(targetPeerId)
                }
            } else {
                console.log('I am patient, waiting for doctor to call me.')
                setStatusText('Waiting for doctor to connect...')
            }
        }
    }

    const handleCallClose = () => {
        setCallActive(false)
        currentCall.current = null
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
        setStatusText('Call Ended - Waiting...')
    }

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

        call.on('close', () => {
            console.log('Call closed by remote')
            handleCallClose()
        })

        call.on('error', (err) => {
            console.error('Call error:', err)
            setStatusText('Call Failed')
            handleCallClose()
        })
    }

    const endCall = async () => {
        // Close call locally
        currentCall.current?.close()
        setCallActive(false)
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null
        }

        // Update appointment status based on who ends the call
        if (appointmentId && user) {
            try {
                const { data } = await supabase
                    .from('appointments')
                    .select('doctor_id')
                    .eq('id', appointmentId)
                    .single()

                const isDoctor = user.id === data?.doctor_id

                if (isDoctor) {
                    // Doctor ending call → mark as completed (dismisses slot)
                    console.log('Doctor ending call, marking appointment as completed')
                    await supabase
                        .from('appointments')
                        .update({ status: 'completed' })
                        .eq('id', appointmentId)
                } else {
                    // Patient ending call → keep status 'confirmed' (allows rejoin)
                    console.log('Patient ending call, keeping appointment active for rejoin')
                }
            } catch (error) {
                console.error('Error updating appointment status:', error)
            }
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

    const isDoctor = user?.user_metadata?.role === 'doctor'

    const handleExit = () => {
        // Explicitly stop tracks before navigating
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop())
        }
        navigate(-1)
    }

    // UI States
    const [controlsVisible, setControlsVisible] = useState(true)
    // Initial position: Bottom right (calc based on window)
    const [pipPosition, setPipPosition] = useState({ x: window.innerWidth - 140, y: window.innerHeight - 200 })
    const dragStartRef = useRef<{ x: number, y: number } | null>(null)

    const handlePipDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        e.stopPropagation()
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
        dragStartRef.current = {
            x: clientX - pipPosition.x,
            y: clientY - pipPosition.y
        }
    }

    const handlePipDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!dragStartRef.current) return
        e.stopPropagation()
        e.preventDefault()

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

        const newX = clientX - dragStartRef.current.x
        const newY = clientY - dragStartRef.current.y

        // Bounds (Simple clamping)
        // Assuming PIP width ~128px (w-32) or 192px (w-48) and height varies
        // We permit some edge hang, but not total disappearance
        const maxX = window.innerWidth - 50
        const maxY = window.innerHeight - 50

        setPipPosition({
            x: Math.min(Math.max(0, newX), maxX),
            y: Math.min(Math.max(0, newY), maxY)
        })
    }

    const handlePipDragEnd = () => {
        dragStartRef.current = null
    }

    // Toggle controls on screen tap (but ignore if tapping active elements)
    const handleScreenTap = () => {
        // Simple toggle
        setControlsVisible(prev => !prev)
    }

    return (
        <div
            className="fixed inset-0 w-full h-[100dvh] bg-black z-[100] overflow-hidden touch-none"
            onClick={handleScreenTap}
        >

            {/* Main Remote Video - Full Screen Coverage */}
            <div className="absolute inset-0 z-0">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    className="w-full h-full object-cover"
                />

                {/* Status Overlay (When not active) */}
                {!callActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <User size={40} className="text-slate-400" />
                        </div>
                        <p className="text-xl md:text-2xl font-semibold text-white mb-2 text-center">{statusText}</p>
                        <p className="text-slate-400 text-sm">{peerId ? 'Ready to connect' : 'Initializing...'}</p>
                    </div>
                )}
            </div>

            {/* Top Bar - Floating */}
            <div
                className={`absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start pointer-events-none transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
                style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
            >
                {/* Status Badge */}
                <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${callActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-white text-xs font-medium tracking-wide">
                        {callActive ? 'Live Call' : 'Connecting...'}
                    </span>
                </div>

                {/* Remote Name Display */}
                <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2">
                    <User size={16} className="text-white/80" />
                    <span className="text-white text-sm font-semibold tracking-wide shadow-sm">
                        {remoteName || 'Connecting...'}
                    </span>
                </div>

                {/* Doctor-Specific Actions & Exit */}
                <div className="flex flex-col gap-3 items-end pointer-events-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleExit() }}
                        className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-md transition-transform active:scale-95 shadow-lg"
                        title="Exit Call"
                    >
                        <LogOut size={20} />
                    </button>

                    {isDoctor && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowHistoryModal(true) }}
                                className="bg-white/90 hover:bg-white text-slate-800 px-4 py-2 rounded-full backdrop-blur-md transition-all shadow-lg flex items-center gap-2 text-sm font-medium"
                            >
                                <FileText size={16} />
                                <span>History</span>
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); setShowPrescriptionModal(true) }}
                                className="bg-blue-600/90 hover:bg-blue-700 text-white px-4 py-2 rounded-full backdrop-blur-md transition-all shadow-lg flex items-center gap-2 text-sm font-medium"
                            >
                                <Copy size={16} />
                                <span>Prescription</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Prescription Modal Overlay */}
            {showPrescriptionModal && (
                <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-0 md:p-8 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="w-full h-full md:max-w-4xl md:h-auto md:max-h-[90vh] bg-white rounded-none md:rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">

                        {/* Mobile Close Button (Top Right) */}
                        <button
                            onClick={() => setShowPrescriptionModal(false)}
                            className="absolute top-2 right-2 z-50 bg-slate-100 p-2 rounded-full md:hidden text-slate-500"
                        >
                            <X size={20} />
                        </button>

                        <PrescriptionForm
                            isModal={true}
                            onCancel={() => setShowPrescriptionModal(false)}
                            onSave={() => {
                                setShowPrescriptionModal(false)
                                // Optional: Send message to chat/signaling that Rx is ready
                            }}
                        />
                    </div>
                </div>
            )}

            {/* History Modal Overlay */}
            {showHistoryModal && (
                <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-0 md:p-8 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="w-full h-full md:max-w-md md:h-auto md:max-h-[80vh] bg-white rounded-none md:rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
                        <InCallHistory
                            onClose={() => setShowHistoryModal(false)}
                        // We aren't passing patientId here yet because we need to fetch it from the appointment data
                        // Ideally, VideoCall state should store `currentAppointment` data to pass `patient_id`
                        />
                    </div>
                </div>
            )}

            {/* Local Video - PiP (Draggable) */}
            <div
                className="absolute z-30 w-32 aspect-[3/4] md:w-48 md:aspect-video bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl cursor-move touch-none"
                style={{
                    left: pipPosition.x,
                    top: pipPosition.y,
                    transition: dragStartRef.current ? 'none' : 'all 0.2s ease-out'
                }}
                onMouseDown={handlePipDragStart}
                onTouchStart={handlePipDragStart}
                onMouseMove={handlePipDragMove}
                onTouchMove={handlePipDragMove}
                onMouseUp={handlePipDragEnd}
                onTouchEnd={handlePipDragEnd}
                onMouseLeave={handlePipDragEnd}
                onClick={(e) => e.stopPropagation()} // Prevent toggling controls when interacting with PIP
            >
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    className="w-full h-full object-cover mirror pointer-events-none" // pointer-events-none ensures drag works on container
                    style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute bottom-1 left-1 text-[10px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded pointer-events-none">
                    You
                </div>
            </div>

            {/* Bottom Controls - Floating Pill */}
            <div
                className={`absolute bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none transition-all duration-300 ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="pointer-events-auto flex items-center gap-4 md:gap-6 bg-slate-900/80 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-full shadow-2xl">

                    <button
                        onClick={toggleMic}
                        className={`p-3 md:p-4 rounded-full transition-all duration-200 ${micOn
                            ? 'bg-slate-700 hover:bg-slate-600 text-white'
                            : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'}`}
                    >
                        {micOn ? <Mic size={24} /> : <MicOff size={24} />}
                    </button>

                    <button
                        onClick={toggleCamera}
                        className={`p-3 md:p-4 rounded-full transition-all duration-200 ${cameraOn
                            ? 'bg-slate-700 hover:bg-slate-600 text-white'
                            : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'}`}
                    >
                        {cameraOn ? <Video size={24} /> : <VideoOff size={24} />}
                    </button>

                    {callActive && (
                        <button
                            onClick={endCall}
                            className="p-3 md:p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/40 transition-transform hover:scale-105 active:scale-95"
                        >
                            <PhoneOff size={24} />
                        </button>
                    )}

                    {/* Manual Call Input removed for clean mobile UI */}
                </div>
            </div>
        </div>
    )
}
