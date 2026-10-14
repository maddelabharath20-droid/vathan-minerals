import React, { useState, useEffect } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { api } from './api';
import VMLogo from './VMLogo';
import {
  Fingerprint, CheckCircle2, AlertCircle, User, Plus, Trash2,
  Clock, Shield, RefreshCw, Loader2, ShieldCheck, Users, X
} from 'lucide-react';

const today = new Date().toISOString().slice(0, 10);

const fmtTime = (t) => {
  if (!t) return '—';
  try {
    const [h, m] = t.split(':');
    const hh = Number(h);
    return `${hh % 12 || 12}:${m} ${hh >= 12 ? 'PM' : 'AM'}`;
  } catch { return t; }
};

function playChime(success) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const notes = success ? [523, 659, 784] : [330, 294];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      o.type = 'sine';
      g.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
      o.connect(g);
      o.start(ctx.currentTime + i * 0.15);
      o.stop(ctx.currentTime + i * 0.15 + 0.35);
    });
  } catch { /* silent fail */ }
}

export default function FingerprintTab({ user }) {
  const [subTab, setSubTab] = useState('kiosk'); // 'kiosk' | 'enrolled'
  const [employees, setEmployees] = useState([]);
  const [enrolledList, setEnrolledList] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Kiosk states
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [kioskError, setKioskError] = useState('');

  // Enroll modal
  const [enrollModal, setEnrollModal] = useState(false);
  const [enrollEmpId, setEnrollEmpId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState('');

  // Global notices
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 6000); return () => clearTimeout(t); }
  }, [error]);
  useEffect(() => {
    if (scanResult) { const t = setTimeout(() => setScanResult(null), 8000); return () => clearTimeout(t); }
  }, [scanResult]);

  async function loadData() {
    setLoading(true);
    try {
      const [empData, enrolledData, todayData] = await Promise.all([
        api('/employees?limit=200').catch(() => []),
        api('/webauthn/enrolled').catch(() => []),
        api(`/attendance/today?date=${today}`).catch(() => []),
      ]);
      setEmployees(empData || []);
      setEnrolledList(enrolledData || []);
      setTodayLogs(todayData || []);
    } catch (e) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // ── Kiosk: scan fingerprint & mark attendance ──────────────────
  async function scanAttendance() {
    setScanning(true);
    setScanResult(null);
    setKioskError('');
    try {
      const opts = await api('/webauthn/auth-options', { method: 'POST' });
      const authResponse = await startAuthentication({ optionsJSON: opts });
      const result = await api('/webauthn/auth-verify', {
        method: 'POST',
        body: JSON.stringify({ authResponse, date: today }),
      });
      setScanResult(result);
      playChime(true);
      await loadData();
    } catch (e) {
      playChime(false);
      let msg = e.message || 'Scan failed.';
      if (e.name === 'NotAllowedError') msg = 'Scan cancelled or fingerprint not recognised. Please try again.';
      if (e.name === 'InvalidStateError') msg = 'No fingerprint enrolled for this device. Please enroll first.';
      if (e.name === 'SecurityError') msg = 'Security error – please access via localhost or HTTPS.';
      setKioskError(msg);
    } finally {
      setScanning(false);
    }
  }

  // ── Enrollment ─────────────────────────────────────────────────
  async function enrollFingerprint() {
    if (!enrollEmpId) { setEnrollError('Please select an employee.'); return; }
    setEnrolling(true);
    setEnrollError('');
    try {
      const opts = await api('/webauthn/register-options', {
        method: 'POST',
        body: JSON.stringify({ employee_id: Number(enrollEmpId) }),
      });
      const regResponse = await startRegistration({ optionsJSON: opts });
      await api('/webauthn/register-verify', {
        method: 'POST',
        body: JSON.stringify({ employee_id: Number(enrollEmpId), registration: regResponse }),
      });
      setEnrollSuccess('Fingerprint enrolled successfully!');
      setSuccess(`Fingerprint enrolled for ${employees.find(e => String(e.id) === enrollEmpId)?.full_name}!`);
      setEnrollModal(false);
      setEnrollEmpId('');
      await loadData();
    } catch (e) {
      let msg = e.message || 'Enrollment failed.';
      if (e.name === 'NotAllowedError') msg = 'Enrollment cancelled. Please try again.';
      if (e.name === 'InvalidStateError') msg = 'This fingerprint is already registered on this device.';
      setEnrollError(msg);
    } finally {
      setEnrolling(false);
    }
  }

  async function removeEnrollment(empId, empName) {
    if (!window.confirm(`Remove all fingerprint credentials for ${empName}?`)) return;
    try {
      await api(`/webauthn/credentials/${empId}`, { method: 'DELETE' });
      setSuccess('Fingerprint credential removed.');
      await loadData();
    } catch (e) {
      setError(e.message || 'Failed to remove credential.');
    }
  }

  const fingerprintCount = enrolledList.length;
  const todayFpLogs = todayLogs.filter(a => a.verification_type === 'fingerprint');

  // ── Scan state colours ─────────────────────────────────────────
  const scanState = scanning ? 'scanning'
    : scanResult?.success ? 'success'
    : kioskError ? 'error'
    : 'idle';

  const ringColor = {
    idle:     'border-slate-600',
    scanning: 'border-cyan-400',
    success:  'border-emerald-400',
    error:    'border-red-400',
  }[scanState];

  const iconColor = {
    idle:     'text-slate-400',
    scanning: 'text-cyan-400',
    success:  'text-emerald-400',
    error:    'text-red-400',
  }[scanState];

  return (
    <div className="space-y-6">

      {/* Global notices */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <VMLogo size={46} />
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Fingerprint size={22} className="text-violet-700" /> Fingerprint Attendance Kiosk
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              WebAuthn Biometric Sensor & Windows Hello Integration · VATHAN MINERALS (Rly. Kodur)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEnrollModal(true)}
            className="bg-violet-700 hover:bg-violet-800 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition"
          >
            <Plus size={16} /> Enroll Fingerprint
          </button>
          <button
            onClick={loadData}
            className="border border-slate-200 text-slate-600 rounded-xl p-2.5 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { id: 'kiosk',    label: 'Fingerprint Kiosk', icon: Fingerprint },
          { id: 'enrolled', label: 'Enrolled Staff',    icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition
              ${subTab === id ? 'bg-white shadow text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── KIOSK TAB ─────────────────────────────────────────── */}
      {subTab === 'kiosk' && (
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Scanner panel */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[480px] shadow-2xl relative overflow-hidden">
            {/* Background glow */}
            <div className={`absolute inset-0 transition-all duration-700 ${
              scanState === 'scanning' ? 'bg-cyan-500/5' :
              scanState === 'success'  ? 'bg-emerald-500/8' :
              scanState === 'error'    ? 'bg-red-500/5' : ''
            }`} />

            {/* Animated rings */}
            <div className="relative flex items-center justify-center mb-8">
              {/* Outer pulsing ring – only when scanning */}
              {scanState === 'scanning' && (
                <>
                  <div className="absolute w-52 h-52 rounded-full border-2 border-cyan-400/30 animate-ping" />
                  <div className="absolute w-40 h-40 rounded-full border border-cyan-400/40 animate-ping [animation-delay:300ms]" />
                </>
              )}
              {/* Success ring flash */}
              {scanState === 'success' && (
                <div className="absolute w-52 h-52 rounded-full border-2 border-emerald-400/40 animate-ping [animation-delay:0ms]" />
              )}

              {/* Main sensor circle */}
              <div className={`w-36 h-36 rounded-full border-4 ${ringColor} flex items-center justify-center
                bg-slate-800/80 backdrop-blur transition-all duration-500 shadow-lg`}>
                {scanning ? (
                  <Loader2 size={56} className="text-cyan-400 animate-spin" />
                ) : scanResult?.success ? (
                  <CheckCircle2 size={56} className="text-emerald-400" />
                ) : kioskError ? (
                  <AlertCircle size={56} className="text-red-400" />
                ) : (
                  <Fingerprint size={56} className={`${iconColor} transition-colors duration-300`} />
                )}
              </div>
            </div>

            {/* Status text */}
            <div className="text-center z-10 mb-8 px-4">
              {scanning && (
                <>
                  <p className="text-cyan-400 font-bold text-xl mb-1">Scanning…</p>
                  <p className="text-slate-400 text-sm">Follow the browser prompt to authenticate</p>
                </>
              )}
              {!scanning && scanResult?.success && (
                <>
                  <p className="text-emerald-400 font-bold text-2xl mb-1">
                    {scanResult.action === 'check_in' ? '✓ Checked In' : '✓ Checked Out'}
                  </p>
                  <p className="text-white text-lg font-semibold">{scanResult.employee?.full_name}</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {scanResult.employee?.employee_code} · {fmtTime(scanResult.time)}
                  </p>
                </>
              )}
              {!scanning && kioskError && (
                <>
                  <p className="text-red-400 font-bold text-lg mb-1">Scan Failed</p>
                  <p className="text-slate-400 text-sm max-w-xs">{kioskError}</p>
                </>
              )}
              {!scanning && !scanResult && !kioskError && (
                <>
                  <p className="text-white font-semibold text-lg mb-1">Ready to Scan</p>
                  <p className="text-slate-400 text-sm">Press the button and use your device's fingerprint sensor</p>
                </>
              )}
            </div>

            {/* Action button */}
            <button
              onClick={scanAttendance}
              disabled={scanning}
              className={`z-10 px-10 py-4 rounded-2xl font-bold text-base transition-all duration-200
                ${scanning
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-500 active:scale-95 text-white shadow-lg hover:shadow-violet-500/30'}`}
            >
              {scanning ? (
                <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Scanning…</span>
              ) : (
                <span className="flex items-center gap-2"><Fingerprint size={18} /> Scan Fingerprint</span>
              )}
            </button>

            {/* Enrolled count badge */}
            <div className="absolute top-4 right-4 bg-slate-700/60 text-slate-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur">
              <Shield size={12} /> {fingerprintCount} enrolled
            </div>
          </div>

          {/* Today's fingerprint log sidebar */}
          <div className="bg-white rounded-3xl border shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock size={15} className="text-violet-700" /> Today's Scans
              </h3>
              <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {todayFpLogs.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 max-h-96">
              {todayFpLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Fingerprint size={32} className="mb-2 opacity-30" />
                  <p className="text-xs">No fingerprint scans today</p>
                </div>
              ) : (
                todayFpLogs.map(a => (
                  <div key={a.id} className="px-5 py-3 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 truncate">{a.full_name}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        a.check_out ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {a.check_out ? 'Out' : 'In'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.employee_code} · In {fmtTime(a.check_in)} {a.check_out && `· Out ${fmtTime(a.check_out)}`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ENROLLED STAFF TAB ──────────────────────────────────── */}
      {subTab === 'enrolled' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
              <Loader2 size={20} className="animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {employees.map(emp => {
                const cred = enrolledList.find(e => e.employee_id === emp.id || String(e.employee_id) === String(emp.id));
                return (
                  <div key={emp.id} className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${
                        cred ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-dashed border-slate-200'
                      }`}>
                        <Fingerprint size={22} className={cred ? 'text-violet-600' : 'text-slate-300'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wide bg-violet-50 px-2 py-0.5 rounded">
                          {emp.employee_code}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1 truncate">{emp.full_name}</h4>
                        <p className="text-xs text-slate-400 truncate">{emp.job_title || 'Employee'}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t flex items-center justify-between">
                      {cred ? (
                        <>
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                              <ShieldCheck size={12} /> Enrolled
                            </span>
                            {cred.last_used && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Last: {new Date(cred.last_used).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEnrollEmpId(String(emp.id)); setEnrollModal(true); }}
                              className="text-xs text-violet-700 hover:underline font-semibold"
                            >
                              Re-enroll
                            </button>
                            <button
                              onClick={() => removeEnrollment(emp.id, emp.full_name)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded"
                              title="Remove fingerprint"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] text-slate-400 font-medium">Not enrolled</span>
                          <button
                            onClick={() => { setEnrollEmpId(String(emp.id)); setEnrollModal(true); }}
                            className="text-xs bg-slate-950 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
                          >
                            Enroll
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ENROLL MODAL ────────────────────────────────────────── */}
      {enrollModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b mb-5">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Fingerprint size={18} className="text-violet-700" /> Enroll Fingerprint
              </h3>
              <button onClick={() => { setEnrollModal(false); setEnrollEmpId(''); setEnrollError(''); }}
                className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select Employee</label>
                <select
                  value={enrollEmpId}
                  onChange={e => setEnrollEmpId(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Choose an employee…</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.employee_code} — {e.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Instruction */}
              <div className="bg-violet-50 rounded-2xl p-4 text-center">
                <Fingerprint size={40} className="text-violet-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-violet-900">Ready to capture fingerprint</p>
                <p className="text-xs text-violet-600 mt-1">
                  When you click Enroll, your device will prompt you to scan your fingerprint.
                  Use Windows Hello, Touch ID, or your device's sensor.
                </p>
              </div>

              {enrollError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {enrollError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setEnrollModal(false); setEnrollEmpId(''); setEnrollError(''); }}
                  className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl hover:bg-slate-50 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  onClick={enrollFingerprint}
                  disabled={enrolling || !enrollEmpId}
                  className="flex-1 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition"
                >
                  {enrolling ? (
                    <><Loader2 size={15} className="animate-spin" /> Enrolling…</>
                  ) : (
                    <><Fingerprint size={15} /> Enroll Now</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
