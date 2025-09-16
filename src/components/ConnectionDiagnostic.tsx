import { useState, useEffect } from 'react';
import { fetchTwilioToken } from '../lib/twilioToken';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function ConnectionDiagnostic() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (test: string, status: 'success' | 'error' | 'warning', message: string, details?: any) => {
    setResults(prev => [...prev, { test, status, message, details }]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    // Test 1: Basic connectivity
    addResult('Internet Connection', 'success', 'Checking internet connectivity...');
    try {
      const response = await fetch('https://www.google.com', { mode: 'no-cors' });
      addResult('Internet Connection', 'success', 'Internet connection is working');
    } catch (error) {
      addResult('Internet Connection', 'error', 'No internet connection detected');
    }

    // Test 2: Twilio API endpoint
    addResult('Twilio API', 'success', 'Testing Twilio API endpoint...');
    try {
      const response = await fetch('https://video-call-azure-two.vercel.app/api/health');
      const data = await response.json();
      addResult('Twilio API', 'success', 'Twilio API endpoint is accessible', data);
    } catch (error: any) {
      addResult('Twilio API', 'error', `Twilio API endpoint failed: ${error.message}`);
    }

    // Test 3: Token generation
    addResult('Token Generation', 'success', 'Testing token generation...');
    try {
      const token = await fetchTwilioToken('diagnostic-test', 'diagnostic-room');
      if (token && token.length > 0) {
        addResult('Token Generation', 'success', 'Token generated successfully');
      } else {
        addResult('Token Generation', 'error', 'Token generation returned empty result');
      }
    } catch (error: any) {
      addResult('Token Generation', 'error', `Token generation failed: ${error.message}`);
    }

    // Test 4: WebRTC support
    addResult('WebRTC Support', 'success', 'Checking WebRTC support...');
    if (typeof RTCPeerConnection !== 'undefined') {
      addResult('WebRTC Support', 'success', 'WebRTC is supported in this browser');
    } else {
      addResult('WebRTC Support', 'error', 'WebRTC is not supported in this browser');
    }

    // Test 5: Media devices access
    addResult('Media Devices', 'success', 'Checking media device access...');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        addResult('Media Devices', 'success', 'Media devices API is available');
      } else {
        addResult('Media Devices', 'error', 'Media devices API is not available');
      }
    } catch (error: any) {
      addResult('Media Devices', 'error', `Media devices check failed: ${error.message}`);
    }

    // Test 6: Twilio Video SDK
    addResult('Twilio SDK', 'success', 'Checking Twilio Video SDK...');
    try {
      // @ts-ignore
      if (typeof Twilio !== 'undefined' && Twilio.Video) {
        addResult('Twilio SDK', 'success', 'Twilio Video SDK is loaded');
      } else {
        addResult('Twilio SDK', 'warning', 'Twilio Video SDK may not be loaded properly');
      }
    } catch (error: any) {
      addResult('Twilio SDK', 'error', `Twilio SDK check failed: ${error.message}`);
    }

    // Test 7: Network connectivity to Twilio servers
    addResult('Twilio Servers', 'success', 'Testing connectivity to Twilio servers...');
    try {
      const startTime = Date.now();
      const response = await fetch('https://global.vss.twilio.com/signaling', { 
        method: 'HEAD',
        mode: 'no-cors'
      });
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      if (latency < 5000) {
        addResult('Twilio Servers', 'success', `Connected to Twilio servers (${latency}ms latency)`);
      } else {
        addResult('Twilio Servers', 'warning', `Slow connection to Twilio servers (${latency}ms latency)`);
      }
    } catch (error: any) {
      addResult('Twilio Servers', 'error', `Cannot reach Twilio servers: ${error.message}`);
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Діагностика з'єднання</h3>
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className={`px-4 py-2 rounded font-medium ${
            isRunning 
              ? 'bg-gray-400 text-white cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isRunning ? 'Виконується...' : 'Запустити діагностику'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
              <span className="text-lg">{getStatusIcon(result.status)}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{result.test}</span>
                  <span className={`text-sm ${getStatusColor(result.status)}`}>
                    {result.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">Деталі</summary>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !isRunning && (
        <div className="text-center text-gray-500 py-8">
          <p>Натисніть "Запустити діагностику" для перевірки з'єднання</p>
        </div>
      )}

      {isRunning && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Виконується діагностика...</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">Рекомендації:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Переконайтеся, що у вас стабільне інтернет-з'єднання</li>
          <li>• Перевірте налаштування файрволу та проксі</li>
          <li>• Переконайтеся, що Twilio credentials налаштовані правильно</li>
          <li>• Спробуйте використовувати інший браузер або мережу</li>
        </ul>
      </div>
    </div>
  );
}
