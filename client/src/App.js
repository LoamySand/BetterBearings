import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import StreetFinderGame from './components/BackOfYourHand';
import AdminPanel from './components/AdminPanel';

function App() {
  const [showAdmin, setShowAdmin] = useState(false);

  return (
    <AuthProvider>
      <div>
        {/*
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 9999,
            padding: '0.5rem 1rem',
            background: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {showAdmin ? 'Game' : 'Admin'}
        </button>
    */}
        {showAdmin ? <AdminPanel /> : <StreetFinderGame />}
      </div>
    </AuthProvider>
  );
}

export default App;
