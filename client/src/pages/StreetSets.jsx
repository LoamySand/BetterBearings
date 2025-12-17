import { useAuth } from '../contexts/AuthContext';
import './StreetSets.css';

export default function StreetSets() {
  const { user } = useAuth();

  return (
    <div className="street-sets-page">
      <div className="street-sets-container">
        <h1>Street Sets</h1>
        <p>Manage your custom street collections here.</p>
        <p className="coming-soon">Coming soon...</p>
      </div>
    </div>
  );
}
