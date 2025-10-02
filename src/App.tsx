import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NotaryRoom from './components/NotaryRoom';
import ClientRoom from './components/ClientRoom';
import Home from './components/Home';
import TestPdfCollaboration from './components/TestPdfCollaboration';
import TestDragDrop from './components/TestDragDrop';

function App() {
  return (
    <Router>
      <div className="h-screen w-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/notary" element={<NotaryRoom />} />
          <Route path="/client" element={<ClientRoom />} />
          <Route path="/test-notary" element={
            <TestPdfCollaboration 
              roomId="test-room" 
              submitterUuid="notary-test-uuid" 
              submitterName="Notary" 
              isNotary={true} 
            />
          } />
          <Route path="/test-client" element={
            <TestPdfCollaboration 
              roomId="test-room" 
              submitterUuid="client-test-uuid" 
              submitterName="Client" 
              isNotary={false} 
            />
          } />
          <Route path="/test-drag" element={<TestDragDrop />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;


