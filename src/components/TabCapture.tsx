import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  // regionTrack: cropped to DocuSeal area for live share
  // fullTrack: full tab for recording
  onTracks: (regionTrack: MediaStreamTrack | null, fullTrack: MediaStreamTrack | null) => void;
  isRecording: boolean;
  // CSS selector of DocuSeal container to crop to
  cropSelector?: string;
  // Expose imperative start for user-gesture capture
  onReady?: (api: { start: () => Promise<void>; stop: () => void }) => void;
};

export default function TabCapture({ onTracks, isRecording, cropSelector, onReady }: Props) {
  const tabStreamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopTabCapture = useCallback(() => {
    console.log('[TabCapture] Stopping tab capture');
    if (tabStreamRef.current) {
      tabStreamRef.current.getTracks().forEach(track => track.stop());
      tabStreamRef.current = null;
    }
    setIsCapturing(false);
    onTracks(null, null);
  }, [onTracks]);

  // Start tab capture and produce two tracks: region + full
  const startTabCapture = useCallback(async () => {
    try {
      console.log('[TabCapture] Requesting tab capture...');
      setError(null);

      // Hint picker by changing tab title temporarily
      const prevTitle = document.title;
      const hintTitle = '🔴 SHARE THIS TAB – Notary Session';
      try { document.title = hintTitle; } catch {}

      // Ensure this tab is active/focused just before calling picker
      try { window.focus(); } catch {}
      await new Promise((r) => setTimeout(r, 60));

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser' as any,
          // Hint Chrome to offer the CURRENT tab
          preferCurrentTab: true as any,
          selfBrowserSurface: 'include' as any,
          surfaceSwitching: 'exclude' as any,
          logicalSurface: true as any,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } as any,
        audio: true,
      } as any);

      console.log('[TabCapture] Tab capture started:', stream);
      // Restore title after picker
      try { document.title = prevTitle; } catch {}
      const baseTrack = stream.getVideoTracks()[0];
      if (!baseTrack) throw new Error('No video track from getDisplayMedia');

      tabStreamRef.current = stream;

      // Create two clones
      const regionTrack = baseTrack.clone();
      const fullTrack = baseTrack.clone();

      // Apply Region Capture to regionTrack if available
      try {
        const CropTarget = (window as any).CropTarget;
        if (CropTarget && cropSelector) {
          const el = document.querySelector(cropSelector) as HTMLElement | null;
          if (el) {
            const target = await CropTarget.fromElement(el);
            await (regionTrack as any).cropTo(target);
            console.log('[TabCapture] Applied cropTo to regionTrack');
          } else {
            console.warn('[TabCapture] cropSelector element not found, sending full region');
          }
        } else {
          console.warn('[TabCapture] Region Capture not supported or no selector provided');
        }
      } catch (e) {
        console.warn('[TabCapture] cropTo failed, using full region instead', e);
      }

      onTracks(regionTrack, fullTrack);
      setIsCapturing(true);

      // Handle user stop
      baseTrack.addEventListener('ended', () => {
        console.log('[TabCapture] Base track ended by user');
        stopTabCapture();
      });
    } catch (err: any) {
      console.error('[TabCapture] Failed to start tab capture:', err);
      setError(err.message || 'Failed to start tab capture');
    }
  }, [onTracks, cropSelector, stopTabCapture]);

  // Expose imperative API when mounted
  useEffect(() => {
    onReady && onReady({ start: startTabCapture, stop: stopTabCapture });
  }, [onReady, startTabCapture, stopTabCapture]);

  // Start/stop based on recording state
  useEffect(() => {
    console.log('[TabCapture] Recording state changed:', { isRecording, isCapturing });
    if (isRecording && !isCapturing) {
      console.log('[TabCapture] Auto-starting screen capture due to recording');
      startTabCapture();
    } else if (!isRecording && isCapturing) {
      console.log('[TabCapture] Auto-stopping screen capture due to recording end');
      stopTabCapture();
    }
  }, [isRecording, isCapturing, startTabCapture, stopTabCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tabStreamRef.current) {
        tabStreamRef.current.getTracks().forEach(track => track.stop());
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
            {isCapturing ? 'Screen capture active' : 'Screen capture inactive'}
          </span>
        </div>
        {!isCapturing && (
          <div className="text-sm text-gray-600">
            <p className="text-xs text-gray-500">Starts when you press Start Recording</p>
            <p className="text-xs text-gray-500 mt-1">Browser will ask what to share</p>
          </div>
        )}
        {isCapturing && (
          <div className="text-sm text-gray-600">
            <p>✅ Capturing current tab</p>
            <p className="text-xs text-gray-500 mt-1">Region cropped to DocuSeal if supported</p>
          </div>
        )}
      </div>
    </div>
  );
}
