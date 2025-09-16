import { useState, useRef, useEffect } from 'react';
import { createLocalAudioTrack } from 'twilio-video';

export default function AudioTest() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioTrackRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      setError('Ваш браузер не підтримує доступ до мікрофона');
      return;
    }

    return () => {
      // Cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
      }
    };
  }, []);

  const startAudioTest = async () => {
    try {
      setError(null);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        }
      });

      // Create Twilio audio track
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
      });

      audioTrackRef.current = audioTrack;

      // Set up audio element
      if (audioRef.current) {
        audioRef.current.srcObject = new MediaStream([audioTrack.mediaStreamTrack]);
        audioRef.current.muted = true; // Prevent feedback
        await audioRef.current.play();
      }

      // Set up audio level monitoring
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      microphone.connect(analyser);
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const checkAudioLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);
          animationRef.current = requestAnimationFrame(checkAudioLevel);
        }
      };
      
      checkAudioLevel();
      setIsRecording(true);
      
    } catch (err: any) {
      console.error('Audio test failed:', err);
      if (err.name === 'NotAllowedError') {
        setError('Дозвіл на використання мікрофона не надано');
      } else if (err.name === 'NotFoundError') {
        setError('Мікрофон не знайдено');
      } else if (err.name === 'NotReadableError') {
        setError('Мікрофон використовується іншою програмою');
      } else {
        setError(`Помилка: ${err.message || 'Невідома помилка'}`);
      }
    }
  };

  const stopAudioTest = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    setIsRecording(false);
  };

  if (!isSupported) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <h3 className="font-semibold mb-2">Аудіо не підтримується</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Тест мікрофона</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={isRecording ? stopAudioTest : startAudioTest}
            className={`px-4 py-2 rounded font-medium ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isRecording ? 'Зупинити тест' : 'Почати тест'}
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Рівень звуку:</span>
            <div className="w-32 h-4 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-100"
                style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
              />
            </div>
            <span className="text-sm text-gray-600">{Math.round(audioLevel)}</span>
          </div>
        </div>

        {isRecording && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span>Мікрофон активний - говорите для тестування</span>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p><strong>Інструкції:</strong></p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Натисніть "Почати тест" для перевірки мікрофона</li>
            <li>Дозвольте доступ до мікрофона, якщо браузер запитає</li>
            <li>Говоріть у мікрофон - рівень звуку повинен змінюватися</li>
            <li>Якщо рівень звуку залишається на 0, перевірте налаштування мікрофона</li>
          </ul>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
