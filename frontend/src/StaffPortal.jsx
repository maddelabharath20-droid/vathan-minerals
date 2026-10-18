import React, { useState, useEffect } from 'react';
import { api } from './api';
import VMLogo from './VMLogo';
import { 
  Calendar, Clock, DollarSign, FileText, CheckCircle2, XCircle, 
  AlertCircle, Plus, RefreshCw, Printer, User, LogOut, ArrowRight,
  TrendingUp, Sparkles, Send, ShieldCheck, Lock, Fingerprint, Loader2, Smartphone, ScanFace
} from 'lucide-react';
import AttendanceManager from './AttendanceManager';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

function playBiometricChime(success) {
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
  } catch (_) {}
}

export default function StaffPortal({ user, onLogout }) {
  const isProp = Boolean(
    user?.role === 'admin' ||
    (user?.name && user.name.toLowerCase().includes('subbaiah')) ||
    (user?.email && (user.email.toLowerCase().includes('subbaiah') || user.email.includes('vathanminerals6336') || user.email.includes('owner.proprietor')))
  );
  const isManager = Boolean(
    isProp ||
    user?.role === 'manager' ||
    user?.role === 'admin' ||
    ['009', '010', 'B-001', '002', '005'].includes(user?.employee_code) ||
    user?.job_title?.toLowerCase().includes('manager') ||
    user?.job_title?.toLowerCase().includes('supervisor') ||
    user?.job_title?.toLowerCase().includes('incharge') ||
    user?.job_title?.toLowerCase().includes('officer')
  );
  const displayName = isProp ? 'MADDELA VENKATA SUBBAIAH' : user.name;
  const [activeTab, setActiveTab] = useState('overview'); // overview, attendance, leaves, salary, kiosk
  const [attendanceData, setAttendanceData] = useState({ stats: {}, history: [] });
  const [leaves, setLeaves] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fingerprint Biometric Attendance states
  const [fpStatus, setFpStatus] = useState({ enrolled: false, count: 0, loading: true });
  const [fpPunching, setFpPunching] = useState(false);
  const [fpEnrolling, setFpEnrolling] = useState(false);
  const [fpMessage, setFpMessage] = useState('');
  const [fpError, setFpError] = useState('');

  // Leave application modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveType, setLeaveType] = useState('casual');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState('');
  const [leaveErrorMsg, setLeaveErrorMsg] = useState('');

  // Payslip modal
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 4) {
      setPwError('Password must be at least 4 characters');
      return;
    }
    setUpdatingPassword(true);
    setPwError('');
    setPwSuccess('');
    try {
      await api('/staff/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: newPassword.trim() })
      });
      setPwSuccess('Password successfully updated! Keep it private.');
      setNewPassword('');
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err) {
      setPwError(err.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function checkFpStatus() {
    try {
      const res = await api('/webauthn/my-status');
      setFpStatus({ enrolled: !!res?.enrolled, count: res?.count || 0, loading: false });
    } catch {
      setFpStatus({ enrolled: false, count: 0, loading: false });
    }
  }

  async function handleEnrollFingerprint() {
    setFpEnrolling(true);
    setFpError('');
    setFpMessage('');
    try {
      if (typeof window !== 'undefined' && !window.PublicKeyCredential) {
        throw new Error('Biometric sensor is not supported on this browser. Please open in Google Chrome, Microsoft Edge, Safari, or an Android/iOS device with biometrics enabled.');
      }
      const opts = await api('/webauthn/register-options', {
        method: 'POST',
        body: JSON.stringify({ employee_id: user.employee_id })
      });
      const regResponse = await startRegistration({ optionsJSON: opts });
      await api('/webauthn/register-verify', {
        method: 'POST',
        body: JSON.stringify({ employee_id: user.employee_id, registration: regResponse })
      });
      playBiometricChime(true);
      setFpMessage('Fingerprint successfully enrolled on this device! You can now clock in with 1 touch.');
      setFpStatus({ enrolled: true, count: 1, loading: false });
      await loadStaffData();
    } catch (err) {
      playBiometricChime(false);
      let msg = err.message || 'Failed to enroll fingerprint.';
      if (err.name === 'NotAllowedError') msg = 'Fingerprint scan was cancelled or timed out. Please try again.';
      if (err.name === 'InvalidStateError') msg = 'This fingerprint or device is already enrolled.';
      setFpError(msg);
    } finally {
      setFpEnrolling(false);
    }
  }

  async function handleFingerprintPunch() {
    setFpPunching(true);
    setFpError('');
    setFpMessage('');
    try {
      if (typeof window !== 'undefined' && !window.PublicKeyCredential) {
        throw new Error('Biometric sensor is not supported on this browser. Please open in Google Chrome, Edge, Safari, or an Android/iOS browser.');
      }
      const todayStr = new Date().toISOString().slice(0, 10);
      const opts = await api('/webauthn/auth-options', {
        method: 'POST',
        body: JSON.stringify({ employee_id: user.employee_id })
      });
      const authResponse = await startAuthentication({ optionsJSON: opts });
      const res = await api('/webauthn/auth-verify', {
        method: 'POST',
        body: JSON.stringify({
          authResponse,
          date: todayStr,
          employee_id: user.employee_id
        })
      });
      playBiometricChime(true);
      setFpMessage(res.message || 'Attendance verified successfully via Fingerprint!');
      await loadStaffData();
    } catch (err) {
      playBiometricChime(false);
      let msg = err.message || 'Fingerprint verification failed.';
      if (err.name === 'NotAllowedError') msg = 'Fingerprint scan was cancelled or not recognized. Please touch your sensor again.';
      if (err.name === 'InvalidStateError') msg = 'No enrolled fingerprint recognized on this device. Please tap "Enroll Fingerprint" below.';
      setFpError(msg);
    } finally {
      setFpPunching(false);
    }
  }

  async function loadStaffData() {
    try {
      setRefreshing(true);
      const [att, lvs, sals] = await Promise.all([
        api('/staff/my-attendance').catch(() => ({ stats: {}, history: [] })),
        api('/leave-requests').catch(() => []),
        api('/salaries').catch(() => [])
      ]);
      setAttendanceData(att);
      setLeaves(lvs);
      setSalaries(sals);
      await checkFpStatus();
    } catch (err) {
      console.error('Error loading staff portal data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStaffData();
  }, []);

  async function handleApplyLeave(e) {
    e.preventDefault();
    setSubmittingLeave(true);
    setLeaveErrorMsg('');
    setLeaveSuccessMsg('');

    try {
      const res = await api('/leave-requests', {
        method: 'POST',
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason
        })
      });
      setLeaveSuccessMsg(res.message || 'Leave request submitted successfully!');
      setReason('');
      // Reload leaves
      const updatedLeaves = await api('/leave-requests');
      setLeaves(updatedLeaves);
      setTimeout(() => {
        setShowApplyModal(false);
        setLeaveSuccessMsg('');
      }, 1500);
    } catch (err) {
      setLeaveErrorMsg(err.message || 'Failed to submit leave application');
    } finally {
      setSubmittingLeave(false);
    }
  }

  const currentMonthSalary = salaries[0] || null;
  const stats = attendanceData.stats || {};

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Header */}
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VMLogo size={38} showText={true} textVariant="light" />
            <span className="hidden sm:inline-block bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
              Staff Self-Service Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadStaffData}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 transition"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                {user.name?.charAt(0) || 'S'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold leading-tight">{displayName}</p>
                <p className="text-[10px] text-emerald-400 font-semibold">
                  {isProp ? 'Proprietor & Admin (Prop Account)' : isManager ? 'Operations Manager (Attendance Officer)' : (user.job_title || 'Staff Specialist')} · {user.employee_code || 'PROP'}
                </p>
              </div>
            </div>

            <button
              onClick={() => { setShowPasswordModal(true); setPwSuccess(''); setPwError(''); }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center gap-1.5 transition ml-2"
              title="Change your private password"
            >
              <Lock size={13} />
              <span className="hidden sm:inline">Password</span>
            </button>

            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-bold border border-red-500/30 flex items-center gap-1.5 transition ml-1"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Staff Welcome Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Employee Code: {user.employee_code || 'EMP-VM'}
                </span>
                <span className="text-xs text-slate-400">· VATHAN MINERALS Hub</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                Namaste, {displayName} 👋
              </h1>
              <p className="text-slate-300 text-sm mt-1 max-w-xl">
                Designation: <span className="font-semibold text-white">{isProp ? 'Proprietor & Admin (Prop Account)' : isManager ? 'Operations Manager (Attendance Officer)' : (user.job_title || 'Plant Team Specialist')}</span>. Check your daily attendance records, leave approval status, and monthly salary disbursements.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {isManager && (
                <button
                  onClick={() => setActiveTab('kiosk')}
                  className="bg-cyan-700 hover:bg-cyan-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-lg transition flex items-center gap-2 text-sm border border-cyan-400/30"
                >
                  <ScanFace size={16} /> Take Worker Attendance (Kiosk)
                </button>
              )}
              <button
                onClick={() => setShowApplyModal(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-lg transition flex items-center gap-2 text-sm"
              >
                <Plus size={16} /> Apply for Leave
              </button>
              <button
                onClick={() => setActiveTab('salary')}
                className="bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2.5 rounded-2xl border border-white/15 transition flex items-center gap-2 text-sm"
              >
                <DollarSign size={16} /> View Salaries Status
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200 mb-6 overflow-x-auto text-sm font-semibold gap-1">
          {isManager && (
            <button
              onClick={() => setActiveTab('kiosk')}
              className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'kiosk' 
                  ? 'bg-slate-900 text-cyan-300 shadow-sm border border-cyan-500/40 font-bold' 
                  : 'text-cyan-900 bg-cyan-50/80 hover:bg-cyan-100/90 border border-cyan-200/80'
              }`}
            >
              <ScanFace size={16} className={activeTab === 'kiosk' ? 'text-cyan-300' : 'text-cyan-700'} />
              <span>Take Worker Attendance</span>
              <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-full uppercase tracking-wider">Manager</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-2.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overview' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp size={16} /> Overview
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-5 py-2.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'attendance' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar size={16} /> My Attendance
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-5 py-2.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'leaves' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={16} /> Leave Status ({leaves.length})
          </button>
          <button
            onClick={() => setActiveTab('salary')}
            className={`px-5 py-2.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'salary' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign size={16} /> Salary & Payslips
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-emerald-600 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Days Present (This Month)</span>
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-3xl font-extrabold text-slate-900">{stats.present_days || 0} <span className="text-sm font-semibold text-slate-500">Days</span></p>
                <p className="text-xs text-emerald-600 font-semibold mt-1">Verified on Face/Fingerprint Kiosk</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-blue-600 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Approved Leaves</span>
                  <Calendar size={20} />
                </div>
                <p className="text-3xl font-extrabold text-slate-900">{stats.leave_days || 0} <span className="text-sm font-semibold text-slate-500">Days</span></p>
                <p className="text-xs text-slate-500 mt-1">Total approved off-duty</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-amber-600 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Leave Approvals</span>
                  <Clock size={20} />
                </div>
                <p className="text-3xl font-extrabold text-slate-900">
                  {leaves.filter(l => l.status === 'pending').length} <span className="text-sm font-semibold text-slate-500">Requests</span>
                </p>
                <p className="text-xs text-amber-600 font-semibold mt-1">Awaiting Manager Review</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-purple-600 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Salary Status ({currentMonthSalary?.month_year || 'Latest'})</span>
                  <DollarSign size={20} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-900">
                    ₹{Number(currentMonthSalary?.net_salary || 0).toLocaleString('en-IN')}
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    currentMonthSalary?.payment_status === 'paid' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {currentMonthSalary?.payment_status || 'Pending'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Net payable via Bank Transfer</p>
              </div>
            </div>

            {/* 1-Tap Fingerprint Biometric Attendance Hub */}
            <div className="bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-violet-800/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-violet-500/20 text-violet-300 text-xs font-bold px-3 py-1 rounded-full border border-violet-500/30 flex items-center gap-1.5">
                      <Fingerprint size={14} className="text-violet-300" />
                      <span>Fingerprint Biometrics</span>
                    </span>
                    {fpStatus.enrolled ? (
                      <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                        <ShieldCheck size={13} />
                        <span>Sensor Enrolled & Active</span>
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1.5">
                        <Smartphone size={13} />
                        <span>Sensor Not Enrolled</span>
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                    <span>Touch Sensor Attendance</span>
                  </h2>

                  <p className="text-violet-200/80 text-xs sm:text-sm max-w-xl">
                    Clock in and out instantly using your mobile fingerprint scanner, Touch ID, or plant biometric reader.
                  </p>

                  {/* Today's Punch Status indicator */}
                  {(() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const todayRec = attendanceData.history?.find(h => h.attendance_date === todayStr);
                    if (todayRec?.check_in && !todayRec?.check_out) {
                      return (
                        <div className="inline-flex items-center gap-2 text-xs font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-500/30 mt-2">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                          <span>Currently Checked In at {todayRec.check_in} (Ready for Clock Out)</span>
                        </div>
                      );
                    } else if (todayRec?.check_in && todayRec?.check_out) {
                      return (
                        <div className="inline-flex items-center gap-2 text-xs font-bold bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-xl border border-blue-500/30 mt-2">
                          <CheckCircle2 size={14} className="text-blue-400" />
                          <span>Today Complete: In {todayRec.check_in} · Out {todayRec.check_out}</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 text-slate-300 px-3 py-1.5 rounded-xl border border-white/10 mt-2">
                          <Clock size={14} className="text-amber-400" />
                          <span>Not checked in today yet</span>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Fingerprint Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={handleFingerprintPunch}
                    disabled={fpPunching}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2.5 text-sm disabled:opacity-60"
                  >
                    {fpPunching ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-violet-200" />
                        <span>Verifying Sensor…</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint size={20} className="text-violet-200" />
                        <span>Touch Fingerprint to Clock In/Out</span>
                      </>
                    )}
                  </button>

                  {!fpStatus.enrolled && (
                    <button
                      onClick={handleEnrollFingerprint}
                      disabled={fpEnrolling}
                      className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3.5 rounded-2xl border border-white/20 transition flex items-center justify-center gap-2 text-xs disabled:opacity-60"
                    >
                      {fpEnrolling ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Enrolling…</span>
                        </>
                      ) : (
                        <>
                          <Plus size={15} />
                          <span>Enroll My Fingerprint</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Status messages */}
              {fpMessage && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>{fpMessage}</span>
                </div>
              )}
              {fpError && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <span>{fpError}</span>
                </div>
              )}
            </div>

            {/* Quick Actions & Recent Leaves Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Attendance Snapshot */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <Calendar size={18} className="text-emerald-600" /> Recent Attendance History
                  </h3>
                  <button onClick={() => setActiveTab('attendance')} className="text-xs font-bold text-cyan-700 hover:underline flex items-center gap-1">
                    View All <ArrowRight size={13} />
                  </button>
                </div>

                {attendanceData.history?.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No attendance logs found yet. Check in on the Face/Fingerprint kiosk.</p>
                ) : (
                  <div className="space-y-2.5">
                    {attendanceData.history.slice(0, 5).map(record => (
                      <div key={record.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{record.attendance_date}</p>
                          <p className="text-slate-500 text-[11px]">
                            In: {record.check_in || '--:--'} · Out: {record.check_out || '--:--'} ({record.verification_type})
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${
                          record.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                          record.status === 'leave' ? 'bg-blue-100 text-blue-800' :
                          record.status === 'half_day' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Leave Requests Status Snapshot */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <Clock size={18} className="text-amber-600" /> My Leave Approval Status
                  </h3>
                  <button onClick={() => setShowApplyModal(true)} className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
                    + Apply Leave
                  </button>
                </div>

                {leaves.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-slate-500 mb-3">You have not submitted any leave applications.</p>
                    <button
                      onClick={() => setShowApplyModal(true)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                    >
                      Apply for First Leave
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaves.slice(0, 4).map(l => (
                      <div key={l.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 capitalize">{l.leave_type} Leave ({l.days_count} days)</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase ${
                            l.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            l.status === 'rejected' ? 'bg-red-100 text-red-800 border border-red-300' :
                            'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                          }`}>
                            {l.status === 'pending' ? '⏳ Pending Review' : l.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">Dates: <strong>{l.start_date}</strong> to <strong>{l.end_date}</strong></p>
                        <p className="text-slate-500 italic text-[11px]">"{l.reason}"</p>
                        {l.review_notes && (
                          <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] text-slate-700 mt-1">
                            <strong>Manager Note:</strong> {l.review_notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: ATTENDANCE CHECK */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Attendance Log & Biometric History</h2>
                <p className="text-xs text-slate-500 mt-0.5">Records clocked through Face Biometric, Fingerprint, or Plant Supervisor.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFingerprintPunch}
                  disabled={fpPunching}
                  className="bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-60"
                  title="Touch your fingerprint sensor to record attendance"
                >
                  <Fingerprint size={14} />
                  <span>{fpPunching ? 'Scanning…' : 'Touch Sensor to Clock In/Out'}</span>
                </button>
                <span className="text-xs font-semibold bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700">
                  Month: {attendanceData.month || new Date().toISOString().slice(0, 7)}
                </span>
              </div>
            </div>

            {/* Attendance Monthly Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-emerald-800 uppercase">Present</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">{stats.present_days || 0}</p>
                <p className="text-[10px] text-emerald-600 font-medium">Days</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-red-800 uppercase">Absent</p>
                <p className="text-2xl font-black text-red-700 mt-1">{stats.absent_days || 0}</p>
                <p className="text-[10px] text-red-600 font-medium">Days</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-blue-800 uppercase">On Leave</p>
                <p className="text-2xl font-black text-blue-700 mt-1">{stats.leave_days || 0}</p>
                <p className="text-[10px] text-blue-600 font-medium">Days</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-amber-800 uppercase">Half-Day</p>
                <p className="text-2xl font-black text-amber-700 mt-1">{stats.half_days || 0}</p>
                <p className="text-[10px] text-amber-600 font-medium">Days</p>
              </div>
            </div>

            {/* Detailed History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-y border-slate-200">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Check In</th>
                    <th className="py-3 px-4">Check Out</th>
                    <th className="py-3 px-4">Verification Type</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {attendanceData.history?.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400">No attendance records found for this period.</td>
                    </tr>
                  ) : (
                    attendanceData.history.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-bold text-slate-800">{row.attendance_date}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            row.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                            row.status === 'leave' ? 'bg-blue-100 text-blue-800' :
                            row.status === 'half_day' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">{row.check_in || '--:--'}</td>
                        <td className="py-3 px-4">{row.check_out || '--:--'}</td>
                        <td className="py-3 px-4 capitalize">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold text-[11px]">
                            {row.verification_type?.replace('_', ' ') || 'Manual'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{row.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: LEAVE APPROVAL STATUS */}
        {activeTab === 'leaves' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Leave Applications & Approval Status</h2>
                <p className="text-xs text-slate-500 mt-0.5">Track your applied leaves, review approvals, and check manager comments.</p>
              </div>
              <button
                onClick={() => setShowApplyModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus size={15} /> Apply for New Leave
              </button>
            </div>

            {leaves.length === 0 ? (
              <div className="text-center py-12">
                <Clock size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-700">No leave requests found</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">You have not submitted any leave applications yet.</p>
                <button
                  onClick={() => setShowApplyModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                >
                  Apply Now
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {leaves.map(l => (
                  <div key={l.id} className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white transition shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm capitalize">{l.leave_type} Leave</span>
                        <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold">
                          {l.days_count} {l.days_count === 1 ? 'day' : 'days'}
                        </span>
                      </div>

                      <div>
                        {l.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                            <Clock size={13} /> Pending Manager Approval
                          </span>
                        )}
                        {l.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-100 border border-emerald-300 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
                            <CheckCircle2 size={13} /> Leave Approved
                          </span>
                        )}
                        {l.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 bg-red-100 border border-red-300 text-red-800 px-3 py-1 rounded-full text-xs font-bold">
                            <XCircle size={13} /> Request Declined
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
                        <span className="font-bold text-slate-800">{l.start_date} to {l.end_date}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Applied On</span>
                        <span className="text-slate-700">{new Date(l.applied_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100 text-xs text-slate-700">
                      <span className="font-bold text-slate-900">Reason: </span>
                      {l.reason}
                    </div>

                    {l.review_notes && (
                      <div className={`p-3 rounded-xl text-xs border ${
                        l.status === 'approved' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-red-50/80 border-red-200 text-red-900'
                      }`}>
                        <div className="flex items-center gap-1.5 font-bold mb-0.5">
                          <ShieldCheck size={14} /> Review Remarks from Management:
                        </div>
                        <p>{l.review_notes}</p>
                        {l.reviewed_at && (
                          <p className="text-[10px] opacity-75 mt-1">Reviewed at: {new Date(l.reviewed_at).toLocaleString()}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: SALARY & PAYSLIP STATUS */}
        {activeTab === 'salary' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Staff Salaries & Payment Status</h2>
                <p className="text-xs text-slate-500 mt-0.5">Official payroll disbursements, allowances, deductions, and bank transfer slips.</p>
              </div>
            </div>

            {salaries.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No salary disbursement records found yet.
              </div>
            ) : (
              <div className="space-y-4">
                {salaries.map(sal => (
                  <div key={sal.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white transition shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Salary Period</span>
                        <h3 className="text-lg font-black text-slate-900">{sal.month_year}</h3>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          sal.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          sal.payment_status === 'processing' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {sal.payment_status === 'paid' ? '✓ Disbursed (Paid)' : sal.payment_status === 'processing' ? '⏳ Processing' : 'Pending'}
                        </span>

                        <button
                          onClick={() => setSelectedPayslip(sal)}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition"
                        >
                          <Printer size={13} /> Payslip
                        </button>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Basic Pay</span>
                        <span className="font-extrabold text-slate-800 text-sm">₹{Number(sal.basic_salary).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Allowances</span>
                        <span className="font-extrabold text-emerald-600 text-sm">+ ₹{Number(sal.allowances).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Deductions</span>
                        <span className="font-extrabold text-red-500 text-sm">- ₹{Number(sal.deductions).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                        <span className="text-emerald-800 block text-[10px] uppercase font-bold">Net Payable</span>
                        <span className="font-black text-emerald-700 text-base">₹{Number(sal.net_salary).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Payment reference info */}
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Method: <strong className="text-slate-700">{sal.payment_method || 'NEFT/IMPS'}</strong></span>
                      {sal.transaction_ref && <span>Ref Txn ID: <strong className="text-slate-800">{sal.transaction_ref}</strong></span>}
                      {sal.payment_date && <span>Paid on: <strong className="text-emerald-700">{sal.payment_date}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: MANAGER ATTENDANCE KIOSK */}
        {activeTab === 'kiosk' && isManager && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 text-white rounded-3xl p-6 border border-cyan-800/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    Manager Attendance Officer
                  </span>
                  <span className="text-xs text-slate-400">· VATHAN MINERALS - MINING</span>
                </div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ScanFace className="text-cyan-400" size={22} /> Worker Attendance & Biometric Kiosk
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Logged in as <strong className="text-white">{user.name}</strong> ({user.employee_code || user.role}). You have full authority to mark worker attendance, run real-time camera face recognition, scan Mantra USB fingerprints, and enroll workers.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('overview')}
                className="self-start md:self-auto px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition flex items-center gap-1.5"
              >
                ← Back to Overview
              </button>
            </div>

            <AttendanceManager user={user} />
          </div>
        )}
      </main>

      {/* MODAL 1: APPLY FOR LEAVE */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 relative">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Apply for Staff Leave</h3>
            <p className="text-xs text-slate-500 mb-4">Submit your leave request for management approval.</p>

            {leaveSuccessMsg && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs mb-3 font-semibold">
                ✓ {leaveSuccessMsg}
              </div>
            )}
            {leaveErrorMsg && (
              <div className="bg-red-50 text-red-800 border border-red-200 p-3 rounded-xl text-xs mb-3 font-semibold">
                ⚠ {leaveErrorMsg}
              </div>
            )}

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={e => setLeaveType(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick / Medical Leave</option>
                  <option value="annual">Annual / Festive Vacation</option>
                  <option value="emergency">Emergency Family Leave</option>
                  <option value="unpaid">Loss of Pay / Unpaid</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">From Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">To Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Leave</label>
                <textarea
                  required
                  rows="3"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Please describe reason for leave request..."
                  className="w-full border rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60 transition shadow"
                >
                  {submittingLeave ? 'Submitting…' : 'Submit Leave Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE PAYSLIP */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 relative">
            <div className="border-b border-slate-200 pb-4 mb-4 flex items-center justify-between">
              <VMLogo size={40} showText={true} textVariant="dark" />
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                  Official Salary Slip
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1">{selectedPayslip.month_year}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl mb-4 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Employee Name:</span> <strong className="text-slate-900">{user.name}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Employee Code:</span> <strong className="text-slate-900">{user.employee_code}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Designation:</span> <strong className="text-slate-900">{user.job_title}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment Status:</span> <strong className="text-emerald-700 uppercase">{selectedPayslip.payment_status}</strong></div>
              {selectedPayslip.transaction_ref && (
                <div className="flex justify-between"><span className="text-slate-500">Txn Ref:</span> <strong>{selectedPayslip.transaction_ref}</strong></div>
              )}
            </div>

            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Basic Salary:</span>
                <span className="font-bold">₹{Number(selectedPayslip.basic_salary).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
                <span>Special Allowances:</span>
                <span className="font-bold">+ ₹{Number(selectedPayslip.allowances).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 text-red-600">
                <span>Deductions (PF / ESI / Adv):</span>
                <span className="font-bold">- ₹{Number(selectedPayslip.deductions).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-xl font-extrabold text-sm text-emerald-900">
                <span>Net Salary Disbursed:</span>
                <span>₹{Number(selectedPayslip.net_salary).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Printer size={14} /> Print Slip
              </button>
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CHANGE PASSWORD */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 relative">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                <Lock size={16} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Change Your Password</h3>
                <p className="text-[11px] text-slate-500">Keep your portal access private</p>
              </div>
            </div>

            {pwSuccess && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs mb-3 font-semibold">
                ✓ {pwSuccess}
              </div>
            )}
            {pwError && (
              <div className="bg-red-50 text-red-800 border border-red-200 p-3 rounded-xl text-xs mb-3 font-semibold">
                ⚠ {pwError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5 mt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 4 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border rounded-xl px-3.5 py-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-60"
                >
                  {updatingPassword ? 'Saving…' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
