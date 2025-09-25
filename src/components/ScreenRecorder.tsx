import { useEffect, useRef, useState, useCallback } from "react";
import html2canvas from "html2canvas";
import { LocalVideoTrack } from "twilio-video";

type Props = {
  // Refs to elements we want to capture
  leftVideoRef: React.RefObject<HTMLVideoElement>;
  rightVideoRef: React.RefObject<HTMLVideoElement>;
  pdfCanvasRef: React.RefObject<HTMLCanvasElement>;
  
  // Callback to provide the screen track
  onScreenTrack: (track: MediaStreamTrack | null) => void;
  
  // Recording state
  isRecording: boolean;
};

export default function ScreenRecorder({
  leftVideoRef,
  rightVideoRef,
  pdfCanvasRef,
  onScreenTrack,
  isRecording
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Capture and render function
  const captureAndRender = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Set canvas size to match recording resolution
      canvas.width = 1280;
      canvas.height = 720;

      // Clear canvas with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Left half: Capture video elements
      const leftVideo = leftVideoRef.current;
      const rightVideo = rightVideoRef.current;
      
      if (leftVideo && leftVideo.videoWidth > 0 && leftVideo.videoHeight > 0) {
        // Draw left video (notary)
        const leftWidth = canvas.width / 2;
        const leftHeight = canvas.height / 2;
        const leftX = 0;
        const leftY = 0;
        
        ctx.drawImage(leftVideo, leftX, leftY, leftWidth, leftHeight);
        
        // Add label
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(leftX, leftY, leftWidth, 30);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText('Notary', leftX + 10, leftY + 20);
      }

      if (rightVideo && rightVideo.videoWidth > 0 && rightVideo.videoHeight > 0) {
        // Draw right video (client) below notary
        const rightWidth = canvas.width / 2;
        const rightHeight = canvas.height / 2;
        const rightX = 0;
        const rightY = canvas.height / 2;
        
        ctx.drawImage(rightVideo, rightX, rightY, rightWidth, rightHeight);
        
        // Add label
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(rightX, rightY, rightWidth, 30);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText('Client', rightX + 10, rightY + 20);
      }

      // Right half: Capture PDF canvas
      const pdfCanvas = pdfCanvasRef.current;
      if (pdfCanvas && pdfCanvas.width > 0 && pdfCanvas.height > 0) {
        const pdfWidth = canvas.width / 2;
        const pdfHeight = canvas.height;
        const pdfX = canvas.width / 2;
        const pdfY = 0;
        
        // Draw PDF canvas scaled to fit right half
        ctx.drawImage(pdfCanvas, pdfX, pdfY, pdfWidth, pdfHeight);
        
        // Add label
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(pdfX, pdfY, pdfWidth, 30);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText('PDF Document', pdfX + 10, pdfY + 20);
      }

      // Add recording indicator
      if (isRecording) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(canvas.width - 30, 30, 10, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText('REC', canvas.width - 45, 35);
      }

    } catch (error) {
      console.error('Error capturing screen:', error);
    }
  }, [leftVideoRef, rightVideoRef, pdfCanvasRef, isRecording]);

  // Start/stop screen capture
  useEffect(() => {
    if (isRecording && !isCapturing) {
      console.log('[ScreenRecorder] Starting screen capture');
      setIsCapturing(true);
      
      // Start capture loop
      const captureLoop = () => {
        captureAndRender();
        animationFrameRef.current = requestAnimationFrame(captureLoop);
      };
      
      captureLoop();
      
      // Create stream from canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const stream = canvas.captureStream(30); // 30 FPS
        streamRef.current = stream;
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          trackRef.current = videoTrack;
          onScreenTrack(videoTrack);
          console.log('[ScreenRecorder] Screen track created:', videoTrack.id);
        }
      }
    } else if (!isRecording && isCapturing) {
      console.log('[ScreenRecorder] Stopping screen capture');
      setIsCapturing(false);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (trackRef.current) {
        trackRef.current.stop();
        trackRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      onScreenTrack(null);
    }
  }, [isRecording, isCapturing, captureAndRender, onScreenTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (trackRef.current) {
        trackRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="hidden">
      {/* Hidden canvas for screen capture */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
    </div>
  );
}
