import { useState } from 'react';
import { X, Save } from 'lucide-react';
import './SaveStreetSetModal.css';

export default function SaveStreetSetModal({ onClose, onSave, streets, center, radius }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter a name for this street set');
      return;
    }

    setSaving(true);

    try {
      await onSave({ name: name.trim(), description: description.trim() });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save street set');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-modal-overlay" onClick={onClose}>
      <div className="save-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2>Save Street Set</h2>
        <p className="modal-subtitle">
          Save these {streets?.length || 0} streets for future practice
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Downtown Streets"
              maxLength={50}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this street set..."
              maxLength={200}
              rows={3}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Street Set'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
