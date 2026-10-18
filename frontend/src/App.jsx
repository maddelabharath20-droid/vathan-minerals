import React, { useEffect, useMemo, useState, useRef } from 'react';
import { api, setAuthToken, clearAuthToken, getAuthToken } from './api';
import AttendanceManager from './AttendanceManager';
import VMLogo, { LeadershipBadge } from './VMLogo';
import PlantShowcase3D from './PlantShowcase3D';
import StaffPortal from './StaffPortal';
import LeaveApprovalManager from './LeaveApprovalManager';
import SalariesManager from './SalariesManager';
import { 
  LayoutDashboard, Users, Factory, Package, ClipboardList, ReceiptText, 
  Truck, ChartNoAxesCombined, LogOut, Menu, X, Plus, RefreshCw, ShieldCheck, 
  Boxes, UserRound, FileText, ScanFace, UserPlus, CalendarCheck, DollarSign, Rotate3d,
  Smartphone, Phone, Sparkles, Lock, Pencil, Trash2, Edit, HardHat, CheckCircle2, ArrowRight, Fingerprint
} from 'lucide-react';
import { tryGooglePopup, tryGoogleRedirect, checkRedirectResult, GOOGLE_CLIENT_ID } from './firebase';

const nav = [
  ['Dashboard','/dashboard',LayoutDashboard],
  ['Attendance','/attendance',ScanFace],
  ['Mantra Device','/mantra',Fingerprint],
  ['Employees','/employees',Users],
  ['Leave Approvals','/leave-approvals',CalendarCheck],
  ['Staff Salaries','/salaries',DollarSign],
  ['3D Mining View','/plant-3d',Rotate3d],
  ['Production','/production',Factory],
  ['Inventory','/products',Package],
  ['Stock movements','/stock',Boxes],
  ['Customers','/customers',UserRound],
  ['Orders','/orders',FileText],
  ['Invoices','/invoices',ReceiptText],
  ['Vehicles','/vehicles',Truck],
  ['Lorry trips','/trips',Truck],
  ['Reports','/reports',ChartNoAxesCombined],
];
const today = new Date().toISOString().slice(0,10);
const configs = {
 employees:{title:'Employees',endpoint:'/employees',fields:[['employee_code','Employee code'],['full_name','Full name'],['phone','Phone'],['job_title','Job title'],['date_joined','Date joined','date'],['active','Status','select',['1','0']]]},
 attendance:{title:'Attendance',endpoint:'/attendance',fields:[['employee_id','Employee ID','number'],['attendance_date','Date','date',today],['status','Status','select',['present','absent','leave','half_day']],['check_in','Check in','time'],['check_out','Check out','time'],['notes','Notes']]},
 products:{title:'Products & Inventory',endpoint:'/products',fields:[['sku','SKU'],['name','Product name'],['grade','Grade'],['stock_type','Stock type','select',['raw_barytes','finished_powder','packing_material']],['unit','Unit','select',['tonne','bag','piece']]]},
 production:{title:'Production logs',endpoint:'/production',fields:[['production_date','Production date','date',today],['raw_product_id','Raw product ID','number'],['finished_product_id','Finished product ID','number'],['raw_input_tonnes','Raw input (tonnes)','number'],['finished_output_tonnes','Finished output (tonnes)','number'],['wastage_tonnes','Wastage (tonnes)','number'],['shift_name','Shift'],['notes','Notes']]},
 stock:{title:'Stock movements',endpoint:'/stock',fields:[['product_id','Product ID','number'],['movement_date','Date','date',today],['movement_type','Movement type','select',['opening','purchase','adjustment','return']],['quantity_tonnes','Quantity (tonnes)','number'],['direction','Direction','select',['in','out']],['notes','Notes']]},
 customers:{title:'Customers',endpoint:'/customers',fields:[['name','Customer name'],['phone','Phone'],['email','Email','email'],['billing_address','Billing address'],['gstin','GSTIN']]},
 orders:{title:'Orders',endpoint:'/orders',fields:[['order_number','Order number'],['customer_id','Customer ID','number'],['order_date','Order date','date',today],['due_date','Due date','date'],['notes','Notes']]},
 invoices:{title:'Invoices',endpoint:'/invoices',fields:[['invoice_number','Invoice number'],['customer_id','Customer ID','number'],['order_id','Order ID (optional)','number'],['invoice_date','Invoice date','date',today],['subtotal','Subtotal (₹)','number'],['tax_rate','Tax rate (%)','number'],['notes','Notes']]},
 vehicles:{title:'Vehicles',endpoint:'/vehicles',fields:[['registration_number','Registration number'],['vehicle_type','Vehicle type'],['capacity_tonnes','Capacity (tonnes)','number']]},
 trips:{title:'Lorry trips',endpoint:'/trips',fields:[['trip_date','Trip date','date',today],['vehicle_id','Vehicle ID','number'],['driver_id','Driver ID (optional)','number'],['order_id','Order ID (optional)','number'],['invoice_id','Invoice ID (optional)','number'],['destination','Destination'],['gross_weight_tonnes','Gross weight (tonnes)','number'],['tare_weight_tonnes','Tare weight (tonnes)','number'],['status','Status','select',['planned','loaded','dispatched','delivered','cancelled']],['weighbridge_slip','Weighbridge slip'],['notes','Notes']]},
};
const fmt = n => Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:3});
const SAVED_EMAIL_KEY = 'vathan_remembered_login_email';

export const STAFF_LIST = [
  { code: '005', name: 'MADDELA KRISHNA', role: 'Mill Incharge', phone: '9542938030', badge: 'Mill Incharge' },
  { code: '001', name: 'RAMA CHANDRAIAH', role: 'Mill Operator', phone: '001', badge: 'Mill Operator' },
  { code: '002', name: 'SIVA', role: 'Supervisor', phone: '7396063526', badge: 'Supervisor' },
  { code: '009', name: 'CHANDRA', role: 'Manager', phone: '7674859036', badge: 'Manager' },
  { code: '010', name: 'NAGARJUNA', role: 'Manager', phone: '918207556', badge: 'Manager' },
  { code: '008', name: 'NAVEEN', role: 'Office Incharge', phone: '9949405770', badge: 'Office Incharge' },
  { code: '006', name: 'HARI BABU', role: 'Hitachi Operator', phone: '9848903651', badge: 'Hitachi Operator' },
  { code: '007', name: 'KISHORE', role: 'Hitachi Helper', phone: '8374757324', badge: 'Hitachi Helper' },
  { code: '003003', name: 'SUBODH', role: 'Operator & Watchman', phone: '7416189916', badge: 'Watchman & Op' },
  { code: '004', name: 'GOURANGO BERA', role: 'Operator Helper', phone: '6304418709', badge: 'Operator Helper' },
  { code: '011', name: 'NAVEEN CHOWDARY', role: 'Office Worker', phone: '9030518149', badge: 'Office Worker' },
  { code: '012', name: 'PENCHILAIAH', role: 'Driver', phone: '9666431729', badge: 'Driver' },
  { code: 'B-001', name: 'BHARATH MADDELA', role: 'System Manager', phone: '+91 9030678492', badge: 'System Manager' }
];

