import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './ITAdmin.css';

const authConfig = (extra) => ({
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
  ...extra
});

const errorText = (err, fallback) => (err.response && err.response.data && err.response.data.message) || fallback;

const EMPTY_FORM = {
  name: '',
  region: '',
  centreLatitude: '',
  centreLongitude: '',
  radiusKm: '20'
};

const REGIONS = [
  'Harare',
  'Bulawayo',
  'Manicaland',
  'Mashonaland Central',
  'Mashonaland East',
  'Mashonaland West',
  'Masvingo',
  'Matabeleland North',
  'Matabeleland South',
  'Midlands'
];

// ---------------------------------------------------------------
// Add / edit a city zone
// ---------------------------------------------------------------
const ZoneForm = ({ zone, onSaved, onCancel }) => {
  const [form, setForm] = useState(
    zone
      ? {
          name: zone.name,
          region: zone.region,
          centreLatitude: String(zone.centre_latitude),
          centreLongitude: String(zone.centre_longitude),
          radiusKm: String(zone.radius_km)
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser cannot detect your location. Type the coordinates instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setError('');
        setForm((f) => ({
          ...f,
          centreLatitude: pos.coords.latitude.toFixed(6),
          centreLongitude: pos.coords.longitude.toFixed(6)
        }));
      },
      () => setError('Could not get your location. Type the coordinates instead.')
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const centreLatitude = Number(form.centreLatitude);
    const centreLongitude = Number(form.centreLongitude);
    const radiusKm = Number(form.radiusKm);

    if (Number.isNaN(centreLatitude) || centreLatitude < -90 || centreLatitude > 90) {
      setError('Latitude must be a number between -90 and 90.');
      return;
    }
    if (Number.isNaN(centreLongitude) || centreLongitude < -180 || centreLongitude > 180) {
      setError('Longitude must be a number between -180 and 180.');
      return;
    }
    if (Number.isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
      setError('Radius must be more than 0 and at most 500 km.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        region: form.region.trim(),
        centreLatitude,
        centreLongitude,
        radiusKm
      };

      if (zone) {
        await axios.put(`${API_BASE_URL}/api/zones/${zone.id}`, payload, authConfig());
        onSaved(`${payload.name} zone updated.`);
      } else {
        await axios.post(`${API_BASE_URL}/api/zones`, payload, authConfig());
        onSaved(`${payload.name} zone added.`);
      }
    } catch (err) {
      setError(errorText(err, 'Unable to save the zone.'));
      setSaving(false);
    }
  };

  return (
    <form className="it-card" onSubmit={submit}>
      <strong>{zone ? 'Edit zone' : 'Add New Zone'}</strong>
      {error && <div className="error-message" style={{ marginTop: '0.6rem' }}>{error}</div>}

      <div className="it-form-grid">
        <div className="it-field">
          <label>City</label>
          <input
            className="it-input"
            placeholder="e.g. Harare"
            value={form.name}
            onChange={set('name')}
            required
          />
        </div>
        <div className="it-field">
          <label>Region</label>
          <select className="it-select" value={form.region} onChange={set('region')} required>
            <option value="">Select a region</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="it-field">
          <label>Radius (km)</label>
          <input
            className="it-input"
            inputMode="decimal"
            placeholder="20"
            value={form.radiusKm}
            onChange={set('radiusKm')}
            required
          />
          <span className="it-sub">Customers within this distance of the city centre are in the zone.</span>
        </div>
      </div>

      <div className="it-form-grid">
        <div className="it-field">
          <label>City centre latitude</label>
          <input
            className="it-input"
            inputMode="decimal"
            placeholder="-17.8..."
            value={form.centreLatitude}
            onChange={set('centreLatitude')}
            required
          />
        </div>
        <div className="it-field">
          <label>City centre longitude</label>
          <input
            className="it-input"
            inputMode="decimal"
            placeholder="31.0..."
            value={form.centreLongitude}
            onChange={set('centreLongitude')}
            required
          />
          <span className="it-sub">
            Tip: in Google Maps, right-click the middle of the city (the CBD) and click the coordinates to copy them.
          </span>
        </div>
      </div>

      <div className="it-actions">
        <button type="submit" className="it-btn" disabled={saving}>
          {saving ? 'Saving...' : zone ? 'Save changes' : 'Save Zone'}
        </button>
        <button type="button" className="it-btn ghost" onClick={useMyLocation}>
          Use my current location
        </button>
        <button type="button" className="it-btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------
const Zones = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const topRef = useRef(null);
  const scrollToTop = () => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const loadZones = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/zones`, authConfig());
      setZones(response.data.data || []);
    } catch (err) {
      setError(errorText(err, 'Unable to load zones.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  const openNew = () => {
    setEditing(null);
    setNotice('');
    setShowForm(true);
  };

  const openEdit = (zone) => {
    setEditing(zone);
    setNotice('');
    setError('');
    setShowForm(true);
    scrollToTop();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSaved = (message) => {
    closeForm();
    setError('');
    setNotice(message);
    loadZones();
    scrollToTop();
  };

  const toggleActive = async (zone) => {
    setError('');
    setNotice('');
    setBusyId(zone.id);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/zones/${zone.id}/status`,
        { isActive: !zone.is_active },
        authConfig()
      );
      setNotice(`${zone.name} zone ${zone.is_active ? 'deactivated' : 'activated'}.`);
      loadZones();
    } catch (err) {
      setError(errorText(err, 'Unable to change the zone status.'));
    } finally {
      setBusyId(null);
      scrollToTop();
    }
  };

  return (
    <div className="it-page" ref={topRef}>
      <div className="page-header">
        <h2>Zones</h2>
      </div>
      <p className="sub-text">
        Each city has one zone: a circle around the city centre. Customers inside it get automatic quotes from the sites in that city.
      </p>

      {error && <div className="error-message">{error}</div>}
      {notice && <div className="success-message">{notice}</div>}

      {showForm ? (
        <ZoneForm
          key={editing ? editing.id : 'new'}
          zone={editing}
          onSaved={handleSaved}
          onCancel={closeForm}
        />
      ) : (
        <div className="it-toolbar">
          <button type="button" className="it-btn" onClick={openNew}>
            + Add New Zone
          </button>
          <span className="it-spacer" />
          <span className="it-sub">
            {loading ? 'Loading...' : `${zones.length} zone${zones.length === 1 ? '' : 's'}`}
          </span>
        </div>
      )}

      <div className="it-table-wrap">
        {zones.length === 0 && !loading ? (
          <div className="it-empty">No zones yet.</div>
        ) : (
          <table className="it-table">
            <thead>
              <tr>
                <th>City</th>
                <th>Region</th>
                <th>City centre</th>
                <th>Radius</th>
                <th>Sites</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id}>
                  <td>{zone.name}</td>
                  <td>{zone.region}</td>
                  <td>
                    {Number(zone.centre_latitude).toFixed(5)}, {Number(zone.centre_longitude).toFixed(5)}
                  </td>
                  <td>{zone.radius_km} km</td>
                  <td>{zone.site_count}</td>
                  <td>
                    {zone.is_active ? (
                      <span className="it-badge active">Active</span>
                    ) : (
                      <span className="it-badge blocked">Inactive</span>
                    )}
                  </td>
                  <td>
                    <div className="it-actions">
                      <button
                        type="button"
                        className="it-btn ghost small"
                        onClick={() => openEdit(zone)}
                      >
                        Edit
                      </button>
                      {zone.is_active ? (
                        <button
                          type="button"
                          className="it-btn danger small"
                          onClick={() => toggleActive(zone)}
                          disabled={busyId === zone.id}
                        >
                          {busyId === zone.id ? 'Working...' : 'Deactivate'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="it-btn small"
                          onClick={() => toggleActive(zone)}
                          disabled={busyId === zone.id}
                        >
                          {busyId === zone.id ? 'Working...' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Zones;