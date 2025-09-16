import { Link } from 'react-router-dom';
import CameraTest from './CameraTest';
import VideoDebug from './VideoDebug';
import AudioTest from './AudioTest';
import ConnectionDiagnostic from './ConnectionDiagnostic';
import { fetchTwilioToken } from '../lib/twilioToken';
import { useState, useEffect } from 'react';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getToken = async () => {
      try {
        setIsLoading(true);
        const token = await fetchTwilioToken("Debug", "debug-room");
        setToken(token);
      } catch (err) {
        console.error("Failed to get token:", err);
      } finally {
        setIsLoading(false);
      }
    };

    getToken();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Notary Video Call POC
          </h1>
          <p className="text-gray-600">
            Live PDF editing with video conferencing
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {/* Camera Test */}
          <div>
            <CameraTest />
          </div>
          
          {/* Video Debug */}
          <div>
            <VideoDebug />
          </div>
          
          {/* Audio Test */}
          <div>
            <AudioTest />
          </div>
        </div>

        {/* Connection Diagnostic */}
        <div className="mb-8">
          <ConnectionDiagnostic />
        </div>

        {/* Join Buttons */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
              Join Session
            </h2>
            
            <div className="space-y-4">
              <Link
                to="/notary"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 block text-center"
              >
                Join as Notary
              </Link>
              
              <Link
                to="/client"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 block text-center"
              >
                Join as Client
              </Link>
            </div>
            
            <div className="mt-6 text-sm text-gray-500">
              <p>Make sure to configure your Twilio credentials in the server/.env file</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}