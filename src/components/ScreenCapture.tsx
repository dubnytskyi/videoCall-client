import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  // Callback to provide the screen track
  onScreenTrack: (track: MediaStreamTrack | null) => void;
  
  // Recording state
  isRecording: boolean;
};

export default function ScreenCapture({
  onScreenTrack,
  isRecording
}: Props) {
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start screen capture
  const startScreenCapture = useCallback(async () => {
    try {
      console.log('[ScreenCapture] Requesting screen capture...');
      setError(null);
      
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false // We'll use separate audio from microphone
      });

      console.log('[ScreenCapture] Screen capture started:', stream);
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        screenTrackRef.current = videoTrack;
        onScreenTrack(videoTrack);
        setIsCapturing(true);
        
        // Handle track end (user stops sharing)
        videoTrack.addEventListener('ended', () => {
          console.log('[ScreenCapture] Screen capture ended by user');
          stopScreenCapture();
        });
      }
    } catch (err: any) {
      console.error('[ScreenCapture] Failed to start screen capture:', err);
      setError(err.message || 'Failed to start screen capture');
    }
  }, [onScreenTrack]);

  // Stop screen capture
  const stopScreenCapture = useCallback(() => {
    console.log('[ScreenCapture] Stopping screen capture');
    
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    
    setIsCapturing(false);
    onScreenTrack(null);
  }, [onScreenTrack]);

  // Start/stop based on recording state
  useEffect(() => {
    console.log('[ScreenCapture] Recording state changed:', { isRecording, isCapturing });
    if (isRecording && !isCapturing) {
      console.log('[ScreenCapture] Auto-starting screen capture due to recording');
      startScreenCapture();
    } else if (!isRecording && isCapturing) {
      console.log('[ScreenCapture] Auto-stopping screen capture due to recording end');
      stopScreenCapture();
    }
  }, [isRecording, isCapturing, startScreenCapture, stopScreenCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 max-w-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Screen Capture</h3>
      
      {error && (
        <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          Error: {error}
        </div>
      )}
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isCapturing ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm text-gray-600">
            {isCapturing ? 'Screen sharing active' : 'Screen sharing inactive'}
          </span>
        </div>
        
        {!isCapturing && (
          <button
            onClick={startScreenCapture}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Start Screen Sharing
          </button>
        )}
        
        {isCapturing && (
          <div className="text-sm text-gray-600">
            <p>✅ Screen is being shared</p>
            <p className="text-xs text-gray-500 mt-1">
              To stop sharing, click the "Stop sharing" button in your browser's notification bar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
