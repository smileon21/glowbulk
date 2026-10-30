import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Vite does not resolve Leaflet's default marker image paths, so point them at the bundled files
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// Centre of Zimbabwe, used until a pin exists
const DEFAULT_CENTER = [-19.0154, 29.1549];
const DEFAULT_ZOOM = 6;
const PIN_ZOOM = 15;

// Click anywhere on the map to move the pin
function ClickToPin({ onPick }) {
  useMapEvents({
    click: function(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

// Moves the map when the pin changes from outside (search, "use my location")
function FlyTo({ target }) {
  const map = useMap();
  useEffect(function() {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), PIN_ZOOM));
  }, [target, map]);
  return null;
}

/**
 * Props
 *  value     { lat, lng } or null
 *  onChange  function({ lat, lng })  (not needed when readOnly)
 *  readOnly  true = just show the pin (marketing view)
 *  height    CSS height of the map
 */
const MapPicker = ({ value, onChange, readOnly = false, height = '320px' }) => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');
  // Only changes when the pin is set by search or GPS, so dragging/clicking does not re-zoom the map
  const [flyTarget, setFlyTarget] = useState(null);

  const hasPin = value && Number.isFinite(value.lat) && Number.isFinite(value.lng);

  const setPin = function(pos, fly) {
    setNote('');
    onChange(pos);
    if (fly) setFlyTarget(pos);
  };

  // Address search through OpenStreetMap's Nominatim.
  // Runs only when the user presses Search or Enter (the service allows about 1 request per second).
  const search = async function() {
    var q = query.trim();
    if (!q) return;
    setSearching(true);
    setNote('');
    try {
      var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=zw&q=' +
        encodeURIComponent(q);
      var res = await fetch(url, { headers: { Accept: 'application/json' } });
      var data = await res.json();
      if (data.length === 0) {
        setNote('No match found. Try a nearby town or click the map instead.');
      } else {
        setPin({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }, true);
      }
    } catch (err) {
      setNote('Search is unavailable right now. Click the map to place the pin.');
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = function() {
    if (!navigator.geolocation) {
      setNote('Your browser cannot share its location. Click the map instead.');
      return;
    }
    setNote('Finding your location...');
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true);
      },
      function() {
        setNote('Location permission was denied. Click the map to place the pin.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const osmLink = hasPin
    ? 'https://www.openstreetmap.org/?mlat=' + value.lat + '&mlon=' + value.lng +
      '#map=17/' + value.lat + '/' + value.lng
    : null;

  return (
    <div className="map-picker">
      {!readOnly && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="glow-input"
            style={{ flex: '1 1 220px' }}
            placeholder="Search a place, e.g. Mvurwi or Samora Machel Ave, Harare"
            value={query}
            onChange={function(e) { setQuery(e.target.value); }}
            onKeyDown={function(e) {
              // Enter must search, not submit the quote form this sits inside
              if (e.key === 'Enter') { e.preventDefault(); search(); }
            }}
          />
          <button type="button" className="glow-btn glow-btn-small" onClick={search} disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
          <button type="button" className="glow-btn glow-btn-small glow-btn-secondary" onClick={useMyLocation}>
            Use my location
          </button>
        </div>
      )}

      <MapContainer
        center={hasPin ? [value.lat, value.lng] : DEFAULT_CENTER}
        zoom={hasPin ? PIN_ZOOM : DEFAULT_ZOOM}
        scrollWheelZoom={!readOnly}
        style={{ height: height, width: '100%', borderRadius: '8px', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {!readOnly && <ClickToPin onPick={function(pos) { setPin(pos, false); }} />}
        <FlyTo target={flyTarget} />
        {hasPin && (
          <Marker
            position={[value.lat, value.lng]}
            draggable={!readOnly}
            eventHandlers={{
              dragend: function(e) {
                var p = e.target.getLatLng();
                setPin({ lat: p.lat, lng: p.lng }, false);
              }
            }}
          />
        )}
      </MapContainer>

      <div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
        {hasPin ? (
          <span>
            Pin: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}{' '}
            <a href={osmLink} target="_blank" rel="noopener noreferrer">Open in OpenStreetMap</a>
          </span>
        ) : (
          <span>{readOnly ? 'No location was pinned.' : 'No pin yet. Click the map to place one.'}</span>
        )}
        {note && <div>{note}</div>}
      </div>
    </div>
  );
};

export default MapPicker;
