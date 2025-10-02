import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import VideoRoom from "./VideoRoom";
import PdfFieldCollaborator from "./PdfFieldCollaborator";
import TabCapture from "./TabCapture";
import { YjsProvider } from "../contexts/YjsContext";
import { fetchTwilioToken } from "../lib/twilioToken";
import { Participant } from "../types/collab";
import { RecordingStatus } from "../lib/recordingService";
import { getServerUrl } from "../config";

export default function NotaryRoom() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [participantInfo, setParticipantInfo] = useState({
    notary: { identity: "Notary", isConnected: true, isReady: true },
    client: { identity: "Waiting...", isConnected: false, isReady: false }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isFinalizingRecording, setIsFinalizingRecording] = useState(false);
  
  // Tab capture tracks
  const regionTrackRef = useRef<MediaStreamTrack | null>(null);
  const fullTrackRef = useRef<MediaStreamTrack | null>(null);
  const tabApiRef = useRef<{ start: () => Promise<void>; stop: () => void } | null>(null);

  // Stable identity that doesn't change on re-renders
  const identityRef = useRef<string | null>(null);
  const location = useLocation();
  const yjsRoomId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('room') || 'test-room';
  }, [location.search]);
  
  // Initialize identity and room ID only once
  useEffect(() => {
    if (!identityRef.current) {
      identityRef.current = `notary-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[NotaryRoom] Created identity: ${identityRef.current}`);
    }
    console.log(`[NotaryRoom] Using Yjs room ID: ${yjsRoomId}`);
  }, []);

  useEffect(() => {
    const getToken = async () => {
      if (!identityRef.current) {
        console.error("Identity not initialized yet");
        return;
      }
      
      try {
        setIsLoading(true);
        console.log(`[NotaryRoom] Getting token for identity: ${identityRef.current}`);
        const token = await fetchTwilioToken(identityRef.current, "notary-room");
        setToken(token);
      } catch (err) {
        console.error("Failed to get token:", err);
        setError("Failed to connect to video service. Please check your Twilio configuration.");
      } finally {
        setIsLoading(false);
      }
    };

    getToken();
  }, []);

  const handleParticipantUpdate = useCallback((participant: Participant) => {
    setParticipantInfo(prev => ({
      ...prev,
      [participant.role]: participant
    }));
  }, []);

  const handleRecordingStatusChange = useCallback((status: RecordingStatus | null) => {
    console.log(`[NotaryRoom] Recording status change:`, status);
    console.log(`[NotaryRoom] Recording status:`, status?.status);
    setRecordingStatus(status);
    setIsRecording(status?.status === 'enqueued' || status?.status === 'in-progress');
  }, []);

  const handleTabTracks = useCallback((regionTrack: MediaStreamTrack | null, fullTrack: MediaStreamTrack | null) => {
    console.log(`[NotaryRoom] Tab tracks change:`, { region: !!regionTrack, full: !!fullTrack });
    regionTrackRef.current = regionTrack;
    fullTrackRef.current = fullTrack;
  }, []);

  const endCall = useCallback(async () => {
    if (!recordingStatus?.roomSid) return;
    
    setIsEndingCall(true);
    try {
      // End the room to finalize the composition
      const response = await fetch(`${getServerUrl()}/api/room/${recordingStatus.roomSid}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        console.log('Room ended successfully');
        // Start polling for recording completion
        setIsFinalizingRecording(true);
        try {
          const sid = recordingStatus.recordingSid;
          const maxAttempts = 60; // ~3 minutes at 3s interval
          const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
          for (let i = 0; i < maxAttempts; i++) {
            const res = await fetch(`${getServerUrl()}/api/recording/${sid}`);
            if (res.ok) {
              const data = await res.json();
              setRecordingStatus(data);
              if (data.status === 'completed') {
                break;
              }
            }
            await delay(3000);
          }
        } finally {
          setIsFinalizingRecording(false);
        }
      } else {
        console.error('Failed to end room');
      }
    } catch (error) {
      console.error('Error ending room:', error);
    } finally {
      setIsEndingCall(false);
    }
  }, [recordingStatus?.roomSid, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to video service...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-gray-600">No token available</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Left Panel - Video Feeds */}
      <div className="w-1/3 p-4 flex flex-col">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800">Notary Session</h1>
          <p className="text-sm text-gray-600">You are the notary. You can edit the document.</p>
        </div>
        
        <VideoRoom
          token={token}
          identity={identityRef.current || `notary-${Math.random().toString(36).substr(2, 9)}`}
          role="notary"
          onLocalDataTrack={() => {}}
          onRemoteData={() => {}}
          onParticipantUpdate={handleParticipantUpdate}
          onRecordingStatusChange={handleRecordingStatusChange}
          canvasTrack={regionTrackRef.current}
          screenFullTrack={fullTrackRef.current as any}
          onCaptureToggle={async (active) => {
            setIsRecording(active);
            if (active && tabApiRef.current) {
              // Start capture synchronously on user gesture
              try { await tabApiRef.current.start(); } catch {}
            }
          }}
        />
        
        <div className="mt-4 p-3 bg-white rounded-lg shadow">
          <h3 className="font-semibold text-gray-800 mb-2">Session Info</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Notary:</span>
              <span className="text-green-600 font-medium">Connected</span>
            </div>
            <div className="flex justify-between">
              <span>Client:</span>
              <span className={participantInfo.client.isConnected ? "text-green-600" : "text-red-600"}>
                {participantInfo.client.isConnected ? "Connected" : "Waiting..."}
              </span>
            </div>
            {recordingStatus && (
              <div className="flex justify-between">
                <span>Recording:</span>
                <span className={`font-medium ${
                  recordingStatus.status === 'in-progress' ? 'text-red-600' :
                  recordingStatus.status === 'completed' ? 'text-green-600' :
                  'text-gray-600'
                }`}>
                  {recordingStatus.status}
                </span>
              </div>
            )}
          </div>
          
          {/* Recording Status Info */}
          {recordingStatus && (
            <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
              {recordingStatus.status === 'enqueued' && (
                <div>
                  <p className="font-medium text-orange-600">Recording queued for processing</p>
                  <p>End the call to finalize the recording and get download link.</p>
                </div>
              )}
              {recordingStatus.status === 'completed' && (
                <div>
                  <p className="font-medium text-green-600">Recording ready!</p>
                  <p>Click "Download Recording" to save the video file.</p>
                </div>
              )}
            </div>
          )}
          
          {/* End Call + Finalization */}
          <div className="mt-3 space-y-2">
            <button
              onClick={endCall}
              disabled={isEndingCall || isFinalizingRecording}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
            >
              {isEndingCall ? 'Ending Call...' : 'End Call'}
            </button>
            {isFinalizingRecording && (
              <div className="text-xs text-gray-600">Finalizing recording… waiting for Twilio to complete.</div>
            )}
            {recordingStatus?.status === 'completed' && (
              <a
                href={`${getServerUrl()}/api/recording/${recordingStatus.recordingSid}/media`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full text-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
              >
                Download Recording
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - PDF Document */}
      <div className="flex-1 p-4">
        {yjsRoomId ? (
          <YjsProvider roomId={yjsRoomId} submitterUuid={identityRef.current || ''}>
            <PdfFieldCollaborator
              isNotary={true}
              participantInfo={participantInfo}
              submitterUuid={identityRef.current || ''}
              submitterName="Notary"
              submitters={[
                { name: "Notary", uuid: identityRef.current || '' },
                { name: "Client", uuid: participantInfo.client.identity }
              ]}
            />
          </YjsProvider>
        ) : (
          <div className="h-full flex items-center justify-center bg-white rounded-lg shadow">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Initializing document editor...</p>
            </div>
          </div>
        )}
      </div>

      {/* Tab Capture - produces region (DocuSeal area) + full (entire tab) */}
      <TabCapture
        onTracks={handleTabTracks}
        isRecording={isRecording}
        cropSelector="#docuseal-root"
        onReady={(api) => { tabApiRef.current = api; }}
      />
    </div>
  );
}
