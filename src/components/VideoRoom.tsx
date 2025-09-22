import { useEffect, useRef, useState, useCallback } from "react";
import {
  connect,
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalVideoTrack,
  LocalDataTrack,
  RemoteParticipant,
} from "twilio-video";
import { CollabOp, Participant } from "../types/collab";
import { getServerUrl } from "../config";
import { recordingService, RecordingStatus } from "../lib/recordingService";

type Props = {
  token: string;
  identity: string;
  role: 'notary' | 'client';
  onLocalDataTrack: (track: LocalDataTrack) => void;
  onRemoteData: (data: CollabOp) => void;
  onParticipantUpdate: (participant: Participant) => void;
  canvasTrack?: any;
  onRecordingStatusChange?: (status: RecordingStatus | null) => void;
};

export default function VideoRoom({ 
  token, 
  identity, 
  role, 
  onLocalDataTrack, 
  onRemoteData, 
  onParticipantUpdate,
  canvasTrack,
  onRecordingStatusChange
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
  const publishedCanvasTrackSidRef = useRef<string | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

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

  // Simple freeze monitor for HTMLVideoElement
  const startFreezeMonitor = useCallback((videoEl: HTMLVideoElement, reattach: () => void) => {
    let lastTime = videoEl.currentTime;
    let lastCheck = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const time = videoEl.currentTime;
      const elapsed = now - lastCheck;
      // If >3s elapsed and currentTime did not advance while not paused, consider frozen
      if (!videoEl.paused && !videoEl.ended && elapsed > 3000 && Math.abs(time - lastTime) < 0.05) {
        console.warn('[VideoRoom] Detected frozen remote video element. Reattaching track...');
        try { reattach(); } catch {}
      }
      lastTime = time;
      lastCheck = now;
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  // Toggle volume control
  const toggleVolumeControl = useCallback(() => {
    setIsVolumeControlVisible(!isVolumeControlVisible);
  }, [isVolumeControlVisible]);

  // Recording functions
  const setRecordingRules = useCallback(async (roomSid: string, rules: any[]) => {
    try {
      await fetch(`${getServerUrl()}/api/room/${roomSid}/recording-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules })
      });
    } catch (e) {
      console.warn('[VideoRoom] Failed to update recording rules', e);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!room || isRecording) return;

    try {
      setRecordingError(null);
      console.log(`[${identity}] Starting recording for room:`, room.sid);
      
      // CRITICAL: Wait for canvas track to be available before starting recording
      if (!canvasTrackRef.current) {
        console.warn(`[${identity}] No canvas track available! Waiting for canvas...`);
        // Wait up to 10 seconds for canvas to be available
        for (let i = 0; i < 100; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (canvasTrackRef.current) {
            console.log(`[${identity}] Canvas track became available after ${i * 100}ms`);
            break;
          }
        }
      }
      
      // If still no canvas track, wait a bit more
      if (!canvasTrackRef.current) {
        console.warn(`[${identity}] Still no canvas track after initial wait. Waiting 2 more seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // CRITICAL: Ensure canvas track is published BEFORE starting composition
      if (canvasTrackRef.current && !publishedCanvasTrackSidRef.current) {
        try {
          console.log(`[${identity}] Publishing canvas track before startRecording...`);
          console.log(`[${identity}] Canvas track details:`, {
            id: canvasTrackRef.current.id,
            kind: canvasTrackRef.current.kind,
            enabled: canvasTrackRef.current.enabled,
            readyState: canvasTrackRef.current.readyState
          });
          
          const localCanvas = new LocalVideoTrack(canvasTrackRef.current, { name: 'pdf-canvas' } as any);
          const pub: any = await room.localParticipant.publishTrack(localCanvas, { name: 'pdf-canvas', priority: 'high' } as any);
          publishedCanvasTrackSidRef.current = pub?.trackSid || null;
          console.log(`[${identity}] Canvas track published (pre-record):`, publishedCanvasTrackSidRef.current);
          
          // Wait a moment for the track to be fully registered
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Log all published tracks to verify canvas is included
          console.log(`[${identity}] All published tracks after canvas publish:`, Array.from(room.localParticipant.tracks.values()).map((t: any) => ({
            kind: t.kind,
            name: t.trackName,
            sid: t.trackSid
          })));
        } catch (e) {
          console.error(`[${identity}] Failed to publish canvas before recording:`, e);
          console.error(`[${identity}] Error details:`, {
            name: (e as any)?.name,
            message: (e as any)?.message,
            stack: (e as any)?.stack
          });
        }
      } else if (!canvasTrackRef.current) {
        console.error(`[${identity}] Still no canvas track available after waiting! Recording without PDF.`);
      } else {
        console.log(`[${identity}] Canvas track already published:`, publishedCanvasTrackSidRef.current);
      }

      const status = await recordingService.startRecording(room.sid);
      setRecordingStatus(status);
      setIsRecording(true);
      
      if (onRecordingStatusChange) {
        onRecordingStatusChange(status);
      }
      
      console.log(`[${identity}] Recording started successfully:`, status);
    } catch (error) {
      console.error(`[${identity}] Failed to start recording:`, error);
      setRecordingError(error instanceof Error ? error.message : 'Failed to start recording');
    }
  }, [room, isRecording, identity, onRecordingStatusChange]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !recordingStatus) return;

    try {
      setRecordingError(null);
      console.log(`[${identity}] Stopping recording:`, recordingStatus.recordingSid);
      
      const status = await recordingService.stopRecording();
      setRecordingStatus(status || null);
      setIsRecording(false);
      
      if (onRecordingStatusChange) {
        onRecordingStatusChange(status);
      }
      
      console.log(`[${identity}] Recording stopped successfully:`, status);
    } catch (error) {
      console.error(`[${identity}] Failed to stop recording:`, error);
      setRecordingError(error instanceof Error ? error.message : 'Failed to stop recording');
    }
  }, [isRecording, recordingStatus, identity, onRecordingStatusChange]);

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

        // Create video track with conservative defaults for stability (can upscale later)
        let videoTrack;
        try {
          videoTrack = await createLocalVideoTrack({
            width: 640,
            height: 360,
            frameRate: 24,
            name: 'camera',
          } as any);
          console.log(`[${identity}] Video track created successfully (640x360@24)`);
        } catch (videoError) {
          console.warn(`[${identity}] 640x360@24 failed, trying 320x240@15:`, videoError);
          videoTrack = await createLocalVideoTrack({
            width: 320,
            height: 240,
            frameRate: 15,
            name: 'camera',
          } as any);
          console.log(`[${identity}] Video track created successfully (320x240@15)`);
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
        // Choose codec per browser: Chrome → VP8 (simulcast on), Safari → H264
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const preferredCodecs = isSafari
          ? [{ codec: 'H264', simulcast: false }]
          : [
              { codec: 'VP8', simulcast: true },
              { codec: 'H264', simulcast: false }
            ];

        const roomInstance: any = await connect(token, {
          name: "notary-room",
          tracks,
          // Improve stability and quality
          bandwidthProfile: {
            video: {
              mode: 'collaboration',
              trackSwitchOffMode: 'predicted',
              contentPreferencesMode: 'auto',
              maxSubscriptionBitrate: 1200000,
            }
          } as any,
          preferredVideoCodecs: preferredCodecs as any,
          maxAudioBitrate: 32000,
          dscpTagging: true,
          networkQuality: { local: 3, remote: 3 },
          dominantSpeaker: true,
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

        // If notary joins, disconnect all other participants in the room via server
        if (role === 'notary') {
          try {
            await fetch(`${getServerUrl()}/api/room/${roomInstance.sid}/kick-others`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keepIdentity: roomInstance.localParticipant.identity })
            });
          } catch (e) {
            console.warn('[VideoRoom] Failed to kick others:', e);
          }
        }

        // Ensure recording is disabled until user presses Start
        try {
          await setRecordingRules(roomInstance.sid, [{ type: 'exclude', all: true }]);
          console.log(`[${identity}] Applied recording rules: exclude all`);
        } catch {}

        // Display local video using Twilio attach API
        if (localVideoRef.current && videoTrack) {
          console.log(`[${identity}] Setting up local video display - videoTrack:`, videoTrack);
          try {
            (videoTrack as any).attach(localVideoRef.current);
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(() => {});
          } catch (err) {
            console.error(`[${identity}] Failed to attach local video:`, err);
          }
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

          // React to Twilio adaptive track switching to avoid black frames
          participant.on('trackSwitchedOff', (track: any) => {
            console.warn(`[${identity}] Track switched OFF due to bandwidth:`, track?.kind);
            if (track?.kind === 'video' && typeof track.setContentPreferences === 'function') {
              try { track.setContentPreferences({ renderDimensions: { width: 320, height: 180 }, frameRate: 15 }); } catch {}
            }
          });
          participant.on('trackSwitchedOn', (track: any) => {
            console.log(`[${identity}] Track switched ON:`, track?.kind);
            if (track?.kind === 'video' && typeof track.setContentPreferences === 'function') {
              try { track.setContentPreferences({ renderDimensions: { width: 640, height: 360 }, frameRate: 24 }); } catch {}
            }
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

          // Do not render the PDF canvas track in the main remote video element
          const trackName = (track as any)?.name || (track as any)?.trackName;
          if (track.kind === 'video' && (trackName === 'pdf-canvas')) {
            console.log(`[${identity}] Skipping attach for pdf-canvas track in main remote video`);
            return;
          }

          if (track.kind === 'video' && remoteVideoRef.current) {
            console.log(`[${identity}] Setting up remote video display - track:`, track);
            const attach = () => {
              try {
                (track as any).attach(remoteVideoRef.current!);
                remoteVideoRef.current!.playsInline = true;
              } catch {}
            };
            attach();
            remoteVideoRef.current.play().catch(() => {});

            // Prefer higher priority for the main remote video
            if (typeof track.setPriority === 'function') {
              try { track.setPriority('high'); } catch {}
            }
            // Request reasonable render dimensions/frame rate to improve stability
            if (typeof track.setContentPreferences === 'function') {
              try { track.setContentPreferences({ renderDimensions: { width: 640, height: 360 }, frameRate: 24 }); } catch {}
            }

            // Start freeze monitor - if frozen, detach/reattach track
            const cleanupFreeze = startFreezeMonitor(remoteVideoRef.current, () => {
              if (!remoteVideoRef.current) return;
              try { (track as any).detach(remoteVideoRef.current!); } catch {}
              attach();
              remoteVideoRef.current.play().catch(() => {});
            });
            // Clean up monitor when track unsubscribes
            track.once && track.once('unsubscribed', () => {
              cleanupFreeze();
              if (remoteVideoRef.current) {
                try { (track as any).detach(remoteVideoRef.current); } catch {}
                remoteVideoRef.current.srcObject = null;
              }
            });
          } else if (track.kind === 'video') {
            console.warn(`[${identity}] Video track exists but remoteVideoRef is missing - track:`, track, 'remoteVideoRef:', !!remoteVideoRef.current);
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

        // Handle reconnect events for visibility
        roomInstance.on('reconnecting', (error: any) => {
          console.warn(`[${identity}] Reconnecting due to:`, error?.message || error);
        });
        roomInstance.on('reconnected', () => {
          console.log(`[${identity}] Reconnected to room`);
        });

        // Adapt local track based on network quality
        roomInstance.on('networkQualityLevelChanged', (level: any, stats: any) => {
          console.log(`[${identity}] Local network quality:`, level, stats);
          try {
            if (videoTrack && typeof (videoTrack as any).restart === 'function') {
              if (level <= 1) {
                // Very poor - minimize
                (videoTrack as any).restart({ width: 320, height: 240, frameRate: 15 });
              } else if (level === 2) {
                (videoTrack as any).restart({ width: 640, height: 360, frameRate: 20 });
              } else if (level >= 3) {
                (videoTrack as any).restart({ width: 640, height: 360, frameRate: 24 });
              }
            }
          } catch (e) {
            console.warn(`[${identity}] Failed to adapt local video track:`, e);
          }
        });

        // Optional: observe track switch events (bandwidth adaptation)
        roomInstance.on('participantConnected', (p: any) => {
          p.on('trackSwitchedOff', (track: any) => {
            console.warn(`[${identity}] Track switched OFF due to bandwidth:`, track?.kind);
          });
          p.on('trackSwitchedOn', (track: any) => {
            console.log(`[${identity}] Track switched ON:`, track?.kind);
          });
        });

        // Publish canvas track if available
        if (canvasTrackRef.current) {
          try {
            console.log(`[${identity}] Publishing canvas track (as LocalVideoTrack):`, canvasTrackRef.current.id, canvasTrackRef.current.kind);
            console.log(`[${identity}] Canvas track details:`, {
              enabled: canvasTrackRef.current.enabled,
              readyState: canvasTrackRef.current.readyState,
              settings: canvasTrackRef.current.getSettings()
            });
            const localCanvas = new LocalVideoTrack(canvasTrackRef.current, { name: 'pdf-canvas' } as any);
            const pub: any = await roomInstance.localParticipant.publishTrack(localCanvas, { name: 'pdf-canvas', priority: 'high' } as any);
            publishedCanvasTrackSidRef.current = pub?.trackSid || null;
            console.log(`[${identity}] Canvas track published successfully`, publishedCanvasTrackSidRef.current);
            
            // Log all published tracks
            console.log(`[${identity}] All published tracks:`, Array.from(roomInstance.localParticipant.tracks.values()).map((t: any) => ({
              kind: t.kind,
              name: t.trackName,
              sid: t.trackSid
            })));
          } catch (e) {
            console.warn(`[${identity}] Failed to publish canvas track at connect`, e);
          }
        } else {
          console.log(`[${identity}] No canvas track to publish`);
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

  // If canvas track appears after connecting, publish it
  useEffect(() => {
    const publishIfNeeded = async () => {
      if (!room || !isConnected) return;
      if (!canvasTrackRef.current) return;
      if (publishedCanvasTrackSidRef.current) return; // already published
      try {
        console.log(`[${identity}] Publishing canvas track post-connect (as LocalVideoTrack)`);
        const localCanvas = new LocalVideoTrack(canvasTrackRef.current, { name: 'pdf-canvas' } as any);
        const pub: any = await room.localParticipant.publishTrack(localCanvas, { name: 'pdf-canvas', priority: 'high' } as any);
        publishedCanvasTrackSidRef.current = pub?.trackSid || null;
        console.log(`[${identity}] Canvas track published post-connect`, publishedCanvasTrackSidRef.current);
      } catch (e) {
        console.warn(`[${identity}] Failed to publish canvas track post-connect`, e);
      }
    };
    publishIfNeeded();
  }, [canvasTrack, room, isConnected, identity]);

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

          {/* Recording Controls - Only show for notary */}
          {role === 'notary' && (
            <>
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={!isConnected}
                  className="p-2 rounded-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white"
                  title={!isConnected ? 'Connect first' : 'Start recording (PDF will be published first)'}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white animate-pulse"
                  title="Stop recording"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </>
          )}
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

      {/* Recording Status */}
      {(isRecording || recordingStatus || recordingError) && (
        <div className="bg-white rounded-lg shadow-lg p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Recording Status</h3>
            {recordingStatus && (
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                recordingStatus.status === 'in-progress' ? 'bg-red-100 text-red-800' :
                recordingStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
                recordingStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
                recordingStatus.status === 'enqueued' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {recordingStatus.status}
              </div>
            )}
          </div>
          
          {recordingError && (
            <div className="mb-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
              Error: {recordingError}
            </div>
          )}
          
          {recordingStatus && (
            <div className="space-y-1 text-sm text-gray-600">
              <div>Recording ID: {recordingStatus.recordingSid}</div>
              {recordingStatus.duration && (
                <div>Duration: {Math.floor(recordingStatus.duration / 60)}:{(recordingStatus.duration % 60).toString().padStart(2, '0')}</div>
              )}
              {recordingStatus.size && (
                <div>Size: {(recordingStatus.size / 1024 / 1024).toFixed(2)} MB</div>
              )}
              {(recordingStatus.status === 'completed') && (
                <div className="mt-2">
                  <a 
                    href={`${getServerUrl()}/api/recording/${recordingStatus.recordingSid}/media`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Download Recording
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hidden Audio Elements */}
      <audio ref={localAudioRef} muted style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} style={{ display: 'none' }} />
    </div>
  );
}
