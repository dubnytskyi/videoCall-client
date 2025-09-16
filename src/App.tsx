import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NotaryRoom from './components/NotaryRoom';
import ClientRoom from './components/ClientRoom';
import Home from './components/Home';

function App() {
  return (
    <Router>
      <div className="h-screen w-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/notary" element={<NotaryRoom />} />
          <Route path="/client" element={<ClientRoom />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;


