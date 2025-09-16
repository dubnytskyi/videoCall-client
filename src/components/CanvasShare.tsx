import { useRef, useEffect, useState, useCallback } from "react";
import { LocalVideoTrack } from "twilio-video";

type Props = {
  isNotary: boolean;
  onCanvasTrack: (track: any) => void;
  onStopSharing: () => void;
  pdfCanvas?: HTMLCanvasElement | null;
};

export default function CanvasShare({ isNotary, onCanvasTrack, onStopSharing, pdfCanvas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [track, setTrack] = useState<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Function to start canvas sharing
  const startCanvasShare = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      // Capture canvas as MediaStream
      const stream = canvasRef.current.captureStream(30); // 30 FPS
      streamRef.current = stream;

      // Create Twilio LocalVideoTrack from the captured MediaStream
      const canvasMediaTrack = stream.getVideoTracks()[0];
      const videoTrack = new LocalVideoTrack(canvasMediaTrack, { name: 'canvas-share' });

      setTrack(videoTrack);
      setIsSharing(true);
      onCanvasTrack(videoTrack);

      console.log('Canvas sharing started');
    } catch (error) {
      console.error('Error starting canvas share:', error);
    }
  }, [onCanvasTrack]);

  // Function to stop canvas sharing
  const stopCanvasShare = useCallback(() => {
    if (track) {
      track.stop();
      setTrack(null);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsSharing(false);
    onStopSharing();
    console.log('Canvas sharing stopped');
  }, [track, onStopSharing]);

  // Copy content from PDF canvas
  useEffect(() => {
    if (pdfCanvas && canvasRef.current) {
      const copyCanvas = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && pdfCanvas) {
          ctx.clearRect(0, 0, 800, 600);
          ctx.drawImage(pdfCanvas, 0, 0, 800, 600);
        }
      };
      
      // Copy immediately
      copyCanvas();
      
      // Set up interval to copy periodically
      const interval = setInterval(copyCanvas, 100); // 10 FPS
      
      return () => clearInterval(interval);
    }
  }, [pdfCanvas]);

  // Auto-start for notary
  useEffect(() => {
    if (isNotary && !isSharing) {
      startCanvasShare();
    }
  }, [isNotary, isSharing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (track) {
        track.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="w-full h-full bg-white border border-gray-300 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full object-contain"
        style={{ background: '#f8f9fa' }}
      />
      
      {/* Overlay controls */}
      <div className="absolute top-2 right-2 flex gap-2">
        {isNotary && (
          <>
            {!isSharing ? (
              <button
                onClick={startCanvasShare}
                className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded"
              >
                Start Sharing
              </button>
            ) : (
              <button
                onClick={stopCanvasShare}
                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded"
              >
                Stop Sharing
              </button>
            )}
          </>
        )}
        
        {isSharing && (
          <div className="px-2 py-1 bg-red-500 text-white text-xs rounded flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            Sharing
          </div>
        )}
      </div>
    </div>
  );
}
