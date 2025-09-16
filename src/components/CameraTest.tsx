import { useState, useRef, useEffect } from 'react';
import { createLocalVideoTrack } from 'twilio-video';

export default function CameraTest() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<any>(null);

  const startCamera = async () => {
    try {
      setError(null);
      
      // Request camera permission first
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Create Twilio video track
      const videoTrack = await createLocalVideoTrack({
        width: 640,
        height: 480,
        frameRate: 24,
      });
      
      trackRef.current = videoTrack;
      
      // Display video
      if (videoRef.current) {
        videoRef.current.srcObject = new MediaStream([videoTrack.mediaStreamTrack]);
        videoRef.current.play();
      }
      
      setIsActive(true);
      
    } catch (err: any) {
      console.error('Camera test failed:', err);
      if (err.name === 'NotAllowedError') {
        setError('Дозвіл на використання камери не надано');
      } else if (err.name === 'NotFoundError') {
        setError('Камера не знайдена');
      } else if (err.name === 'NotReadableError') {
        setError('Камера використовується іншою програмою');
      } else {
        setError(`Помилка: ${err.message || 'Невідома помилка'}`);
      }
    }
  };

  const stopCamera = () => {
    if (trackRef.current) {
      trackRef.current.stop();
      trackRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  useEffect(() => {
    return () => {
      if (trackRef.current) {
        trackRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Тест камери</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={isActive ? stopCamera : startCamera}
            className={`px-4 py-2 rounded font-medium ${
              isActive 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isActive ? 'Зупинити тест' : 'Почати тест'}
          </button>
        </div>

        {isActive && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span>Камера активна</span>
            </div>
          </div>
        )}

        <div className="relative">
          <video 
            ref={videoRef}
            className="w-full h-48 rounded-lg shadow-lg bg-black object-cover"
            playsInline
            muted
          />
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-2">📹</div>
                <p>Камера не активна</p>
              </div>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-600">
          <p><strong>Інструкції:</strong></p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Натисніть "Почати тест" для перевірки камери</li>
            <li>Дозвольте доступ до камери, якщо браузер запитає</li>
            <li>Якщо камера працює, ви побачите своє відео</li>
            <li>Якщо відео чорне або не відображається, перевірте налаштування камери</li>
          </ul>
        </div>
      </div>
    </div>
  );
}