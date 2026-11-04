import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const fmt = function(d) {
  var date = new Date(d);
  return isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const row = function(label, value) {
  return value ? (
    <div className="pay-row">
      <span className="pay-label">{label}</span>
      <span className="pay-value">{value}</span>
    </div>
  ) : null;
};

const PaymentDetails = () => {
  const [methods, setMethods] = useState([]);
  const [clearance, setClearance] = useState(null);

  useEffect(function() {
    var cancelled = false;
    var config = { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } };

    axios.get(API_BASE_URL + '/api/finance/payment-methods/active', config)
      .then(function(res) {
        if (!cancelled && res.data.success) setMethods(res.data.data || []);
      })
      .catch(function(e) { console.error('Payment methods unavailable', e); });

    axios.get(API_BASE_URL + '/api/finance/tax-clearance/current', config)
      .then(function(res) {
        if (!cancelled && res.data.success) setClearance(res.data.data || null);
      })
      .catch(function(e) { console.error('Tax clearance unavailable', e); });

    return function() { cancelled = true; };
  }, []);

  if (methods.length === 0 && !clearance) return null;

  return (
    <div className="payment-details">
      {methods.length > 0 && (
        <>
          <h4>How to pay</h4>
          {methods.map(function(m) {
            return (
              <div key={m.id} className="pay-method">
                <div className="pay-method-title">{m.title}</div>
                {row('Bank', m.bank_name)}
                {row('Account name', m.account_name)}
                {row('Account number', m.account_number)}
                {row('Branch', m.branch)}
                {row('SWIFT', m.swift_code)}
                {row('Mobile number', m.mobile_number)}
                {row('Currency', m.currency)}
                {m.instructions && <p className="pay-instructions">{m.instructions}</p>}
              </div>
            );
          })}
        </>
      )}
      {clearance && (
        <div className="pay-method">
          <div className="pay-method-title">Tax clearance</div>
          {row('Certificate no.', clearance.certificate_number)}
          {row('Valid until', fmt(clearance.expiry_date))}
          {clearance.file_url && (
            <a href={clearance.file_url} target="_blank" rel="noopener noreferrer"
               className="glow-btn glow-btn-secondary glow-btn-small pay-download">
              View certificate (PDF)
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentDetails;