function getRememberedEmail() {
  try {
    const v = localStorage.getItem(SAVED_EMAIL_KEY);
    if (v && v.trim()) return v.trim();
  } catch {}
  return '';
}

function Auth({onLogin}) {
  const [loginTab, setLoginTab] = useState('admin'); // 'admin' | 'staff'
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  
  // Keep existing email selected for Web and App
  const [email, setEmail] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);

  const [password, setPassword] = useState('');
  const [role, setRole] = useState('manager');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Staff Portal Login state
  const [staffCode, setStaffCode] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Staff personal password reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [resetErr, setResetErr] = useState('');

  const [showMobile3D, setShowMobile3D] = useState(false);

  // Check for returning Google redirect login
  useEffect(() => {
    let mounted = true;
    async function checkRedirect() {
      try {
        const res = await checkRedirectResult();
        if (res && res.success && res.user?.idToken && mounted) {
          setBusy(true);
          if (res.user.email) persistEmail(res.user.email);
          const savedRole = sessionStorage.getItem('pending_google_auth_role') || 'admin';
          const savedCode = sessionStorage.getItem('pending_google_auth_code') || undefined;
          sessionStorage.removeItem('pending_google_auth_role');
          sessionStorage.removeItem('pending_google_auth_code');

          const d = await api('/auth/google', {
            method: 'POST',
            body: JSON.stringify({
              idToken: res.user.idToken,
              email: res.user.email,
              displayName: res.user.displayName,
              uid: res.user.uid,
              role: savedRole,
              employeeCode: savedCode
            })
          });
          if (d && d.token && mounted) {
            onLogin(d.user, d.token);
            return;
          }
          if (d && d.requiresLink && mounted) {
            setError(d.message || 'Please tap your name or enter your Employee Code above to link your Google account.');
          }
        }
      } catch (err) {
        console.warn('Redirect check notice:', err);
      } finally {
        if (mounted) setBusy(false);
      }
    }
    checkRedirect();
    return () => { mounted = false; };
  }, []);

  function persistEmail(emailToSave) {
    if (emailToSave && emailToSave.trim()) {
      try {
        localStorage.setItem(SAVED_EMAIL_KEY, emailToSave.trim());
      } catch {}
    }
  }

  function handleEmailChange(val) {
    setEmail(val);
    setError('');
    if (rememberEmail && val && val.trim()) {
      persistEmail(val);
    }
  }

  async function handleGoogleSignIn(targetRole = 'admin', forceRedirect = false) {
    setError('');
    setBusy(true);
    const codeToPass = targetRole === 'staff' ? (staffCode || selectedStaff?.code || '') : undefined;
    const isMobile = typeof navigator !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.innerWidth <= 768)
    );

    // 1. On mobile devices or when forced, use full-page Google Redirect (never blocked by mobile popups or tab switches)
    if (forceRedirect || isMobile) {
      try {
        sessionStorage.setItem('pending_google_auth_role', targetRole);
        if (codeToPass) sessionStorage.setItem('pending_google_auth_code', codeToPass);
        await tryGoogleRedirect();
        return;
      } catch (redirErr) {
        console.warn('Redirect error:', redirErr);
        setError('Unable to initiate Google redirect. Please use password login or verify browser settings.');
        setBusy(false);
        return;
      }
    }

    // 2. On desktop systems, try instantaneous Google Popup
    try {
      const res = await tryGooglePopup();
      if (res.success && res.user?.idToken) {
        if (res.user.email) persistEmail(res.user.email);
        const d = await api('/auth/google', {
          method: 'POST',
          body: JSON.stringify({
            idToken: res.user.idToken,
            email: res.user.email,
            displayName: res.user.displayName,
            uid: res.user.uid,
            role: targetRole,
            employeeCode: codeToPass
          })
        });
        if (d && d.token) {
          onLogin(d.user, d.token);
          return;
        }
        if (d && d.requiresLink) {
          setError(d.message || 'Please tap your name or enter your Employee Code above to link your Google account.');
          return;
        }
      } else if (res.error) {
        const code = res.error.code || '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          // Popup was closed or dismissed - cleanly return without alarming error box
          setError('');
          setBusy(false);
          return;
        }
        if (code === 'auth/popup-blocked') {
          setError('Browser blocked the popup window. Please sign in below using your password or PIN.');
          return;
        }
        if (code === 'auth/unauthorized-domain') {
          setError('Google Sign-In domain authorization pending. Please sign in below using your password or PIN.');
          return;
        }
        setError(res.error.message || 'Google Sign-In was cancelled. Please sign in below using password or PIN.');
      }
    } catch (err) {
      setError(err.message || 'Google Sign-In error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const rolesList = [
    ['admin', 'Prop Account · Proprietor (MADDELA VENKATA SUBBAIAH)'],
    ['manager', 'Operations Manager (Taking Attendance & Plant Operations)'],
    ['hr', 'HR & People'],
    ['production', 'Production & Milling'],
    ['dispatch', 'Logistics & Dispatch'],
    ['accounts', 'Finance & Billing']
  ];

  async function submit(e) {
    e.preventDefault();
    const trimmedEmail = (email || '').trim();
    const trimmedPassword = (password || '').trim();

    if (!trimmedEmail) {
      setError('Please enter your Google account (Gmail) or registered mobile number');
      return;
    }
    if (!trimmedPassword) {
      setError('Please enter your password to sign in');
      return;
    }

    if (rememberEmail) {
      persistEmail(trimmedEmail);
    }

    setBusy(true);
    setError('');
    try {
      const endpoint = isSignUp ? '/auth/signup' : '/auth/login';
      const payload = isSignUp 
        ? { name: (name || '').trim(), email: trimmedEmail, password: trimmedPassword, role } 
        : { email: trimmedEmail, password: trimmedPassword };
      const d = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      onLogin(d.user, d.token);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  async function submitStaff(e) {
    if (e) e.preventDefault();
    const trimmedCode = (staffCode || '').trim();
    const trimmedPass = (staffPassword || '').trim();

    if (!trimmedCode) {
      setError('Please enter your Employee Code or Mobile number');
      return;
    }
    if (!trimmedPass) {
      setError('Please enter your Staff PIN or Password (Default: 88904)');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const d = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedCode,
          password: trimmedPass
        })
      });
      if (d && d.token) {
        onLogin(d.user, d.token);
      }
    } catch (err) {
      setError(err.message || 'Staff login failed. Please verify your Employee Code and personal password.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStaffResetPassword(e) {
    e.preventDefault();
    setResetErr('');
    setResetMsg('');
    setResetBusy(true);
    try {
      const res = await api('/auth/staff-reset-password', {
        method: 'POST',
        body: JSON.stringify({
          employeeCode: resetCode,
          phoneOrVerification: resetPhone,
          newPassword: resetNewPass
        })
      });
      setResetMsg(res.message || 'Personal password updated! You can now log in.');
      setStaffCode(resetCode);
      setStaffPassword(resetNewPass);
      setTimeout(() => {
        setShowResetModal(false);
        setResetMsg('');
      }, 2000);
    } catch (err) {
      setResetErr(err.message || 'Failed to update personal password. Verify your Employee Code and registered mobile number.');
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white">
      {/* Left Column: 3D Plant & Fleet Showcase Hero */}
      <div className="hidden md:flex bg-slate-950 text-white p-8 lg:p-10 flex-col justify-between relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div>
          <VMLogo size={64} showText={true} textVariant="light" />
        </div>

        {/* Real-time 3D Interactive Plant & Fleet Showcase */}
        <div className="my-auto py-2">
          <PlantShowcase3D compact={true} />
        </div>

        {/* Official Proprietor Card */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur max-w-md">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
              Prop : MADDELA VENKATA SUBBAIAH
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">
              Rly Kodur, Andhra Pradesh
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-extrabold text-white tracking-wide">VATHAN MINERALS - MINING</p>
              <p className="text-xs text-emerald-400 font-semibold">Prop : MADDELA VENKATA SUBBAIAH</p>
            </div>
            <span className="text-[11px] font-extrabold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-lg">
              MD
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-3">
          <p>© VATHAN MINERALS - MINING · All Rights Reserved</p>
          <p>Rly Kodur, Andhra Pradesh</p>
        </div>
      </div>

      {/* Right Column: Portal Login (Staff vs Management) */}
      <div className="flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile Hero Header with 3D Preview Toggle */}
          <div className="md:hidden mb-4">
            <div className="flex items-center justify-between bg-slate-900 text-white p-3 rounded-2xl border border-emerald-500/30 shadow-md">
              <div className="flex items-center gap-2.5">
                <VMLogo size={36} />
                <div>
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Prop : MADDELA VENKATA SUBBAIAH</p>
                  <p className="font-black text-xs text-white tracking-wide">VATHAN MINERALS - MINING</p>
                  <p className="text-[9px] text-slate-300 font-medium">Rly Kodur, Andhra Pradesh</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block">Proprietor</span>
                <span className="text-[10px] font-black text-white">M. V. Subbaiah</span>
              </div>
            </div>

            {/* Mobile 3D Mining Model Accordion */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowMobile3D(!showMobile3D)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold border border-emerald-500/30 shadow-sm transition"
              >
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <Rotate3d size={14} />
                  {showMobile3D ? 'Hide 3D Mining View' : '✨ View 3D Mining & Fleet'}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono">
                  {showMobile3D ? 'Close' : 'View 3D'}
                </span>
              </button>
              {showMobile3D && (
                <div className="mt-2 rounded-2xl overflow-hidden border border-emerald-500/30 shadow-lg p-1.5 bg-slate-900">
                  <PlantShowcase3D compact={true} />
                </div>
              )}
            </div>
          </div>

          {/* Dual Tabs: Admin Login vs Staff Login */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl mb-5 shadow-inner border border-slate-200">
            <button
              type="button"
              onClick={() => { setLoginTab('admin'); setError(''); }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                loginTab === 'admin'
                  ? 'bg-slate-950 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <ShieldCheck size={16} className={loginTab === 'admin' ? 'text-emerald-400' : 'text-slate-400'} />
              <span>Prop / Manager Login</span>
            </button>
            <button
              type="button"
              onClick={() => { setLoginTab('staff'); setError(''); }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                loginTab === 'staff'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <HardHat size={16} className={loginTab === 'staff' ? 'text-white' : 'text-slate-400'} />
              <span>Staff Login</span>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-xs sm:text-sm border border-red-200 flex items-start justify-between gap-2 shadow-xs">
              <div className="flex-1">{error}</div>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-700 font-bold px-1.5 py-0.5 text-base leading-none rounded"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {/* TAB 1: ADMIN LOGIN */}
          {loginTab === 'admin' && (
            <form onSubmit={submit} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-sm">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Proprietor & Manager Login</h2>
                    <p className="text-slate-500 text-xs">Prop Account (Prop : MADDELA VENKATA SUBBAIAH) · Operations Managers</p>
                  </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(false); setError(''); }}
                    className={`px-3 py-1 rounded-lg transition ${!isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(true); setError(''); }}
                    className={`px-3 py-1 rounded-lg transition ${isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input
                    className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    required
                  />
                </div>
              )}

              {/* Email or Mobile Number */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email or Username</label>
                <input
                  className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-medium"
                  type="text"
                  autoCapitalize="none"
                  value={email}
                  onChange={e => handleEmailChange(e.target.value)}
                  placeholder="Enter Prop Account or Manager Email / Username"
                  required
                />
                <div className="flex items-center justify-between mt-1.5 px-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-600 font-medium">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={e => {
                        setRememberEmail(e.target.checked);
                        if (e.target.checked && email.trim()) {
                          persistEmail(email.trim());
                        }
                      }}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span>Remember login on this device</span>
                  </label>
                  {email && (
                    <button
                      type="button"
                      onClick={() => handleEmailChange('')}
                      className="text-[11px] text-slate-400 hover:text-slate-600 font-medium hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  {!isSignUp && <span className="text-[11px] text-slate-400">Prop / Manager Password</span>}
                </div>
                <input
                  className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-semibold"
                  type="password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your password"
                  required
                />
                {isSignUp && <p className="text-[11px] text-slate-400 mt-1">Must be at least 6 characters</p>}
              </div>

              {isSignUp && (
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department / Role</label>
                  <select
                    className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-600 text-sm bg-white"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  >
                    {rolesList.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sign In Button */}
              <button
                disabled={busy}
                type="submit"
                className="w-full bg-slate-950 hover:bg-slate-800 text-white rounded-xl py-3 font-bold text-sm disabled:opacity-60 transition shadow-lg mt-1 flex items-center justify-center gap-2"
              >
                {busy ? (isSignUp ? 'Creating Account…' : 'Signing In…') : (isSignUp ? 'Create Prop / Manager Account' : 'Sign In to Prop / Manager Account')}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">or continue with</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Single Sign in with Google Button */}
              <button
                type="button"
                disabled={busy}
                onClick={() => handleGoogleSignIn('admin')}
                className="w-full flex items-center justify-center gap-3 border border-slate-300 hover:border-emerald-500 rounded-xl py-2.5 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 transition shadow-xs disabled:opacity-60 active:scale-[0.99]"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.5 2.4 30.1 0 24 0 14.7 0 6.7 5.5 2.8 13.5l7.8 6.1C12.5 13.2 17.8 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
                  <path fill="#FBBC05" d="M10.6 28.4A14.7 14.7 0 0 1 9.5 24c0-1.5.2-3 .6-4.4L2.3 13.5A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.4 10.5l8.2-6.1z"/>
                  <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.4 2.2-6.2 0-11.5-4.2-13.4-9.8l-8 6.1C6.5 42.5 14.7 48 24 48z"/>
                </svg>
                <span>{busy ? 'Connecting to Google…' : 'Sign in with Google'}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleGoogleSignIn('admin', true)}
                className="w-full mt-2 text-center text-[11px] text-slate-500 hover:text-emerald-700 font-medium py-1 transition flex items-center justify-center gap-1.5"
              >
                <Smartphone size={12} className="text-slate-400" />
                <span>On Mobile or Popup Blocked? Sign in via Google Redirect</span>
              </button>

              <div className="flex items-center justify-center gap-1.5 mt-5 text-[11px] text-slate-500 font-medium">
                <ShieldCheck size={13} className="text-emerald-600" />
                <span>Full secure authentication · Rly Kodur</span>
              </div>

              <div className="mt-4 text-center text-xs text-slate-500">
                {isSignUp ? (
                  <p>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsSignUp(false); setError(''); }}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      Sign In
                    </button>
                  </p>
                ) : (
                  <p>
                    Need a new admin account?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsSignUp(true); setError(''); }}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      Sign Up
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}

          {/* TAB 2: STAFF LOGIN */}
          {loginTab === 'staff' && (
            <form onSubmit={submitStaff} className="w-full">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                    <HardHat size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Staff Login</h2>
                    <p className="text-slate-500 text-xs">Factory, Mill, Hitachi, Drivers & Workers</p>
                  </div>
                </div>
              </div>

              {/* Employee Code / Mobile Input */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Employee Code or Mobile Number
                </label>
                <div className="relative">
                  <input
                    className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-semibold"
                    type="text"
                    value={staffCode}
                    onChange={e => {
                      setStaffCode(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter Employee Code or Mobile (e.g. 001, 005, 9542938030)"
                    required
                  />
                  {staffCode && (
                    <button
                      type="button"
                      onClick={() => { setStaffCode(''); setError(''); }}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Personal Password */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Personal Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetCode(staffCode);
                      setResetErr('');
                      setResetMsg('');
                      setShowResetModal(true);
                    }}
                    className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold hover:underline flex items-center gap-1"
                  >
                    <Lock size={11} className="text-emerald-600 shrink-0" />
                    <span>Set / Change Password</span>
                  </button>
                </div>
                <input
                  className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-semibold tracking-wider"
                  type="password"
                  value={staffPassword}
                  onChange={e => {
                    setStaffPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your personal password"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                  <span>Each employee has their own personal password or registered mobile number</span>
                </p>
              </div>

              {/* Staff Sign In Button */}
              <button
                disabled={busy}
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-bold text-sm disabled:opacity-60 transition shadow-lg flex items-center justify-center gap-2"
              >
                {busy ? (
                  <span>Signing In…</span>
                ) : (
                  <>
                    <span>Sign In to Staff Portal</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">or continue with</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Single Sign in with Google Button for Staff */}
              <button
                type="button"
                disabled={busy}
                onClick={() => handleGoogleSignIn('staff')}
                className="w-full flex items-center justify-center gap-3 border border-slate-300 hover:border-emerald-500 rounded-xl py-2.5 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 transition shadow-xs disabled:opacity-60 active:scale-[0.99]"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.5 2.4 30.1 0 24 0 14.7 0 6.7 5.5 2.8 13.5l7.8 6.1C12.5 13.2 17.8 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
                  <path fill="#FBBC05" d="M10.6 28.4A14.7 14.7 0 0 1 9.5 24c0-1.5.2-3 .6-4.4L2.3 13.5A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.4 10.5l8.2-6.1z"/>
                  <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.4 2.2-6.2 0-11.5-4.2-13.4-9.8l-8 6.1C6.5 42.5 14.7 48 24 48z"/>
                </svg>
                <span>{busy ? 'Connecting to Google…' : 'Sign in with Google (Staff Portal)'}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleGoogleSignIn('staff', true)}
                className="w-full mt-2 text-center text-[11px] text-slate-500 hover:text-emerald-700 font-medium py-1 transition flex items-center justify-center gap-1.5"
              >
                <Smartphone size={12} className="text-slate-400" />
                <span>On Mobile or Popup Blocked? Sign in via Google Redirect</span>
              </button>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Secure Personal Staff Access</span>
                </p>
                <p>Sign in with your personal password or registered mobile number to manage your attendance and leaves.</p>
              </div>
            </form>
          )}

          {/* Staff Personal Password Reset Modal */}
          {showResetModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Lock size={16} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">Set Personal Password</h3>
                      <p className="text-[10px] text-slate-500">Every staff member has their own pass</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowResetModal(false); setResetErr(''); setResetMsg(''); }}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none"
                  >
                    ×
                  </button>
                </div>

                {resetErr && (
                  <div className="bg-red-50 text-red-700 p-2.5 rounded-xl text-xs mb-3 border border-red-200">
                    {resetErr}
                  </div>
                )}
                {resetMsg && (
                  <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-xl text-xs mb-3 border border-emerald-200 font-medium">
                    {resetMsg}
                  </div>
                )}

                <form onSubmit={handleStaffResetPassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 001, 005, 002"
                      value={resetCode}
                      onChange={e => setResetCode(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Mobile Number</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter 10-digit mobile number"
                      value={resetPhone}
                      onChange={e => setResetPhone(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">New Personal Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter new personal password (min 4 chars)"
                      value={resetNewPass}
                      onChange={e => setResetNewPass(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetBusy}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-60"
                    >
                      {resetBusy ? 'Saving…' : 'Save Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function Field({field,value,onChange}) {
 const [key,label,type='text',options]=field;
 const selectOpts = Array.isArray(options) ? options : [];
 const scalarValue = typeof value === 'object' ? '' : (value ?? '');
 if(type==='select') {
   return (
     <label className="block text-sm">
       <span className="block font-medium text-slate-600 mb-1.5">{label}</span>
       <select
         className="w-full border rounded-lg px-3 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-cyan-700 outline-none"
         value={String(scalarValue !== '' && scalarValue !== undefined ? scalarValue : (selectOpts[0] ?? ''))}
         onChange={e=>onChange(key,e.target.value)}
       >
         {selectOpts.map(o => (
           <option key={o} value={o}>
             {o === '1' ? 'Active (1)' : o === '0' ? 'Inactive (0)' : o}
           </option>
         ))}
       </select>
     </label>
   );
 }
 return (
   <label className="block text-sm">
     <span className="block font-medium text-slate-600 mb-1.5">{label}</span>
     <input
       className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-cyan-700 outline-none"
       type={type}
       value={scalarValue}
       onChange={e=>onChange(key,e.target.value)}
     />
   </label>
 );
}
function Module({module,role}) {
 const cfg=configs[module];
 const [rows,setRows]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [show,setShow]=useState(false);
 const [saving,setSaving]=useState(false);
 const [form,setForm]=useState({});
 const [editRecord,setEditRecord]=useState(null);
 const [editForm,setEditForm]=useState({});
 const [updating,setUpdating]=useState(false);
 const [deletingId,setDeletingId]=useState(null);

 async function load(){
   setLoading(true);
   try {
     setRows(await api(cfg.endpoint));
     setError('');
   } catch(e) {
     setError(e.message);
   } finally {
     setLoading(false);
   }
 }
 useEffect(()=>{load()},[module]);

 function change(k,v){setForm(p=>({...p,[k]:v}))}
 function changeEdit(k,v){setEditForm(p=>({...p,[k]:v}))}

 function openEdit(r) {
   setEditRecord(r);
   setError('');
   setSuccess('');
   const initial = {};
   for (const f of cfg.fields) {
     const key = f[0];
     let val = r[key];
     if (f[2] === 'date' && val) {
       val = String(val).slice(0, 10);
     }
     initial[key] = val ?? '';
   }
   setEditForm(initial);
 }

 async function save(e){
   e.preventDefault();
   setSaving(true);
   setError('');
   setSuccess('');
   try {
     const payload={...form};
     for(const f of cfg.fields){
       if(f[2]==='number'&&payload[f[0]]!=='') payload[f[0]]=Number(payload[f[0]]);
       if(f[0]==='active'&&payload[f[0]]!=='') payload[f[0]]=Number(payload[f[0]]);
       if(payload[f[0]]==='') delete payload[f[0]];
     }
     await api(cfg.endpoint,{method:'POST',body:JSON.stringify(payload)});
     setShow(false);
     setForm({});
     setSuccess('Record created successfully!');
     setTimeout(() => setSuccess(''), 4000);
     await load();
   } catch(e){
     setError(e.message);
   } finally {
     setSaving(false);
   }
 }

 async function saveEdit(e){
   e.preventDefault();
   if (!editRecord) return;
   setUpdating(true);
   setError('');
   try {
     const payload={...editForm};
     for(const f of cfg.fields){
       if(f[2]==='number'&&payload[f[0]]!=='') payload[f[0]]=Number(payload[f[0]]);
       if(f[0]==='active'&&payload[f[0]]!=='') payload[f[0]]=Number(payload[f[0]]);
       if(payload[f[0]]==='') delete payload[f[0]];
     }
     await api(`${cfg.endpoint}/${editRecord.id}`,{
       method:'PUT',
       body:JSON.stringify(payload)
     });
     setEditRecord(null);
     setEditForm({});
     setSuccess('Record updated successfully!');
     setTimeout(() => setSuccess(''), 4000);
     await load();
   } catch(e){
     setError(e.message || 'Failed to update record');
   } finally {
     setUpdating(false);
   }
 }

 async function deleteRow(r) {
   const itemTitle = r.full_name || r.name || r.employee_code || r.registration_number || `#${r.id}`;
   if (!window.confirm(`Are you sure you want to delete ${itemTitle}?`)) return;
   setDeletingId(r.id);
   setError('');
   try {
     await api(`${cfg.endpoint}/${r.id}`, { method: 'DELETE' });
     setSuccess('Record deleted successfully');
     setTimeout(() => setSuccess(''), 3000);
     await load();
   } catch (e) {
     setError(e.message || 'Failed to delete record');
   } finally {
     setDeletingId(null);
   }
 }

 const cols=rows.length?Object.keys(rows[0]).filter(k=>!['created_at','created_by','password_hash','face_photo','face_descriptor','face_snapshot'].includes(k)).slice(0,7):[];

 return (
   <div>
     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
       <div>
         <h2 className="text-2xl font-bold text-slate-900">{cfg.title}</h2>
         <p className="text-slate-500 text-sm mt-1">View, add, edit, and manage records.</p>
       </div>
       <div className="flex gap-2">
         <button onClick={load} className="border bg-white rounded-xl px-3 py-2.5 text-slate-600 hover:text-slate-900 shadow-xs">
           <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
         </button>
         <button onClick={()=>setShow(!show)} className="bg-slate-950 hover:bg-slate-900 text-white rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-semibold shadow-sm">
           <Plus size={17}/> Add record
         </button>
       </div>
     </div>

     {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm font-medium">{error}</div>}
     {success && <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 text-sm font-bold">{success}</div>}

     {/* Add Modal */}
     {show && (
       <form onSubmit={save} className="bg-white border rounded-2xl p-5 mb-6 shadow-sm">
         <div className="flex items-center justify-between mb-4">
           <h3 className="font-bold text-slate-900">New {cfg.title.replace(/s$/i, '') || 'Record'}</h3>
           <button type="button" onClick={()=>setShow(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
         </div>
         <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
           {cfg.fields.map(f=>{
             const def = f[2]==='select' ? (Array.isArray(f[3]) ? f[3][0] : '') : (typeof f[3]==='string' ? f[3] : ''); 
             return <Field key={f[0]} field={f} value={form[f[0]] ?? def} onChange={change}/>;
           })}
         </div>
         <div className="flex justify-end gap-2 mt-5">
           <button type="button" onClick={()=>setShow(false)} className="border rounded-xl px-4 py-2 text-sm font-medium">Cancel</button>
           <button disabled={saving} className="bg-cyan-800 hover:bg-cyan-900 text-white rounded-xl px-5 py-2 text-sm font-bold shadow-sm disabled:opacity-50">
             {saving?'Saving…':'Save record'}
           </button>
         </div>
       </form>
     )}

     {/* Edit Modal */}
     {editRecord && (
       <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
         <div className="bg-white rounded-2xl border shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
           <div className="flex items-center justify-between pb-4 border-b border-slate-100">
             <div>
               <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                 <Pencil size={18} className="text-cyan-800" />
                 Edit {cfg.title.replace(/s$/i, '') || 'Record'} #{editRecord.id}
               </h3>
               <p className="text-xs text-slate-500 mt-0.5">Modify fields and save changes to update the live database.</p>
             </div>
             <button
               type="button"
               onClick={() => setEditRecord(null)}
               className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
             >
               <X size={18} />
             </button>
           </div>

           <form onSubmit={saveEdit} className="mt-5 space-y-4">
             <div className="grid sm:grid-cols-2 gap-4">
               {cfg.fields.map(f => {
                 const def = f[2] === 'select' ? (Array.isArray(f[3]) ? f[3][0] : '') : '';
                 return (
                   <Field
                     key={f[0]}
                     field={f}
                     value={editForm[f[0]] ?? def}
                     onChange={changeEdit}
                   />
                 );
               })}
             </div>

             <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100 mt-6">
               <button
                 type="button"
                 onClick={() => setEditRecord(null)}
                 className="border rounded-xl px-4 py-2 text-sm font-medium hover:bg-slate-50 transition"
               >
                 Cancel
               </button>
               <button
                 type="submit"
                 disabled={updating}
                 className="bg-cyan-800 hover:bg-cyan-900 text-white rounded-xl px-5 py-2 text-sm font-bold shadow-sm disabled:opacity-50 transition"
               >
                 {updating ? 'Saving Changes…' : 'Save Changes'}
               </button>
             </div>
           </form>
         </div>
       </div>
     )}

     {/* Records Table */}
     <div className="bg-white border rounded-2xl overflow-hidden shadow-xs">
       <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
         <span className="font-bold text-slate-800">Recent records</span>
         <span className="text-xs font-semibold text-slate-500 bg-white border px-2.5 py-1 rounded-full">{rows.length} records</span>
       </div>
       {loading ? (
         <div className="p-8 text-center text-slate-500 font-medium">Loading records…</div>
       ) : rows.length === 0 ? (
         <div className="p-10 text-center">
           <Package className="mx-auto text-slate-300" size={34}/>
           <p className="font-semibold text-slate-700 mt-3">No records yet</p>
           <p className="text-sm text-slate-500 mt-1">Add your first record to get started.</p>
         </div>
       ) : (
         <div className="overflow-x-auto">
           <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 text-slate-600 border-b">
               <tr>
                 {cols.map(c => (
                   <th key={c} className="px-4 py-3 font-bold text-xs uppercase tracking-wider whitespace-nowrap">
                     {c.replaceAll('_',' ')}
                   </th>
                 ))}
                 <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {rows.map((r,i) => (
                 <tr key={r.id||i} className="hover:bg-slate-50/80 transition">
                   {cols.map(c => (
                     <td key={c} className="px-4 py-3 whitespace-nowrap max-w-64 truncate text-slate-700">
                       {c === 'active' ? (
                         <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r[c] ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                           {r[c] ? 'Active' : 'Inactive'}
                         </span>
                       ) : typeof r[c] === 'number' ? (
                         fmt(r[c])
                       ) : (
                         c.includes('date') && r[c] ? String(r[c]).slice(0, 10) : String(r[c] ?? '—')
                       )}
                     </td>
                   ))}
                   <td className="px-4 py-3 text-right whitespace-nowrap">
                     <div className="flex items-center justify-end gap-1.5">
                       <button
                         onClick={() => openEdit(r)}
                         title="Edit record"
                         className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                       >
                         <Pencil size={15} />
                       </button>
                       <button
                         disabled={deletingId === r.id}
                         onClick={() => deleteRow(r)}
                         title="Delete record"
                         className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                       >
                         <Trash2 size={15} />
                       </button>
                     </div>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       )}
     </div>
     <p className="text-xs text-slate-400 mt-3">IDs are shown for related records. Use the ID from the relevant table when linking records.</p>
   </div>
 );
}
function Dashboard({user, onNavigate}) {
 const [d,setD]=useState(null),[error,setError]=useState(''),[from,setFrom]=useState(today),[to,setTo]=useState(today),[loading,setLoading]=useState(false);
 async function load(){setLoading(true);try{setD(await api(`/dashboard?from=${from}&to=${to}`));setError('')}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const cards=[['Employees present',d?.attendance?.present??'—',Users,`${fmt(d?.attendance?.total)} attendance records`],['Finished production',d?`${fmt(d.production?.finished_tonnes)} t`:'—',Factory,`Raw ${fmt(d?.production?.raw_tonnes)} t · wastage ${fmt(d?.production?.wastage_tonnes)} t`],['Lorry trips',d?.trips?.count??'—',Truck,`${fmt(d?.trips?.tonnes)} net tonnes`],['Orders',d?.orders?.total??'—',ClipboardList,`${fmt(d?.orders?.pending)} pending · ${fmt(d?.orders?.completed)} completed`],['Invoice value',d?`₹${fmt(d.invoice_total)}`:'—',ReceiptText,'Invoices dated in selected period'],['Outstanding receivables',d?`₹${fmt(d.outstanding)}`:'—',ReceiptText,'Current unpaid balance across invoices']];
 return <div className="space-y-6">
  {/* Official Company & Proprietorship Header Banner */}
  <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-emerald-900/40 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
      <div className="flex items-center gap-4">
        <VMLogo size={72} />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Prop : MADDELA VENKATA SUBBAIAH
            </span>
            <span className="text-xs text-slate-400 font-semibold">Rly Kodur, Andhra Pradesh</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
            VATHAN MINERALS - MINING
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5 font-medium">
            Prop : MADDELA VENKATA SUBBAIAH · High Grade Barytes Ore & Heavy Mining Fleet Operations
          </p>
        </div>
      </div>

      {/* Proprietor Profile */}
      <div className="min-w-[260px] lg:min-w-[320px]">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-black text-sm shrink-0">
            MD
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Proprietor & MD</p>
            <p className="text-sm sm:text-base font-black text-white truncate">MADDELA VENKATA SUBBAIAH</p>
            <p className="text-[11px] text-slate-300 font-medium">VATHAN MINERALS - MINING · Rly Kodur, Andhra Pradesh</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* Interactive 3D Mining & Fleet Operations Showcase */}
  <div className="bg-slate-950 p-6 rounded-3xl border border-white/10 shadow-xl">
    <div className="flex items-center justify-between mb-4">
      <div>
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Prop : MADDELA VENKATA SUBBAIAH
        </span>
        <h3 className="text-lg font-black text-white mt-0.5">VATHAN MINERALS - MINING</h3>
        <p className="text-xs text-slate-400 font-medium">Rly Kodur, Andhra Pradesh</p>
      </div>
    </div>
    <PlantShowcase3D />
  </div>

  {/* Manager Attendance Quick-Action Panel */}
  <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0">
        <ScanFace size={26} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950">
            Attendance Taking Enabled
          </span>
          <span className="text-xs text-slate-400">· Manager Attendance Privileges</span>
        </div>
        <h3 className="text-lg font-black text-white mt-1">Take Worker Attendance Today</h3>
        <p className="text-xs text-slate-300">
          Fast-access Face Recognition camera scanner & Mantra MFS100 USB optical fingerprint kiosk.
        </p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2.5">
      <button
        onClick={() => onNavigate && onNavigate('Attendance')}
        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition"
      >
        <ScanFace size={16} /> Open Face Kiosk
      </button>
      <button
        onClick={() => onNavigate && onNavigate('Mantra Device')}
        className="px-4 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition"
      >
        <Fingerprint size={16} /> Mantra Fingerprint Kiosk
      </button>
    </div>
  </div>

  <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
    <div>
      <p className="text-emerald-800 font-bold text-xs uppercase tracking-wider">Operations Overview</p>
      <h2 className="text-2xl font-black mt-0.5 text-slate-900">Good to see you, {user.name.split(' ')[0]}</h2>
      <p className="text-slate-500 text-sm mt-0.5">Operational and financial snapshot for your selected dates.</p>
    </div>
    <button onClick={load} disabled={loading} className="bg-white border rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-semibold hover:bg-slate-50 shadow-sm transition"><RefreshCw size={16}/>{loading?'Refreshing…':'Refresh'}</button>
  </div>
  <div className="bg-white border rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-3"><label className="text-sm">From date<input type="date" className="block mt-1 border rounded-lg px-3 py-2" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm">To date<input type="date" className="block mt-1 border rounded-lg px-3 py-2" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label><button onClick={load} className="bg-slate-950 text-white rounded-lg px-4 py-2 font-semibold">Apply dates</button><span className="text-xs text-slate-500">Attendance, production, trips, orders and invoice value use this range. Stock and receivables are current balances.</span></div>
  {error&&<div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4">{error}</div>}<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{cards.map(([title,value,Icon,sub])=><div key={title} className="bg-white border rounded-2xl p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-slate-500 text-sm font-medium">{title}</p><span className="bg-emerald-50 text-emerald-800 p-2 rounded-xl"><Icon size={20}/></span></div><p className="text-3xl font-extrabold mt-4 text-slate-900">{value}</p><p className="text-xs text-slate-400 mt-2">{sub}</p></div>)}</div>
  <div className="grid lg:grid-cols-2 gap-4 mt-5"><div className="bg-white border rounded-2xl p-5 shadow-sm"><h3 className="font-bold text-slate-900">Current stock position</h3><p className="text-sm text-slate-500 mt-1">Current stock calculated from all recorded stock movements.</p>{d?.stock?.length?<div className="mt-4 space-y-3">{d.stock.map(s=><div key={s.id} className="border-b pb-3 last:border-0"><div className="flex justify-between gap-4"><div><p className="font-medium text-slate-900">{s.name}</p><p className="text-xs text-slate-400">{s.sku} · {s.grade||s.stock_type.replaceAll('_',' ')}</p></div><p className={`font-semibold whitespace-nowrap ${Number(s.stock_tonnes)<0?'text-red-600':''}`}>{fmt(s.stock_tonnes)} t</p></div></div>)}</div>:<p className="text-slate-400 text-sm mt-5">Create products and record stock movements to see stock here.</p>}</div><div className="bg-slate-950 text-white rounded-2xl p-5 shadow-sm"><h3 className="font-bold text-lg">Daily control checklist</h3><p className="text-slate-300 text-sm mt-1">Keep operational records consistent.</p><div className="mt-5 space-y-4">{[['People','Record attendance for each shift via face/fingerprint kiosk.'],['Production','Enter raw input and finished output.'],['Stock','Reconcile physical stock and movements.'],['Dispatch','Record weighbridge gross and tare weights.'],['Accounts','Match invoices to orders and payments.']].map(([t,s])=><div key={t} className="flex gap-3"><span className="mt-1 rounded-full bg-emerald-500/20 text-emerald-300 p-1 h-fit"><ShieldCheck size={15}/></span><div><p className="font-semibold text-sm">{t}</p><p className="text-slate-300 text-xs mt-1">{s}</p></div></div>)}</div></div></div></div>;
}
function Reports() {
 const [type,setType]=useState('production'),[from,setFrom]=useState(today),[to,setTo]=useState(today),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const types=[['attendance','Attendance'],['production','Production'],['inventory','Inventory movements'],['dispatch','Lorry dispatch'],['accounts','Invoices & receivables']];
 async function preview(e){e?.preventDefault();setBusy(true);setError('');setNotice('');try{setData(await api(`/reports/${type}?from=${from}&to=${to}`))}catch(e){setError(e.message);setData(null)}finally{setBusy(false)}}
  async function download(format){
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const base = '/api';
      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${base}/reports/${type}.${format}?from=${from}&to=${to}`, {
        credentials: 'include',
        headers
      });
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        throw new Error(e.error || `Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vathan-minerals-${type}-${from}-to-${to}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice(`${format.toUpperCase()} report download started.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const cols=data?.rows?.length?Object.keys(data.rows[0]):[];
  return <div><div className="mb-6"><p className="text-cyan-800 font-semibold text-sm">REPORTING CENTRE</p><h2 className="text-3xl font-bold mt-1">Downloadable reports</h2><p className="text-slate-500 mt-2">Filter operational records by date and export a CSV spreadsheet or PDF report.</p></div><form onSubmit={preview} className="bg-white border rounded-2xl p-5"><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><label className="text-sm font-medium">Report type<select value={type} onChange={e=>{setType(e.target.value);setData(null)}} className="block mt-1 w-full border rounded-lg px-3 py-2.5 bg-white">{types.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="text-sm font-medium">From date<input required type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)} className="block mt-1 w-full border rounded-lg px-3 py-2.5"/></label><label className="text-sm font-medium">To date<input required type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} className="block mt-1 w-full border rounded-lg px-3 py-2.5"/></label><div className="flex items-end"><button disabled={busy} className="w-full bg-slate-950 text-white rounded-lg px-4 py-2.5">{busy?'Please wait…':'Preview report'}</button></div></div><div className="flex flex-wrap gap-3 mt-4"><button type="button" disabled={busy} onClick={()=>download('csv')} className="bg-cyan-800 text-white rounded-lg px-4 py-2.5 text-sm font-semibold">Download CSV</button><button type="button" disabled={busy} onClick={()=>download('pdf')} className="border rounded-lg px-4 py-2.5 text-sm font-semibold">Download PDF</button><p className="text-xs text-slate-500 self-center">CSV opens in Excel or LibreOffice. PDF is suitable for printing and sharing.</p></div></form>{error&&<div className="bg-red-50 text-red-700 p-3 rounded-xl mt-4">{error}</div>}{notice&&<div className="bg-cyan-50 text-cyan-900 p-3 rounded-xl mt-4">{notice}</div>}
  <div className="bg-white border rounded-2xl overflow-hidden mt-5"><div className="p-4 border-b flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">Report preview</h3><p className="text-xs text-slate-500 mt-1">{data?`${data.count} records · ${data.from} to ${data.to}`:'Choose a report and select Preview report.'}</p></div>{data&&<span className="text-sm text-slate-500">{types.find(t=>t[0]===data.report)?.[1]}</span>}</div>{!data?<div className="p-10 text-center text-sm text-slate-500">Your filtered rows will appear here.</div>:data.rows.length===0?<div className="p-10 text-center text-sm text-slate-500">No records found for this period. You can still download an empty report.</div>:<div className="overflow-auto max-h-[560px]"><table className="w-full text-sm text-left"><thead className="bg-slate-50 sticky top-0"><tr>{cols.map(c=><th key={c} className="px-4 py-3 whitespace-nowrap font-semibold">{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{data.rows.map((row,i)=><tr key={row.id||i} className="border-t">{cols.map(c=><td key={c} className="px-4 py-3 whitespace-nowrap max-w-64 truncate">{row[c]===null||row[c]===undefined?'—':String(row[c])}</td>)}</tr>)}</tbody></table></div>}</div>
  <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-4 mt-5 text-sm"><strong>Report notes:</strong> Inventory exports show movement transactions, not a historical closing-stock snapshot. Accounts exports calculate payments received up to the report end date for invoices dated in the selected period. Review totals against source records before statutory or tax filing.</div></div>
 }
 export default function App(){
  const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[active,setActive]=useState('Dashboard'),[mobile,setMobile]=useState(false),[error,setError]=useState('');
  
  useEffect(()=>{
    api('/auth/me')
      .then(d=>setUser(d.user))
      .catch(()=>{
        clearAuthToken();
      })
      .finally(()=>setChecking(false));
  },[]);

  function handleLogin(loggedInUser, token) {
    if (token) setAuthToken(token);
    setUser(loggedInUser);
  }

  async function logout(){
    try {
      await api('/auth/logout',{method:'POST'});
    } finally {
      clearAuthToken();
      setUser(null);
    }
  }

  if(checking)return (
    <div className="min-h-screen grid place-items-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-4">
        <VMLogo size={80} />
        <div className="text-center">
          <p className="font-black text-xl tracking-wide text-white">VATHAN MINERALS</p>
          <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mt-1">RLY · KODUR</p>
          <p className="text-xs text-slate-400 mt-2 animate-pulse">Loading Operations & AI Biometrics…</p>
        </div>
      </div>
    </div>
  );
  const [viewMode, setViewMode] = useState('dashboard');
  if(!user)return <Auth onLogin={handleLogin}/>;
  const isProp = Boolean(
    user?.role === 'admin' ||
    (user?.name && user.name.toLowerCase().includes('subbaiah')) ||
    (user?.email && (user.email.toLowerCase().includes('subbaiah') || user.email.includes('vathanminerals6336') || user.email.includes('owner.proprietor')))
  );
  const isManagerUser = Boolean(
    user?.role === 'manager' ||
    ['009', '010', 'B-001', '002', '005'].includes(user?.employee_code) ||
    user?.job_title?.toLowerCase().includes('manager') ||
    user?.job_title?.toLowerCase().includes('supervisor') ||
    user?.job_title?.toLowerCase().includes('incharge')
  );
  const isManagerOnly = !isProp && (isManagerUser || user?.role === 'manager');
  const displayName = isProp ? 'MADDELA VENKATA SUBBAIAH' : user.name;
  
  useEffect(() => {
    if (!isProp && active !== 'Attendance') {
      setActive('Attendance');
    }
  }, [isProp, active]);

  if (user.role === 'staff' && !isProp && !isManagerUser) {
    return <StaffPortal user={user} onLogout={logout} />;
  }

  if (viewMode === 'staff_portal') {
    return <StaffPortal user={user} onLogout={logout} onBack={() => setViewMode('dashboard')} />;
  }

  const visibleNav = isProp 
    ? nav 
    : nav.filter(([label]) => label === 'Attendance');

  const currentActiveTitle = !isProp 
    ? 'Attendance' 
    : active;

  const module=Object.keys(configs).find(k=>configs[k].title===active);
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-white flex flex-col transition-transform ${mobile?'translate-x-0':'-translate-x-full'} lg:translate-x-0 shadow-2xl`}>
        {/* Sidebar Brand Header with Logo */}
        <div className="h-24 flex items-center justify-between px-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <VMLogo size={46} />
            <div>
              <p className="font-black text-sm text-white tracking-wide">VATHAN MINERALS</p>
              <p className="text-[11px] font-bold text-emerald-400 tracking-wider">RLY · KODUR</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white p-1" onClick={()=>setMobile(false)}>
            <X size={18}/>
          </button>
        </div>

        {/* Workspace Navigation */}
        <nav className="p-3 flex-1 overflow-y-auto space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold px-3 py-2">
            {isManagerOnly ? 'Attendance Access Only' : 'Workspace'}
          </p>
          {visibleNav.map(([label,path,Icon])=>(
            <button
              key={label}
              onClick={()=>{setActive(label);setMobile(false)}}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                currentActiveTitle===label ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18}/>{label}
            </button>
          ))}

          {/* Proprietors & Governance Badge in Sidebar */}
          <div className="pt-4 px-1 pb-2">
            <LeadershipBadge compact={true} dark={true} />
          </div>

          {isProp && (
            <div className="pt-2 px-1">
              <button
                onClick={() => setViewMode('staff_portal')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/20 transition"
              >
                <span className="flex items-center gap-2"><FileText size={15}/> Personal Salary & Slips</span>
                <ArrowRight size={13}/>
              </button>
            </div>
          )}
        </nav>

        {/* User Profile & Sign Out */}
        <div className="p-4 border-t border-white/10 bg-slate-950/90">
          <div className="text-sm font-bold truncate text-white">{displayName}</div>
          <div className="text-[11px] font-black uppercase tracking-wider text-emerald-400 mt-0.5">
            {isProp 
              ? 'Proprietor & Admin (Prop Account)' 
              : isManagerOnly 
                ? 'Plant Manager (Attendance Officer)' 
                : `${user.role} Account`}
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-red-400 transition"
          >
            <LogOut size={14}/> Sign out
          </button>
        </div>
      </aside>

      {mobile && <button aria-label="Close menu" className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-xs" onClick={()=>setMobile(false)}/>}

      <main className="lg:ml-64 min-h-screen">
        <header className="h-20 bg-white border-b flex items-center justify-between px-5 sm:px-8 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3.5">
            <button onClick={()=>setMobile(true)} className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg">
              <Menu size={20}/>
            </button>
            <div className="hidden sm:block">
              <VMLogo size={38} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                VATHAN MINERALS · RLY. KODUR / {currentActiveTitle}
              </p>
              <h1 className="font-black text-lg text-slate-900">{currentActiveTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-black tracking-tight text-slate-900">{displayName}</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block self-end mt-0.5">
                {isProp 
                  ? 'Proprietor & Admin (Prop Account)' 
                  : isManagerOnly 
                    ? 'Plant Manager (Attendance Officer)' 
                    : user.role}
              </span>
            </div>
            <span className="hidden sm:block text-xs font-medium text-slate-400 border-l pl-3 ml-1">
              {new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
            </span>
            <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 grid place-items-center font-black text-sm shadow-xs">
              {displayName.slice(0,1).toUpperCase()}
            </span>
          </div>
        </header>

        <div className="p-5 sm:p-8 max-w-[1600px] mx-auto">
          {!isProp ? (
            <AttendanceManager user={user}/>
          ) : (
            active==='Dashboard'?<Dashboard user={user} onNavigate={setActive}/>:
            active==='Reports'?<Reports/>:
            active==='Attendance'?<AttendanceManager user={user}/>:
            active==='Mantra Device'?<AttendanceManager user={user} initialTab="fingerprint"/>:
            active==='Leave Approvals'?<LeaveApprovalManager/>:
            active==='Staff Salaries'?<SalariesManager/>:
            (active==='3D Mining View' || active==='Plant 3D View')?<div className="p-4 sm:p-6 bg-slate-950 rounded-3xl shadow-xl"><PlantShowcase3D /></div>:
            module?<Module key={module} module={module} role={user.role}/>:<div>Unknown page</div>
          )}
        </div>
      </main>
    </div>
  );
 }
