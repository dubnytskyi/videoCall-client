import { useEffect, useRef, useState, useCallback } from "react";
import {
  connect,
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalDataTrack,
  RemoteParticipant,
} from "twilio-video";
import { CollabOp, Participant } from "../types/collab";

type Props = {
  token: string;
  identity: string;
  role: 'notary' | 'client';
  onLocalDataTrack: (track: LocalDataTrack) => void;
  onRemoteData: (data: CollabOp) => void;
  onParticipantUpdate: (participant: Participant) => void;
  canvasTrack?: any;
};

export default function VideoRoom({ 
  token, 
  identity, 
  role, 
  onLocalDataTrack, 
  onRemoteData, 
  onParticipantUpdate,
  canvasTrack
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  
  const [room, setRoom] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteParticipant, setRemoteParticipant] = useState<RemoteParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isVolumeControlVisible, setIsVolumeControlVisible] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const isConnectingRef = useRef(false);
  const connectedOnceRef = useRef(false);

  // Store callback functions in refs to avoid dependency issues
  const onLocalDataTrackRef = useRef(onLocalDataTrack);
  const onRemoteDataRef = useRef(onRemoteData);
  const onParticipantUpdateRef = useRef(onParticipantUpdate);
  const canvasTrackRef = useRef(canvasTrack);

  // Update refs when props change
  useEffect(() => {
    onLocalDataTrackRef.current = onLocalDataTrack;
    onRemoteDataRef.current = onRemoteData;
    onParticipantUpdateRef.current = onParticipantUpdate;
    canvasTrackRef.current = canvasTrack;
  });

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    if (!room) return;

    try {
      if (isMuted) {
        // Unmute - create and publish audio track
        const audioTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
        
        await room.localParticipant.publishTrack(audioTrack);
        
          if (localAudioRef.current) {
          localAudioRef.current.srcObject = new MediaStream([audioTrack.mediaStreamTrack]);
            localAudioRef.current.muted = true;
          localAudioRef.current.play().catch(() => {});
        }
        
        setIsMuted(false);
      } else {
        // Mute - unpublish audio tracks
        const audioTracks = Array.from(room.localParticipant.audioTracks.values());
        for (const publication of audioTracks) {
          await room.localParticipant.unpublishTrack((publication as any).track);
          (publication as any).track.stop();
        }
        
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = null;
      }
        
      setIsMuted(true);
      }
    } catch (error) {
      console.error('Toggle microphone failed:', error);
    }
  }, [room, isMuted]);

  // Change volume
  const changeVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = newVolume / 100;
    }
  }, []);

  // Toggle volume control
  const toggleVolumeControl = useCallback(() => {
    setIsVolumeControlVisible(!isVolumeControlVisible);
  }, [isVolumeControlVisible]);

  useEffect(() => {
    let mounted = true;
    console.log(`[${identity}] VideoRoom useEffect triggered with token:`, !!token);
    console.log(`[${identity}] VideoRoom useEffect dependencies:`, { token: !!token, identity });

    // Prevent multiple connections
    if (!token) {
      console.log(`[${identity}] No token, skipping connection`);
      return;
    }
    
    if (room) {
      console.log(`[${identity}] Already connected, skipping connection`);
      return;
    }

    if (isConnecting || isConnectingRef.current) {
      console.log(`[${identity}] Already connecting, skipping connection`);
      return;
    }

    const connectToRoom = async () => {
      try {
        console.log(`[${identity}] Connecting to room...`);
        setIsConnecting(true);
        isConnectingRef.current = true;

        // Create video track with fallback
        let videoTrack;
        try {
          videoTrack = await createLocalVideoTrack({
            width: 1280,
            height: 720,
            frameRate: 30,
          });
          console.log(`[${identity}] Video track created successfully`);
        } catch (videoError) {
          console.warn(`[${identity}] High quality video failed, trying medium quality:`, videoError);
          try {
            videoTrack = await createLocalVideoTrack({
              width: 640,
              height: 480,
              frameRate: 24,
            });
            console.log(`[${identity}] Medium quality video created successfully`);
          } catch (videoError2) {
            console.warn(`[${identity}] Medium quality video failed, trying low quality:`, videoError2);
            videoTrack = await createLocalVideoTrack({
            width: 320,
            height: 240,
              frameRate: 15,
            });
            console.log(`[${identity}] Low quality video created successfully`);
          }
        }

        // Create audio track with fallback
        let audioTrack;
        try {
          audioTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
          console.log(`[${identity}] Audio track created successfully`);
        } catch (audioError) {
          console.warn(`[${identity}] Audio track creation failed:`, audioError);
          // Continue without audio if it fails
        }

        // Create data track
        const dataTrack = new LocalDataTrack();
        console.log(`[${identity}] Created LocalDataTrack:`, dataTrack);

        // Prepare tracks array
        const tracks: any[] = [videoTrack, dataTrack];
        if (audioTrack) {
          tracks.push(audioTrack);
        }

        // Connect to room with available tracks
        console.log(`[${identity}] Connecting with ${tracks.length} tracks:`, tracks.map(t => t.kind));
        console.log(`[${identity}] About to call connect() with local tracks...`);
        const roomInstance: any = await connect(token, {
          name: "notary-room",
          tracks,
        });

        if (!mounted) {
          console.log(`[${identity}] Component unmounted, aborting connection setup`);
          return;
        }

        console.log(`[${identity}] Successfully connected to room:`, roomInstance);
        setRoom(roomInstance);
        setIsConnected(true);
        setIsConnecting(false);
        isConnectingRef.current = false;
        connectedOnceRef.current = true;
        
        console.log(`[${identity}] Successfully connected to room`);
        console.log(`[${identity}] Local participant identity: ${roomInstance.localParticipant.identity}`);

        // Display local video
        if (localVideoRef.current && videoTrack) {
          console.log(`[${identity}] Setting up local video display - videoTrack:`, videoTrack);
          localVideoRef.current.srcObject = new MediaStream([videoTrack.mediaStreamTrack]);
          localVideoRef.current.muted = true;
          localVideoRef.current.play().then(() => {
            console.log(`[${identity}] Local video playing successfully`);
          }).catch((err) => {
            console.error(`[${identity}] Failed to play local video:`, err);
          });
        } else {
          console.warn(`[${identity}] No video track available for local display - localVideoRef:`, !!localVideoRef.current, 'videoTrack:', !!videoTrack);
        }

        // Display local audio
        if (localAudioRef.current && audioTrack) {
          console.log(`[${identity}] Setting up local audio display`);
          localAudioRef.current.srcObject = new MediaStream([audioTrack.mediaStreamTrack]);
          localAudioRef.current.muted = true;
          localAudioRef.current.play().catch((err) => {
            console.error(`[${identity}] Failed to play local audio:`, err);
          });
        } else {
          console.warn(`[${identity}] No audio track available for local display`);
        }

        // Pass data track to parent
        console.log(`[${identity}] Passing data track to parent:`, dataTrack);
        onLocalDataTrackRef.current(dataTrack);

        // Handle remote participants
        const handleParticipantConnected = (participant: RemoteParticipant) => {
          console.log(`[${identity}] Participant connected: ${participant.identity}`, participant);
          setRemoteParticipant(participant);
          
          // Update participant info
          onParticipantUpdateRef.current({
            identity: participant.identity,
            role: participant.identity.startsWith('notary') ? 'notary' : 'client',
            isConnected: true,
            isReady: true
          });

          // Handle existing tracks
          participant.tracks.forEach((publication) => {
            if (publication.track) {
              console.log(`[${identity}] Processing existing track: ${publication.track.kind}`);
              handleTrackSubscribed(publication.track, participant);
            } else {
              console.log(`[${identity}] Track publication exists but track is null: ${publication.kind}`);
            }
          });

          // Handle new tracks
          participant.on('trackSubscribed', (track) => {
            handleTrackSubscribed(track, participant);
          });

          participant.on('trackUnsubscribed', (track) => {
            handleTrackUnsubscribed(track);
          });
        };

        const handleTrackSubscribed = (track: any, participant: RemoteParticipant) => {
          console.log(`[${identity}] Track subscribed: ${track.kind} from ${participant.identity}`);
          console.log(`[${identity}] Track details:`, {
            kind: track.kind,
            enabled: track.isEnabled,
            isSubscribed: track.isSubscribed,
            hasMediaStreamTrack: !!track.mediaStreamTrack
          });

          if (track.kind === 'video' && remoteVideoRef.current && track.mediaStreamTrack) {
            console.log(`[${identity}] Setting up remote video display - track:`, track);
            remoteVideoRef.current.srcObject = new MediaStream([track.mediaStreamTrack]);
            remoteVideoRef.current.play().then(() => {
              console.log(`[${identity}] Remote video playing successfully`);
            }).catch((err) => {
              console.error(`[${identity}] Failed to play remote video:`, err);
            });
          } else if (track.kind === 'video') {
            console.warn(`[${identity}] Video track exists but no mediaStreamTrack or remoteVideoRef - track:`, track, 'remoteVideoRef:', !!remoteVideoRef.current, 'mediaStreamTrack:', !!track.mediaStreamTrack);
          }

          if (track.kind === 'audio' && remoteAudioRef.current && track.mediaStreamTrack) {
            console.log(`[${identity}] Setting up remote audio display`);
            remoteAudioRef.current.srcObject = new MediaStream([track.mediaStreamTrack]);
            remoteAudioRef.current.volume = volume / 100;
            remoteAudioRef.current.play().catch((err) => {
              console.error(`[${identity}] Failed to play remote audio:`, err);
            });
          } else if (track.kind === 'audio') {
            console.warn(`[${identity}] Audio track exists but no mediaStreamTrack or remoteAudioRef`);
          }

          if (track.kind === 'data') {
            console.log(`[${identity}] Setting up DataTrack message handler - track:`, track);
            track.on('message', (message: string) => {
                  try {
                    console.log(`[${identity}] Received DataTrack message:`, message);
                    const data = JSON.parse(message);
                    console.log(`[${identity}] Parsed data:`, data);
                    onRemoteDataRef.current(data as CollabOp);
                  } catch (error) {
                    console.warn(`[${identity}] Bad JSON from DataTrack:`, error);
            }
          });
        }
        };

        const handleTrackUnsubscribed = (track: any) => {
          console.log(`[${identity}] Track unsubscribed: ${track.kind}`);

          if (track.kind === 'video' && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }

          if (track.kind === 'audio' && remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
          }
        };

        // Handle existing participants
        console.log(`[${identity}] Found ${roomInstance.participants.size} existing participants`);
        roomInstance.participants.forEach(handleParticipantConnected);

        // Handle new participants
        roomInstance.on('participantConnected', handleParticipantConnected);

        roomInstance.on('participantDisconnected', (participant: RemoteParticipant) => {
          console.log(`[${identity}] Participant disconnected: ${participant.identity}`);
          setRemoteParticipant(null);
          onParticipantUpdateRef.current({
            identity: participant.identity,
            role: participant.identity.startsWith('notary') ? 'notary' : 'client',
            isConnected: false,
            isReady: false
          });
        });

        roomInstance.on('disconnected', (reason: any) => {
          console.log(`[${identity}] Room disconnected: ${reason}`);
          setIsConnected(false);
          setRemoteParticipant(null);
          
          // Log disconnect reason for debugging
          if (reason === "Participant disconnected because of duplicate identity") {
            console.warn(`[${identity}] Disconnected due to duplicate identity`);
          } else if (reason === "Signaling connection disconnected") {
            console.warn(`[${identity}] Signaling connection lost`);
          } else if (reason === "Token expired") {
            console.warn(`[${identity}] Token expired`);
          } else {
            console.warn(`[${identity}] Disconnected for unknown reason: ${reason}`);
          }
        });

        // Publish canvas track if available
        if (canvasTrackRef.current) {
          await roomInstance.localParticipant.publishTrack(canvasTrackRef.current);
        }

      } catch (error: any) {
        console.error(`[${identity}] Failed to connect:`, error);
        console.error(`[${identity}] Error details:`, {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack
        });
        setIsConnecting(false);
        isConnectingRef.current = false;
        
        // Log specific error types for debugging
        if (error.name === 'NotAllowedError') {
          console.error(`[${identity}] Camera/microphone permission denied`);
        } else if (error.name === 'NotFoundError') {
          console.error(`[${identity}] Camera/microphone not found`);
        } else if (error.name === 'NotReadableError') {
          console.error(`[${identity}] Camera/microphone in use by another app`);
        } else if (error.message && error.message.includes('duplicate identity')) {
          console.error(`[${identity}] Duplicate identity error: ${error.message}`);
        } else if (error.message && error.message.includes('Signaling connection disconnected')) {
          console.error(`[${identity}] Signaling connection lost: ${error.message}`);
        } else {
          console.error(`[${identity}] Unknown connection error: ${error.message || error.name}`);
        }
      }
    };

    connectToRoom();

    return () => {
      console.log(`[${identity}] VideoRoom useEffect cleanup triggered`);
      // Skip the first dev cleanup triggered by React StrictMode (prevents dropping connection in dev)
      if ((import.meta as any)?.env?.DEV && !connectedOnceRef.current) {
        console.log(`[${identity}] Dev StrictMode cleanup detected, skipping disconnect`);
        return;
      }
      mounted = false;
      setIsConnecting(false);
      isConnectingRef.current = false;
      if (room) {
        console.log(`[${identity}] Cleaning up room connection`);
        (room as any).disconnect();
      }
      // Clear refs
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, [token]);

  return (
    <div className="flex flex-col gap-4">
      {/* Connection Status */}
      <div className={`border px-4 py-3 rounded ${
        isConnected ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold">
              Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <p className="text-sm mt-1">
              {isConnected ? 'Connection is active' : 'Connection lost'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Local Video */}
      <div className="relative">
        <video 
          ref={localVideoRef} 
          className="w-full h-64 rounded-lg shadow-lg bg-black object-cover" 
          playsInline 
          muted
          autoPlay
        />
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
          {identity} ({role})
        </div>
        <div className="absolute bottom-2 left-2 mt-6 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
          {isMuted ? '🔇 Muted' : '🎤 Active'}
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <div className="absolute top-2 left-2 bg-green-500 bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          Local Video
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <button
            onClick={toggleMicrophone}
            className={`p-2 rounded-full ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          <button
            onClick={toggleVolumeControl}
            className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
            title="Volume control"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Remote Video */}
      <div className="relative">
        <video 
          ref={remoteVideoRef} 
          className="w-full h-64 rounded-lg shadow-lg bg-black object-cover" 
          playsInline 
          autoPlay
        />
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
          {remoteParticipant?.identity || 'Waiting for participant...'}
        </div>
        <div className="absolute top-2 right-2">
          <div className={`w-3 h-3 rounded-full ${remoteParticipant ? 'bg-green-500' : 'bg-gray-500'}`} />
        </div>
        <div className="absolute top-2 left-2 bg-blue-500 bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          Remote Video
        </div>
      </div>

      {/* Volume Control */}
      {isVolumeControlVisible && (
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Volume Control</h3>
            <button
              onClick={toggleVolumeControl}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
            
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => changeVolume(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume}%, #e5e7eb ${volume}%, #e5e7eb 100%)`
              }}
            />
            
            <span className="text-sm font-medium text-gray-700 w-12 text-right">
              {volume}%
            </span>
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Connection Status and Actions */}
      <div className="bg-white rounded-lg shadow-lg p-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium text-gray-700">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <span className="text-xs text-gray-500">
              ({identity})
            </span>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
          >
            Reload Page
          </button>
        </div>
        
        {!isConnected && (
          <div className="mt-2 text-sm text-gray-600">
            <p>If you experience connection issues:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Reload the page</li>
              <li>Check your internet connection</li>
              <li>Allow camera and microphone access</li>
              <li>Ensure the camera is not used by another app</li>
            </ul>
          </div>
        )}
      </div>

      {/* Hidden Audio Elements */}
      <audio ref={localAudioRef} muted style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} style={{ display: 'none' }} />
    </div>
  );
}
