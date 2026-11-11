import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import StreetSets from './pages/StreetSets';
import StreetSetDetail from './pages/StreetSetDetail';
import NotFound from './pages/NotFound';

// Dev builds only: /__crash throws during render, to check the error boundary (KAN-63).
// import.meta.env.DEV is false in production builds, so the route isn't there.
function Crash() {
  throw new Error('Test crash from /__crash');
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/street-sets" element={<StreetSets />} />
            <Route path="/street-sets/:id" element={<StreetSetDetail />} />
            {import.meta.env.DEV && <Route path="/__crash" element={<Crash />} />}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
