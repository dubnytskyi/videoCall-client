import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import VideoRoom from "./VideoRoom";
import PdfCollaborator from "./PdfCollaborator";
import { fetchTwilioToken } from "../lib/twilioToken";
import { CollabOp, Participant } from "../types/collab";
import { LocalDataTrack } from "twilio-video";

export default function ClientRoom() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [localDataTrack, setLocalDataTrack] = useState<LocalDataTrack | null>(null);
  const [participantInfo, setParticipantInfo] = useState({
    notary: { identity: "Waiting...", isConnected: false, isReady: false },
    client: { identity: "Client", isConnected: true, isReady: true }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remoteData, setRemoteData] = useState<CollabOp | null>(null);
  
  // Stable identity that doesn't change on re-renders
  const identityRef = useRef<string | null>(null);
  
  // Initialize identity only once
  if (!identityRef.current) {
    identityRef.current = `client-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[ClientRoom] Created identity: ${identityRef.current}`);
  }

  useEffect(() => {
    const getToken = async () => {
      try {
        setIsLoading(true);
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
    console.log(`[ClientRoom] Received LocalDataTrack:`, track);
    setLocalDataTrack(track);
  }, []);

  const handleRemoteData = useCallback((data: CollabOp) => {
    // Client receives data from notary
    console.log("Client received data from notary:", data);
    setRemoteData(data);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
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
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
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
            className="mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
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
          <h1 className="text-xl font-bold text-gray-800">Client Session</h1>
          <p className="text-sm text-gray-600">You are the client. You can view the document.</p>
        </div>
        
        <VideoRoom
          token={token}
          identity={identityRef.current || `client-${Math.random().toString(36).substr(2, 9)}`}
          role="client"
          onLocalDataTrack={handleLocalDataTrack}
          onRemoteData={handleRemoteData}
          onParticipantUpdate={handleParticipantUpdate}
        />
        
        <div className="mt-4 p-3 bg-white rounded-lg shadow">
          <h3 className="font-semibold text-gray-800 mb-2">Session Info</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Notary:</span>
              <span className={participantInfo.notary.isConnected ? "text-green-600" : "text-red-600"}>
                {participantInfo.notary.isConnected ? "Connected" : "Waiting..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Client:</span>
              <span className="text-green-600 font-medium">Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Document View */}
      <div className="flex-1 p-4">
        {localDataTrack ? (
          <PdfCollaborator
            localDataTrack={localDataTrack}
            onRemoteData={handleRemoteData}
            isNotary={false}
            participantInfo={participantInfo}
            remoteData={remoteData}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-white rounded-lg shadow">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Initializing document viewer...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
