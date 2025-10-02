import { useEffect, useRef, useState, useCallback } from "react";
import html2canvas from 'html2canvas';

type Props = {
  onPageTrack: (track: MediaStreamTrack | null) => void;
  isRecording: boolean;
};

export default function PageRecorder({ onPageTrack, isRecording }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Capture the entire page content
  const capturePage = useCallback(async () => {
    try {
      console.log('[PageRecorder] Starting page capture...');
      setError(null);

      // Create canvas for capturing
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvasRef.current = canvas;

      // Get canvas stream
      const stream = canvas.captureStream(30); // 30 FPS
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        onPageTrack(videoTrack);
        setIsCapturing(true);
        console.log('[PageRecorder] Page capture started successfully');

        // Start capturing page content
        startPageCapture();
      }
    } catch (err: any) {
      console.error('[PageRecorder] Failed to start page capture:', err);
      setError(err.message || 'Failed to start page capture');
    }
  }, [onPageTrack]);

  // Capture page content to canvas using html2canvas
  const startPageCapture = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const captureFrame = async () => {
      if (!isCapturing) return;

      try {
        // Find the main content area (the entire page)
        const mainContent = document.body;
        
        if (mainContent) {
          // Use html2canvas to capture the entire page
          const capturedCanvas = await html2canvas(mainContent, {
            width: window.innerWidth,
            height: window.innerHeight,
            scale: 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            onclone: (clonedDoc) => {
              // Ensure the cloned document has the same styles
              const clonedBody = clonedDoc.body;
              if (clonedBody) {
                clonedBody.style.margin = '0';
                clonedBody.style.padding = '0';
              }
            }
          });

          // Clear the main canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw the captured content to our main canvas
          ctx.drawImage(capturedCanvas, 0, 0, canvas.width, canvas.height);
          
          console.log('[PageRecorder] Frame captured successfully');
        }
      } catch (error) {
        console.error('[PageRecorder] Error capturing frame:', error);
        
        // Fallback: draw a simple background with error message
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.font = '16px Arial';
        ctx.fillText('Page Capture Error', 20, 30);
        ctx.fillText(`Time: ${new Date().toLocaleTimeString()}`, 20, 50);
      }

      // Continue capturing at 30 FPS
      setTimeout(() => {
        if (isCapturing) {
          requestAnimationFrame(captureFrame);
        }
      }, 1000 / 30);
    };

    captureFrame();
  }, [isCapturing]);

  // Stop page capture
  const stopPageCapture = useCallback(() => {
    console.log('[PageRecorder] Stopping page capture');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsCapturing(false);
    onPageTrack(null);
  }, [onPageTrack]);

  // Start/stop based on recording state
  useEffect(() => {
    if (isRecording && !isCapturing) {
      capturePage();
    } else if (!isRecording && isCapturing) {
      stopPageCapture();
    }
  }, [isRecording, isCapturing, capturePage, stopPageCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 max-w-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Page Recorder</h3>
      
      {error && (
        <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          Error: {error}
        </div>
      )}
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isCapturing ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm text-gray-600">
            {isCapturing ? 'Page capture active' : 'Page capture inactive'}
          </span>
        </div>
        
        {!isCapturing && (
          <div className="text-sm text-gray-600">
            <p className="text-xs text-gray-500">
              Page content will be captured automatically when recording starts
            </p>
            <button
              onClick={capturePage}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              Start Page Capture Now
            </button>
          </div>
        )}
        
        {isCapturing && (
          <div className="text-sm text-gray-600">
            <p>✅ Page content is being captured</p>
            <p className="text-xs text-gray-500 mt-1">
              Capturing entire page content including PDF and video
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
