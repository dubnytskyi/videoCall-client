import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import VideoRoom from "./VideoRoom";
import PdfCollaborator from "./PdfCollaborator";
import { fetchTwilioToken } from "../lib/twilioToken";
import { CollabOp, Participant } from "../types/collab";
import { LocalDataTrack } from "twilio-video";

export default function NotaryRoom() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [localDataTrack, setLocalDataTrack] = useState<LocalDataTrack | null>(null);
  const [participantInfo, setParticipantInfo] = useState({
    notary: { identity: "Notary", isConnected: true, isReady: true },
    client: { identity: "Waiting...", isConnected: false, isReady: false }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Stable identity that doesn't change on re-renders
  const identityRef = useRef<string | null>(null);
  
  // Initialize identity only once
  useEffect(() => {
    if (!identityRef.current) {
      identityRef.current = `notary-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[NotaryRoom] Created identity: ${identityRef.current}`);
    }
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

  const handleLocalDataTrack = useCallback((track: LocalDataTrack) => {
    console.log(`[NotaryRoom] Received LocalDataTrack:`, track);
    console.log(`[NotaryRoom] Setting localDataTrack state to:`, !!track);
    setLocalDataTrack(track);
  }, []);

  const handleRemoteData = useCallback((data: CollabOp) => {
    // Notary receives data from client (if any)
    console.log("Notary received data from client:", data);
  }, []);

  const handleParticipantUpdate = useCallback((participant: Participant) => {
    setParticipantInfo(prev => ({
      ...prev,
      [participant.role]: participant
    }));
  }, []);

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
          onLocalDataTrack={handleLocalDataTrack}
          onRemoteData={handleRemoteData}
          onParticipantUpdate={handleParticipantUpdate}
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
          </div>
        </div>
      </div>

      {/* Right Panel - PDF Document */}
      <div className="flex-1 p-4">
        {localDataTrack ? (
          <PdfCollaborator
            localDataTrack={localDataTrack}
            onRemoteData={handleRemoteData}
            isNotary={true}
            participantInfo={participantInfo}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-white rounded-lg shadow">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Initializing document editor...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
