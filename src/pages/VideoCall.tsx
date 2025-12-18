import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import Peer from 'peerjs'
import { PhoneOff, Mic, MicOff, Video, VideoOff, Copy, User, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PrescriptionForm from '../components/PrescriptionForm'
import { X } from 'lucide-react'


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
            setIncomingCall(null)
        } else {
            if (incomingCall && !streamReady) console.log('Incoming call waiting for stream...')
        }
    }, [incomingCall, streamReady]) // Added streamReady dependency

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

    const checkExistingPeer = async () => {
        console.log('Checking for existing peer...')
        const { data, error } = await supabase.from('appointments').select('*').eq('id', appointmentId).single()
        if (error) console.error('Error checking existing peer:', error)
        if (data) {
            console.log('Initial appointment data loaded:', data)
            handleSignalingUpdate(data)
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
    /*
    -- REQUIRED SQL FOR REALTIME SIGNALING --
    -- Enable Realtime for table
    alter publication supabase_realtime add table appointments;
    
    -- Allow Authenticated participants to update their Peer IDs
    create policy "Participants update signaling" on appointments
    for update using (
      auth.uid() = patient_id or auth.uid() = doctor_id
    );
    */

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

    const isDoctor = user?.user_metadata?.role === 'doctor'

    const handleExit = () => {
        // Explicitly stop tracks before navigating
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop())
        }
        navigate(-1)
    }

    // copyToClipboard removed as it is no longer used in UI

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-black relative overflow-hidden">

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
            <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start pointer-events-none">
                {/* Status Badge */}
                <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${callActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-white text-xs font-medium tracking-wide">
                        {callActive ? 'Live Call' : 'Connecting...'}
                    </span>
                </div>

                {/* Doctor-Specific Actions & Exit */}
                <div className="flex flex-col gap-3 items-end pointer-events-auto">
                    <button
                        onClick={handleExit}
                        className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-md transition-transform active:scale-95 shadow-lg"
                        title="Exit Call"
                    >
                        <LogOut size={20} />
                    </button>

                    {isDoctor && (
                        <button
                            onClick={() => setShowPrescriptionModal(true)}
                            className="bg-blue-600/90 hover:bg-blue-700 text-white px-4 py-2 rounded-full backdrop-blur-md transition-all shadow-lg flex items-center gap-2 text-sm font-medium"
                        >
                            <Copy size={16} />
                            <span>Prescription</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Prescription Modal Overlay */}
            {showPrescriptionModal && (
                <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-0 md:p-8 animate-in fade-in duration-200">
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

            {/* Local Video - PiP (Floating) */}
            {/* ... rest of existing JSX ... */}
            <div className="absolute top-24 right-4 z-20 w-32 aspect-[3/4] md:w-48 md:aspect-video bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl">
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute bottom-1 left-1 text-[10px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded">
                    You
                </div>
            </div>

            {/* Bottom Controls - Floating Pill */}
            <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
                {/* ... existing controls ... */}
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
