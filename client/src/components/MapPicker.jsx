import React, { useState, useEffect, useRef } from 'react';
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

// Rough bounding box of Zimbabwe for Photon: minLon, minLat, maxLon, maxLat
const ZW_BBOX = '25.2,-22.5,33.1,-15.6';

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
 *  onAddress function({ address, city })  called with the street address found for the pin;
 *            return true if the address was used (shows a short note under the map)
 *  readOnly  true = just show the pin (marketing view)
 *  height    CSS height of the map
 */
const MapPicker = ({ value, onChange, onAddress, readOnly = false, height = '320px' }) => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');
  const [results, setResults] = useState([]);
  // Only changes when the pin is set by search or GPS, so dragging/clicking does not re-zoom the map
  const [flyTarget, setFlyTarget] = useState(null);

  const hasPin = value && Number.isFinite(value.lat) && Number.isFinite(value.lng);

  // Turns the pin into a street address (reverse geocoding through Nominatim).
  // Waits a moment after the last pin move and ignores answers for older pins,
  // so the service sees at most one request per pin.
  const lookupId = useRef(0);
  const lookupTimer = useRef(null);

  useEffect(function() {
    return function() { clearTimeout(lookupTimer.current); };
  }, []);

  const lookupAddress = function(pos) {
    if (!onAddress) return;
    clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(async function() {
      var myId = ++lookupId.current;
      try {
        var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18' +
          '&accept-language=en&lat=' + pos.lat + '&lon=' + pos.lng;
        var res = await fetch(url, { headers: { Accept: 'application/json' } });
        var data = await res.json();
        if (myId !== lookupId.current) return; // a newer pin was placed meanwhile
        var a = (data && data.address) || {};

        var street = [a.house_number, a.road].filter(Boolean).join(' ');
        var area = a.suburb || a.neighbourhood || a.hamlet || a.village || '';
        var address = [street, area].filter(Boolean).join(', ');
        if (!address) {
          // Rural spots often have no street: use the place name or the first parts of the full name
          address = data.name || (data.display_name || '').split(',').slice(0, 2).join(',').trim();
        }
        var city = a.city || a.town || a.village || a.municipality || a.county || a.state_district || '';

        if (address || city) {
          var used = onAddress({ address: address, city: city });
          if (used) setNote('Address filled in from the pin. You can still edit it below.');
        }
      } catch (err) {
        // Not critical: the customer can type the address instead
      }
    }, 600);
  };

  const setPin = function(pos, fly) {
    setNote('');
    setResults([]);
    onChange(pos);
    if (fly) setFlyTarget(pos);
    lookupAddress(pos);
  };

  // Place search. Tries OpenStreetMap's Nominatim first (Zimbabwe only, up to 5 matches),
  // then falls back to Photon, which handles partial and fuzzy names better.
  // Runs only when the user presses Search or Enter.
  const search = async function() {
    var q = query.trim();
    if (!q) return;
    setSearching(true);
    setNote('');
    setResults([]);
    try {
      var found = [];

      // 1) Nominatim
      try {
        var r1 = await fetch(
          'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=zw&q=' +
            encodeURIComponent(q),
          { headers: { Accept: 'application/json' } }
        );
        if (r1.ok) {
          var d1 = await r1.json();
          found = d1.map(function(x) {
            return { label: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon) };
          });
        }
      } catch (e) {
        // fall through to Photon
      }

      // 2) Photon fallback, limited to a Zimbabwe bounding box
      if (found.length === 0) {
        try {
          var r2 = await fetch(
            'https://photon.komoot.io/api/?limit=5&bbox=' + ZW_BBOX + '&q=' + encodeURIComponent(q)
          );
          if (r2.ok) {
            var d2 = await r2.json();
            found = (d2.features || []).map(function(f) {
              var p = f.properties || {};
              var label = [p.name, p.street, p.city || p.county, p.state].filter(Boolean).join(', ');
              return {
                label: label || 'Unnamed place',
                lat: f.geometry.coordinates[1],
                lng: f.geometry.coordinates[0]
              };
            });
          }
        } catch (e) {
          // handled below
        }
      }

      if (found.length === 0) {
        setNote('No match found. Try a nearby town or road, or click the map to place the pin.');
      } else if (found.length === 1) {
        setPin({ lat: found[0].lat, lng: found[0].lng }, true);
      } else {
        setResults(found); // let the customer choose
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
            placeholder="Search a town or road, e.g. Mvurwi or Samora Machel Ave"
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

      {!readOnly && results.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0 0 8px', padding: 0 }}>
          {results.map(function(r, i) {
            return (
              <li key={i}>
                <button
                  type="button"
                  className="glow-btn glow-btn-small glow-btn-secondary"
                  style={{ width: '100%', textAlign: 'left', marginBottom: '4px' }}
                  onClick={function() { setPin({ lat: r.lat, lng: r.lng }, true); }}
                >
                  {r.label}
                </button>
              </li>
            );
          })}
        </ul>
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
