import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import StreetSets from './pages/StreetSets';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/street-sets" element={<StreetSets />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
