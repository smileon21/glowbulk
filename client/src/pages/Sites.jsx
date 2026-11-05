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
  cityZoneId: '',
  latitude: '',
  longitude: ''
};

// ---------------------------------------------------------------
// Register / edit a site
// ---------------------------------------------------------------
const SiteForm = ({ site, onSaved, onCancel }) => {
  const [form, setForm] = useState(
    site
      ? {
          name: site.name,
          cityZoneId: site.city_zone_id ? String(site.city_zone_id) : '',
          latitude: String(site.latitude),
          longitude: String(site.longitude)
        }
      : EMPTY_FORM
  );
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // The city list comes from the Zones page
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_BASE_URL}/api/zones`, authConfig())
      .then((response) => {
        if (!cancelled) setZones(response.data.data || []);
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err, 'Unable to load the city list.'));
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Active zones, plus the site's current zone when editing
  const zoneOptions = zones.filter(
    (z) => z.is_active || (site && z.id === site.city_zone_id)
  );
  const selectedZone = zones.find((z) => String(z.id) === form.cityZoneId);

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
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        }));
      },
      () => setError('Could not get your location. Type the coordinates instead.')
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!form.cityZoneId) {
      setError('Please choose a city (zone).');
      return;
    }
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      setError('Latitude must be a number between -90 and 90.');
      return;
    }
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      setError('Longitude must be a number between -180 and 180.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        cityZoneId: Number(form.cityZoneId),
        latitude,
        longitude
      };

      if (site) {
        await axios.put(`${API_BASE_URL}/api/sites/${site.id}`, payload, authConfig());
        onSaved(`${payload.name} updated.`);
      } else {
        await axios.post(`${API_BASE_URL}/api/sites`, payload, authConfig());
        onSaved(`${payload.name} registered.`);
      }
    } catch (err) {
      setError(errorText(err, 'Unable to save the site.'));
      setSaving(false);
    }
  };

  return (
    <form className="it-card" onSubmit={submit}>
      <strong>{site ? 'Edit site' : 'Register New Site'}</strong>
      {error && <div className="error-message" style={{ marginTop: '0.6rem' }}>{error}</div>}

      <div className="it-form-grid">
        <div className="it-field">
          <label>Site Name</label>
          <input
            className="it-input"
            placeholder="e.g. Msasa Depot"
            value={form.name}
            onChange={set('name')}
            required
          />
        </div>
        <div className="it-field">
          <label>City (zone)</label>
          <select
            className="it-select"
            value={form.cityZoneId}
            onChange={set('cityZoneId')}
            required
            disabled={zonesLoading}
          >
            <option value="">{zonesLoading ? 'Loading cities...' : 'Select a city'}</option>
            {zoneOptions.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          {!zonesLoading && zoneOptions.length === 0 ? (
            <span className="it-sub">No cities yet. Add one on the Zones page first.</span>
          ) : selectedZone ? (
            <span className="it-sub">
              Zone radius: {selectedZone.radius_km} km from the {selectedZone.name} centre.
            </span>
          ) : null}
        </div>
      </div>

      <div className="it-form-grid">
        <div className="it-field">
          <label>Latitude</label>
          <input
            className="it-input"
            inputMode="decimal"
            placeholder="-17.8..."
            value={form.latitude}
            onChange={set('latitude')}
            required
          />
        </div>
        <div className="it-field">
          <label>Longitude</label>
          <input
            className="it-input"
            inputMode="decimal"
            placeholder="31.0..."
            value={form.longitude}
            onChange={set('longitude')}
            required
          />
        </div>
      </div>

      <div className="it-actions">
        <button type="submit" className="it-btn" disabled={saving}>
          {saving ? 'Saving...' : site ? 'Save changes' : 'Save Site'}
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
const Sites = () => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null); // site currently being activated/deactivated

  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  // The form, error and success messages all render at the top of the page.
  // When a button lower down is clicked, scroll back up so the result is visible.
  const topRef = useRef(null);
  const scrollToTop = () => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Wait a moment after typing before filtering
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadSites = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/sites`, authConfig());
      setSites(response.data.data || []);
    } catch (err) {
      setError(errorText(err, 'Unable to load sites.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const openNew = () => {
    setEditing(null);
    setNotice('');
    setShowForm(true);
  };

  const openEdit = (site) => {
    setEditing(site);
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
    loadSites();
    scrollToTop();
  };

  const toggleActive = async (site) => {
    setError('');
    setNotice('');
    setBusyId(site.id);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/sites/${site.id}/status`,
        { isActive: !site.is_active },
        authConfig()
      );
      setNotice(`${site.name} ${site.is_active ? 'deactivated' : 'activated'}.`);
      loadSites();
    } catch (err) {
      setError(errorText(err, 'Unable to change the site status.'));
    } finally {
      setBusyId(null);
      scrollToTop();
    }
  };

  const visible = sites.filter((site) => {
    if (status === 'active' && !site.is_active) return false;
    if (status === 'inactive' && site.is_active) return false;
    if (!search) return true;
    return (
      String(site.name).toLowerCase().includes(search) ||
      String(site.city).toLowerCase().includes(search) ||
      String(site.region).toLowerCase().includes(search)
    );
  });

  return (
    <div className="it-page" ref={topRef}>
      <div className="page-header">
        <h2>Sites</h2>
      </div>
      <p className="sub-text">Register service stations. Each site belongs to a city zone, which sets the pricing radius</p>

      {error && <div className="error-message">{error}</div>}
      {notice && <div className="success-message">{notice}</div>}

      {showForm ? (
        <SiteForm
          key={editing ? editing.id : 'new'}
          site={editing}
          onSaved={handleSaved}
          onCancel={closeForm}
        />
      ) : (
        <div className="it-toolbar">
          <button type="button" className="it-btn" onClick={openNew}>
            + Register New Site
          </button>
        </div>
      )}

      <div className="it-toolbar">
        <input
          className="it-input"
          type="search"
          placeholder="Search site, city or region"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select className="it-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="it-spacer" />
        <span className="it-sub">
          {loading ? 'Loading...' : `${visible.length} site${visible.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="it-table-wrap">
        {visible.length === 0 && !loading ? (
          <div className="it-empty">No sites yet.</div>
        ) : (
          <table className="it-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>City (zone)</th>
                <th>Region</th>
                <th>Coordinates</th>
                <th>Zone radius</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((site) => (
                <tr key={site.id}>
                  <td>{site.name}</td>
                  <td>{site.city}</td>
                  <td>{site.region}</td>
                  <td>
                    {Number(site.latitude).toFixed(5)}, {Number(site.longitude).toFixed(5)}
                  </td>
                  <td>{site.city_radius_km != null ? `${site.city_radius_km} km` : 'No zone'}</td>
                  <td>
                    {site.is_active ? (
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
                        onClick={() => openEdit(site)}
                      >
                        Edit
                      </button>
                      {site.is_active ? (
                        <button
                          type="button"
                          className="it-btn danger small"
                          onClick={() => toggleActive(site)}
                          disabled={busyId === site.id}
                        >
                          {busyId === site.id ? 'Working...' : 'Deactivate'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="it-btn small"
                          onClick={() => toggleActive(site)}
                          disabled={busyId === site.id}
                        >
                          {busyId === site.id ? 'Working...' : 'Activate'}
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

export default Sites;