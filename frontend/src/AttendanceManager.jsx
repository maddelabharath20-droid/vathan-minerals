import React, { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { extractFaceDescriptor, findBestMatch, playChime } from './faceUtils';
import FingerprintTab from './FingerprintTab';
import VMLogo from './VMLogo';
import { 
  Camera, ScanFace, CheckCircle2, UserCheck, AlertCircle, Eye, 
  Trash2, Sparkles, Video, VideoOff, RefreshCw, Plus, Clock, 
  ShieldCheck, User, Users, Calendar, ArrowRight, X, Fingerprint
} from 'lucide-react';

const today = new Date().toISOString().slice(0, 10);
const fmtTime = (t) => {
  if (!t) return '—';
  try {
    const parts = t.split(':');
    const h = Number(parts[0]);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch {
    return t;
  }
};

export default function AttendanceManager({ user }) {
  const [tab, setTab] = useState('kiosk'); // 'kiosk' | 'logs' | 'enrolled'
  const [employees, setEmployees] = useState([]);
  const [enrolledFaces, setEnrolledFaces] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Camera states for Kiosk
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const streamRef = useRef(null);        // use ref to avoid stale closures
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [scanMode, setScanMode] = useState('check_in'); // 'check_in' | 'check_out'
  const [matchResult, setMatchResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Enrollment Modal states
  const [enrollModal, setEnrollModal] = useState(false);
  const [enrollEmpId, setEnrollEmpId] = useState('');
  const [enrollPhoto, setEnrollPhoto] = useState(null);
  const [enrollDescriptor, setEnrollDescriptor] = useState(null);
  const enrollStreamRef = useRef(null);  // use ref to avoid stale closures
  const enrollVideoRef = useRef(null);
  const [enrollBusy, setEnrollBusy] = useState(false);

  // Manual Attendance Modal
  const [manualModal, setManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    employee_id: '',
    attendance_date: today,
    status: 'present',
    check_in: '09:00',
    check_out: '18:00',
    notes: 'Manual entry'
  });

  // Snapshot Preview Modal
  const [snapshotPreview, setSnapshotPreview] = useState(null);

  // Initial load
  async function loadData() {
    setLoading(true);
    try {
      const [empData, enrolledData, attData, todayData] = await Promise.all([
        api('/employees?limit=200').catch(() => []),
        api('/employees/enrolled-faces').catch(() => []),
        api('/attendance?limit=200').catch(() => []),
        api(`/attendance/today?date=${today}`).catch(() => [])
      ]);
      setEmployees(empData || []);
      setEnrolledFaces(enrolledData || []);
      setAttendanceLogs(attData || []);
      setTodayAttendance(todayData || []);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Camera handling for Kiosk
  async function startCamera() {
    setCameraError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(err => {
          if (err.name !== 'AbortError') console.error('Video play error:', err);
        });
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError('Unable to access webcam. Please check camera permissions in your browser.');
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setMatchResult(null);
  }

  // Start/stop kiosk camera when tab changes
  useEffect(() => {
    if (tab === 'kiosk') {
      startCamera();
    } else {
      stopCamera();
    }
    // cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [tab]);

  // Handle Face Scan in Kiosk
  async function performScan() {
    if (!videoRef.current || !cameraActive || scanning) return;
    setScanning(true);
    try {
      const { descriptor, photoDataUrl } = extractFaceDescriptor(videoRef.current);
      const match = findBestMatch(descriptor, enrolledFaces, 0.68);

      if (match?.isMatch) {
        const emp = match.employee;
        // Check if already checked in today
        const existingRecord = todayAttendance.find(a => String(a.employee_id) === String(emp.id));
        const autoAction = existingRecord && existingRecord.check_in && !existingRecord.check_out ? 'check_out' : 'check_in';
        
        setMatchResult({
          ...match,
          liveSnapshot: photoDataUrl,
          suggestedAction: autoAction,
          existingRecord
        });
        playChime(true);
      } else {
        setMatchResult({
          isMatch: false,
          confidencePct: match?.confidencePct || 0,
          liveSnapshot: photoDataUrl
        });
        playChime(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  }

  // Periodic Auto-Scan loop
  useEffect(() => {
    let interval = null;
    if (autoScan && cameraActive && tab === 'kiosk') {
      interval = setInterval(() => {
        if (!scanning && !submitting && !matchResult?.isMatch) {
          performScan();
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoScan, cameraActive, tab, scanning, submitting, matchResult]);

  // Submit attendance from Face Scan
  async function confirmFaceAttendance(actionType = scanMode) {
    if (!matchResult?.employee) return;
    setSubmitting(true);
    setError('');
    const nowTime = new Date().toTimeString().slice(0, 5); // HH:MM
    const emp = matchResult.employee;

    const payload = {
      employee_id: emp.id,
      attendance_date: today,
      status: 'present',
      verification_type: 'face_recognition',
      face_snapshot: matchResult.liveSnapshot,
      notes: `Face verified (${matchResult.confidencePct}% match at ${fmtTime(nowTime)})`
    };

    if (actionType === 'check_in') {
      payload.check_in = nowTime;
    } else {
      payload.check_out = nowTime;
    }

    try {
      await api('/attendance', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      playChime(true);
      setSuccessNotice(`Attendance marked for ${emp.full_name} (${actionType === 'check_in' ? 'Checked In' : 'Checked Out'} at ${fmtTime(nowTime)})`);
      setMatchResult(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to record attendance');
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-submit if autoScan is enabled and high confidence match
  useEffect(() => {
    if (autoScan && matchResult?.isMatch && matchResult?.confidencePct >= 80 && !submitting) {
      const timer = setTimeout(() => {
        confirmFaceAttendance(matchResult.suggestedAction || scanMode);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [matchResult, autoScan]);

  // Face Enrollment Camera Helpers
  async function startEnrollCamera() {
    try {
      if (enrollStreamRef.current) {
        enrollStreamRef.current.getTracks().forEach(t => t.stop());
        enrollStreamRef.current = null;
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: 'user' }
      });
      enrollStreamRef.current = s;
      if (enrollVideoRef.current) {
        enrollVideoRef.current.srcObject = s;
        enrollVideoRef.current.play().catch(err => {
          if (err.name !== 'AbortError') console.error('Enroll video play error:', err);
        });
      }
    } catch (e) {
      setError('Unable to open camera for face enrollment.');
    }
  }

  function stopEnrollCamera() {
    if (enrollStreamRef.current) {
      enrollStreamRef.current.getTracks().forEach(t => t.stop());
      enrollStreamRef.current = null;
    }
    if (enrollVideoRef.current) {
      enrollVideoRef.current.srcObject = null;
    }
  }

  // Auto-start enrollment camera AFTER the modal finishes rendering
  useEffect(() => {
    if (enrollModal) {
      // Small delay ensures the <video> element is in the DOM
      const timer = setTimeout(() => startEnrollCamera(), 100);
      return () => clearTimeout(timer);
    } else {
      stopEnrollCamera();
      setEnrollPhoto(null);
      setEnrollDescriptor(null);
    }
  }, [enrollModal]);

  function snapEnrollPhoto() {
    if (!enrollVideoRef.current) return;
    try {
      const { descriptor, photoDataUrl } = extractFaceDescriptor(enrollVideoRef.current);
      setEnrollPhoto(photoDataUrl);
      setEnrollDescriptor(descriptor);
      stopEnrollCamera();
    } catch (e) {
      setError('Failed to extract face features. Please try again.');
    }
  }

  async function saveFaceEnrollment() {
    if (!enrollEmpId || !enrollPhoto || !enrollDescriptor) {
      setError('Select an employee and capture their face photo.');
      return;
    }
    setEnrollBusy(true);
    setError('');
    try {
      await api(`/employees/${enrollEmpId}/face`, {
        method: 'POST',
        body: JSON.stringify({
          face_photo: enrollPhoto,
          face_descriptor: enrollDescriptor
        })
      });
      setSuccessNotice('Face enrolled successfully!');
      setEnrollModal(false);
      setEnrollPhoto(null);
      setEnrollDescriptor(null);
      setEnrollEmpId('');
      await loadData();
    } catch (e) {
      setError(e.message || 'Face enrollment failed');
    } finally {
      setEnrollBusy(false);
    }
  }

  async function removeEnrollment(empId) {
    if (!window.confirm('Are you sure you want to remove face biometric data for this employee?')) return;
    try {
      await api(`/employees/${empId}/face`, { method: 'DELETE' });
      setSuccessNotice('Face biometric record removed.');
      await loadData();
    } catch (e) {
      setError(e.message || 'Failed to remove face enrollment');
    }
  }

  // Manual Attendance submission
  async function submitManualAttendance(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/attendance', {
        method: 'POST',
        body: JSON.stringify({
          ...manualForm,
          employee_id: Number(manualForm.employee_id),
          verification_type: 'manual'
        })
      });
      setSuccessNotice('Manual attendance recorded successfully.');
      setManualModal(false);
      setManualForm({
        employee_id: '',
        attendance_date: today,
        status: 'present',
        check_in: '09:00',
        check_out: '18:00',
        notes: 'Manual entry'
      });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to save attendance');
    }
  }

  const presentCount = todayAttendance.filter(a => a.status === 'present').length;
  const faceVerifiedCount = todayAttendance.filter(a => a.verification_type === 'face_recognition').length;
  const fingerprintVerifiedCount = todayAttendance.filter(a => a.verification_type === 'fingerprint').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <VMLogo size={52} />
          <div>
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs tracking-wider uppercase">
              <ScanFace size={15} /> Biometric AI & Fingerprint Attendance · Rly. Kodur
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mt-0.5 text-slate-900">Attendance & Biometrics Hub</h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Automated facial recognition, fingerprint sensor kiosks, and shift verification for VATHAN MINERALS.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setTab('fingerprint')}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition shadow-sm ${
              tab === 'fingerprint' ? 'bg-violet-800 text-white ring-2 ring-violet-400' : 'bg-violet-700 hover:bg-violet-800 text-white'
            }`}
          >
            <Fingerprint size={16} /> Fingerprint Kiosk
          </button>
          <button 
            onClick={() => setEnrollModal(true)}
            className="bg-cyan-800 hover:bg-cyan-900 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition"
          >
            <Camera size={16} /> Enroll Face
          </button>
          <button 
            onClick={() => setManualModal(true)}
            className="bg-white hover:bg-slate-50 border rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 flex items-center gap-2 transition"
          >
            <Plus size={16} /> Manual Record
          </button>
          <button 
            onClick={loadData} 
            className="bg-white hover:bg-slate-50 border rounded-xl p-2.5 text-slate-600 transition"
            title="Refresh records"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      {/* Notification Banners */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}
      {successNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl text-sm flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /> {successNotice}</span>
          <button onClick={() => setSuccessNotice('')}><X size={16} /></button>
        </div>
      )}

      {/* Stats Quick Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Today's Present</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{presentCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{todayAttendance.length} records today</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Face Verified</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{faceVerifiedCount}</p>
          <p className="text-[11px] text-emerald-700/70 mt-0.5">Camera check-ins</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Fingerprint Scans</p>
          <p className="text-2xl font-bold text-violet-700 mt-1">{fingerprintVerifiedCount}</p>
          <p className="text-[11px] text-violet-700/70 mt-0.5">Sensor punches</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Enrolled Faces</p>
          <p className="text-2xl font-bold text-cyan-800 mt-1">{enrolledFaces.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Of {employees.length} active staff</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500 font-medium">Scanner Status</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-3 h-3 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
            <span className="text-sm font-semibold text-slate-800">{cameraActive ? 'Live Camera' : 'Standby'}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{autoScan ? 'Auto-scan enabled' : 'Ready for sensor'}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setTab('kiosk'); if (!cameraActive) startCamera(); }}
          className={`px-5 py-3 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
            tab === 'kiosk' ? 'border-cyan-800 text-cyan-900 bg-cyan-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ScanFace size={18} /> Face Recognition Kiosk
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-5 py-3 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
            tab === 'logs' ? 'border-cyan-800 text-cyan-900 bg-cyan-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={18} /> Attendance Records ({attendanceLogs.length})
        </button>
        <button
          onClick={() => setTab('enrolled')}
          className={`px-5 py-3 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
            tab === 'enrolled' ? 'border-cyan-800 text-cyan-900 bg-cyan-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={18} /> Enrolled Staff ({enrolledFaces.length})
        </button>
        <button
          onClick={() => setTab('fingerprint')}
          className={`px-5 py-3 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
            tab === 'fingerprint' ? 'border-violet-700 text-violet-900 bg-violet-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Fingerprint size={18} /> Fingerprint Sensor
        </button>
      </div>

      {/* TAB 4: FINGERPRINT SENSOR */}
      {tab === 'fingerprint' && (
        <FingerprintTab user={user} />
      )}

      {/* TAB 1: FACE SCANNER KIOSK */}
      {tab === 'kiosk' && (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Live Scanner Stream */}
          <div className="lg:col-span-7 bg-slate-950 rounded-3xl p-5 text-white shadow-xl overflow-hidden relative">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${cameraActive ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`}></span>
                <span className="text-sm font-semibold tracking-wide">
                  {cameraActive ? 'LIVE WEBCAM SCANNER' : 'CAMERA OFF'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoScan(!autoScan)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    autoScan ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                >
                  {autoScan ? 'Auto-Scan ON' : 'Auto-Scan OFF'}
                </button>
                {cameraActive ? (
                  <button onClick={stopCamera} className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <VideoOff size={14} /> Stop
                  </button>
                ) : (
                  <button onClick={startCamera} className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold">
                    <Video size={14} /> Start Camera
                  </button>
                )}
              </div>
            </div>

            {/* Video Viewport Container */}
            <div className="relative aspect-[4/3] w-full bg-slate-900 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />
              {!cameraActive && (
                <div className="text-center p-6">
                  <Camera size={48} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400 font-medium text-sm">Camera is inactive</p>
                  <p className="text-slate-500 text-xs mt-1">Click "Start Camera" to begin face recognition check-in.</p>
                  <button onClick={startCamera} className="mt-4 bg-cyan-600 text-white rounded-xl px-4 py-2 text-sm font-semibold">
                    Turn On Webcam
                  </button>
                </div>
              )}

              {/* Biometric HUD Reticle Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Outer corner target brackets */}
                  <div className="relative w-56 h-72 border-2 border-cyan-400/40 rounded-3xl flex flex-col justify-between p-2 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                    <div className="flex justify-between">
                      <span className="w-5 h-5 border-t-2 border-l-2 border-cyan-400 -mt-1 -ml-1"></span>
                      <span className="w-5 h-5 border-t-2 border-r-2 border-cyan-400 -mt-1 -mr-1"></span>
                    </div>

                    {/* Animated Scanning Beam */}
                    {scanning && (
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-bounce"></div>
                    )}

                    {/* Center facial oval guide */}
                    <div className="absolute inset-4 border border-dashed border-cyan-300/30 rounded-full flex items-center justify-center">
                      <div className="text-[10px] text-cyan-300/60 uppercase tracking-widest font-mono">Face Align</div>
                    </div>

                    <div className="flex justify-between">
                      <span className="w-5 h-5 border-b-2 border-l-2 border-cyan-400 -mb-1 -ml-1"></span>
                      <span className="w-5 h-5 border-b-2 border-r-2 border-cyan-400 -mb-1 -mr-1"></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode Watermark */}
              {cameraActive && (
                <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur px-3 py-1 rounded-full text-[11px] font-mono text-cyan-300 flex items-center gap-1.5 border border-cyan-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  MODE: {scanMode.toUpperCase().replace('_', ' ')}
                </div>
              )}
            </div>

            {/* Kiosk Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex bg-slate-900 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setScanMode('check_in')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                    scanMode === 'check_in' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Check In Shift
                </button>
                <button
                  onClick={() => setScanMode('check_out')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                    scanMode === 'check_out' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Check Out Shift
                </button>
              </div>

              <button
                disabled={!cameraActive || scanning}
                onClick={performScan}
                className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg disabled:opacity-50 transition"
              >
                <ScanFace size={18} /> {scanning ? 'Analyzing Face…' : 'Scan & Identify Face'}
              </button>
            </div>
          </div>

          {/* Verification Results Panel */}
          <div className="lg:col-span-5 space-y-4">
            {matchResult?.isMatch ? (
              <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 shadow-xl animate-scale-up">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    IDENTITY CONFIRMED
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">
                    {matchResult.confidencePct}% Confidence
                  </span>
                </div>

                <div className="mt-5 flex gap-4 items-center">
                  <div className="relative">
                    <img 
                      src={matchResult.employee.face_photo || matchResult.liveSnapshot} 
                      alt="Employee"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-400 shadow-sm"
                    />
                    <span className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-1 rounded-full shadow">
                      <ShieldCheck size={14} />
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-cyan-800 uppercase tracking-wide bg-cyan-50 px-2 py-0.5 rounded-md">
                      {matchResult.employee.employee_code}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">{matchResult.employee.full_name}</h3>
                    <p className="text-xs text-slate-500">{matchResult.employee.job_title || 'Plant Team Member'}</p>
                  </div>
                </div>

                {/* Today's status alert */}
                <div className="mt-4 bg-slate-50 border rounded-xl p-3 text-xs text-slate-600 flex justify-between">
                  <span>Today's Status:</span>
                  <span className="font-semibold text-slate-900">
                    {matchResult.existingRecord ? (
                      `Checked in at ${fmtTime(matchResult.existingRecord.check_in)}`
                    ) : (
                      'Not checked in yet today'
                    )}
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <button
                    disabled={submitting}
                    onClick={() => confirmFaceAttendance(matchResult.suggestedAction || scanMode)}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <UserCheck size={18} />
                    {submitting 
                      ? 'Logging Record…' 
                      : `Log ${matchResult.suggestedAction === 'check_out' ? 'Check Out' : 'Check In'} Now`}
                  </button>
                  <button
                    onClick={() => setMatchResult(null)}
                    className="w-full text-slate-500 hover:text-slate-800 py-2 text-xs font-medium"
                  >
                    Cancel / Scan Another
                  </button>
                </div>
              </div>
            ) : matchResult && !matchResult.isMatch ? (
              <div className="bg-white border-2 border-amber-300 rounded-3xl p-6 shadow-md">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-3">
                  <AlertCircle size={20} />
                  NO MATCH FOUND
                </div>
                <p className="text-sm text-slate-600">
                  The face in front of the camera did not match any enrolled staff member with sufficient confidence (Highest match: {matchResult.confidencePct}%).
                </p>
                <div className="mt-4 flex gap-3">
                  {matchResult.liveSnapshot && (
                    <img src={matchResult.liveSnapshot} alt="Snapshot" className="w-16 h-16 rounded-xl object-cover border" />
                  )}
                  <div className="text-xs text-slate-500 flex-1">
                    <p className="font-semibold text-slate-700">Suggestions:</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>Center your face inside the target oval</li>
                      <li>Ensure adequate front lighting</li>
                      <li>Enroll the employee's face if not registered</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button 
                    onClick={performScan} 
                    className="flex-1 bg-cyan-800 text-white py-2 rounded-xl text-xs font-bold"
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={() => setEnrollModal(true)}
                    className="border border-slate-300 py-2 px-3 rounded-xl text-xs font-bold text-slate-700"
                  >
                    Enroll Face
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="p-2.5 rounded-2xl bg-cyan-50 text-cyan-800">
                    <Sparkles size={22} />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900">How Face Attendance Works</h3>
                    <p className="text-xs text-slate-500">Fast, touchless biometric attendance</p>
                  </div>
                </div>
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-800 font-bold grid place-items-center flex-shrink-0">1</span>
                    <p>Stand naturally in front of the camera and align your face inside the green guide.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-800 font-bold grid place-items-center flex-shrink-0">2</span>
                    <p>Click <strong>Scan & Identify Face</strong> or toggle <strong>Auto-Scan</strong> for walk-by check-in.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-800 font-bold grid place-items-center flex-shrink-0">3</span>
                    <p>Once verified, click confirm or let auto-scan mark your shift with biometric proof.</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t flex items-center justify-between text-xs text-slate-500">
                  <span>Enrolled team members:</span>
                  <span className="font-bold text-slate-800">{enrolledFaces.length} of {employees.length}</span>
                </div>
              </div>
            )}

            {/* Today's Recent Scans */}
            <div className="bg-white border rounded-3xl p-5 shadow-sm">
              <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center justify-between">
                <span>Today's Check-Ins</span>
                <span className="text-xs font-normal text-slate-500">{todayAttendance.length} recorded</span>
              </h4>
              {todayAttendance.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No attendance logged yet today.</p>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {todayAttendance.slice(0, 6).map(att => (
                    <div key={att.id} className="flex items-center justify-between p-2 rounded-xl border bg-slate-50/50 text-xs">
                      <div className="flex items-center gap-2.5">
                        {att.face_snapshot ? (
                          <img src={att.face_snapshot} alt="Face" className="w-8 h-8 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-900 font-bold grid place-items-center text-xs">
                            {att.full_name?.slice(0, 1) || 'E'}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900 truncate max-w-[120px]">{att.full_name}</p>
                          <p className="text-[10px] text-slate-400">{att.employee_code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-800">{fmtTime(att.check_in)}</span>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          {att.verification_type === 'face_recognition' ? (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">Face</span>
                          ) : (
                            <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">Manual</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE RECORDS TABLE */}
      {tab === 'logs' && (
        <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Attendance Shift Logs</h3>
              <p className="text-xs text-slate-500 mt-0.5">Showing recent employee attendance with biometric verification proofs.</p>
            </div>
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
              {attendanceLogs.length} Records
            </span>
          </div>

          {attendanceLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Calendar size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="font-semibold">No attendance records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Check In</th>
                    <th className="px-5 py-3.5">Check Out</th>
                    <th className="px-5 py-3.5">Verification</th>
                    <th className="px-5 py-3.5">Proof</th>
                    <th className="px-5 py-3.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceLogs.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{row.full_name || `Employee #${row.employee_id}`}</div>
                        <div className="text-xs text-slate-400">{row.employee_code || `ID: ${row.employee_id}`}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-700 font-medium">
                        {row.attendance_date}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                          row.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                          row.status === 'half_day' ? 'bg-amber-100 text-amber-800' :
                          row.status === 'leave' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {row.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono font-semibold text-slate-800">
                        {fmtTime(row.check_in)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono font-semibold text-slate-800">
                        {fmtTime(row.check_out)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {row.verification_type === 'face_recognition' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <ShieldCheck size={14} className="text-emerald-600" /> Face Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {row.face_snapshot ? (
                          <button
                            onClick={() => setSnapshotPreview(row.face_snapshot)}
                            className="relative group block"
                            title="View biometric photo snapshot"
                          >
                            <img src={row.face_snapshot} alt="Face Snapshot" className="w-9 h-9 rounded-lg object-cover border-2 border-emerald-400 group-hover:scale-105 transition" />
                            <span className="absolute inset-0 bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                              <Eye size={12} />
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 max-w-xs truncate">
                        {row.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ENROLLED EMPLOYEES GRID */}
      {tab === 'enrolled' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white border rounded-2xl p-5">
            <div>
              <h3 className="font-bold text-slate-900">Enrolled Face Biometrics</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Staff members registered for automated camera identification.
              </p>
            </div>
            <button
              onClick={() => setEnrollModal(true)}
              className="bg-cyan-800 hover:bg-cyan-900 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2"
            >
              <Plus size={16} /> Enroll New Face
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {employees.map(emp => {
              const enrolled = enrolledFaces.find(e => e.id === emp.id);
              return (
                <div key={emp.id} className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div className="flex items-start gap-3">
                    {enrolled?.face_photo ? (
                      <img 
                        src={enrolled.face_photo} 
                        alt={emp.full_name} 
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-cyan-700 shadow-sm"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center border border-dashed">
                        <User size={24} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wide bg-cyan-50 px-2 py-0.5 rounded">
                        {emp.employee_code}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1 truncate">{emp.full_name}</h4>
                      <p className="text-xs text-slate-400 truncate">{emp.job_title || 'Employee'}</p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t flex items-center justify-between">
                    {enrolled ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                          <CheckCircle2 size={13} /> Face Registered
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEnrollEmpId(String(emp.id)); setEnrollModal(true); }}
                            className="text-xs text-cyan-800 hover:underline font-semibold"
                          >
                            Re-enroll
                          </button>
                          <button
                            onClick={() => removeEnrollment(emp.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded"
                            title="Remove face data"
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
                          Enroll Face
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ENROLLMENT MODAL */}
      {enrollModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Camera size={18} className="text-cyan-800" /> Enroll Employee Face
              </h3>
              <button onClick={() => setEnrollModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Employee</label>
                <select
                  value={enrollEmpId}
                  onChange={e => setEnrollEmpId(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">Choose an employee...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.employee_code} — {e.full_name} ({e.job_title || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera or Photo Preview */}
              <div className="aspect-square w-full bg-slate-950 rounded-2xl overflow-hidden relative border flex items-center justify-center">
                {enrollPhoto ? (
                  <div className="relative w-full h-full">
                    <img src={enrollPhoto} alt="Captured" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setEnrollPhoto(null); setEnrollDescriptor(null); startEnrollCamera(); }}
                      className="absolute bottom-3 right-3 bg-slate-900/80 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur"
                    >
                      Retake Photo
                    </button>
                  </div>
                ) : (
                  <>
                    <video ref={enrollVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-60 border-2 border-cyan-400 rounded-3xl border-dashed"></div>
                    </div>
                  </>
                )}
              </div>

              {!enrollPhoto && (
                <button
                  type="button"
                  onClick={snapEnrollPhoto}
                  className="w-full bg-cyan-800 hover:bg-cyan-700 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  <Camera size={18} /> Capture Face Snapshot
                </button>
              )}

              {enrollPhoto && (
                <button
                  type="button"
                  disabled={enrollBusy || !enrollEmpId}
                  onClick={saveFaceEnrollment}
                  className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 size={18} /> {enrollBusy ? 'Saving Biometrics…' : 'Save & Register Face'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MANUAL RECORD MODAL */}
      {manualModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitManualAttendance} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <h3 className="font-bold text-lg text-slate-900">Manual Attendance Entry</h3>
              <button type="button" onClick={() => setManualModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employee</label>
                <select
                  required
                  value={manualForm.employee_id}
                  onChange={e => setManualForm(p => ({ ...p, employee_id: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 bg-white"
                >
                  <option value="">Select Employee...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={manualForm.attendance_date}
                    onChange={e => setManualForm(p => ({ ...p, attendance_date: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={manualForm.status}
                    onChange={e => setManualForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="present">Present</option>
                    <option value="half_day">Half Day</option>
                    <option value="leave">Leave</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Check In</label>
                  <input
                    type="time"
                    value={manualForm.check_in}
                    onChange={e => setManualForm(p => ({ ...p, check_in: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Check Out</label>
                  <input
                    type="time"
                    value={manualForm.check_out}
                    onChange={e => setManualForm(p => ({ ...p, check_out: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={manualForm.notes}
                  onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="Optional remarks"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualModal(false)}
                  className="px-4 py-2 border rounded-xl text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-800 text-white font-bold rounded-xl"
                >
                  Save Record
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* SNAPSHOT VIEWER MODAL */}
      {snapshotPreview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSnapshotPreview(null)}>
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-3 flex items-center justify-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" /> Biometric Check-In Snapshot
            </h3>
            <img src={snapshotPreview} alt="Snapshot" className="w-full aspect-square object-cover rounded-2xl border" />
            <p className="text-xs text-slate-400 mt-2">Captured live at check-in time.</p>
            <button
              onClick={() => setSnapshotPreview(null)}
              className="mt-4 w-full bg-slate-950 text-white font-bold py-2.5 rounded-xl text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
