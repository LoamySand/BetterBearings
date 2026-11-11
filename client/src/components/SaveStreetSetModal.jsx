import { useState } from 'react';
import { X, Save } from 'lucide-react';
import './SaveStreetSetModal.css';
import useDialog from '../hooks/useDialog';
import { Spinner } from './StatusPanel';

export default function SaveStreetSetModal({
  onClose,
  onSave,
  streets,
  center,
  radius,
  isCreating = false,
  loading = false,
  error = null,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { titleId, dialogProps } = useDialog(onClose);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!name.trim()) {
      setSubmitError('Please enter a name for this street set');
      return;
    }

    if (isCreating && streets.length === 0) {
      setSubmitError('No streets were loaded. Please try selecting a different area.');
      return;
    }

    setSaving(true);

    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        difficulty: isCreating ? difficulty : undefined,
      });
      onClose();
    } catch (err) {
      setSubmitError(err.message || 'Failed to save street set');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-modal-overlay" onClick={onClose}>
      <div className="save-modal" {...dialogProps} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <h2 id={titleId}>Save Street Set</h2>
        <p className="modal-subtitle">
          {loading
            ? 'Loading streets from map area...'
            : `Save these ${streets?.length || 0} streets for future practice`}
        </p>

        {error && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {loading && (
          <div className="loading-message" role="status">
            <Spinner size={24} />
            Loading streets...
          </div>
        )}

        {!loading && (
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

            {submitError && <div className="error-message">{submitError}</div>}

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-cancel" disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn-save" disabled={saving || loading}>
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Street Set'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
