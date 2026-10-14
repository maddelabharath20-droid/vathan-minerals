import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import AttendanceManager from './AttendanceManager';
import VMLogo, { LeadershipBadge } from './VMLogo';
import { LayoutDashboard, Users, Factory, Package, ClipboardList, ReceiptText, Truck, ChartNoAxesCombined, LogOut, Menu, X, Plus, RefreshCw, ShieldCheck, Boxes, UserRound, FileText, ScanFace, UserPlus } from 'lucide-react';

const nav = [
  ['Dashboard','/dashboard',LayoutDashboard],
  ['Employees','/employees',Users],
  ['Attendance','/attendance',ScanFace],
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
 employees:{title:'Employees',endpoint:'/employees',fields:[['employee_code','Employee code'],['full_name','Full name'],['phone','Phone'],['job_title','Job title'],['date_joined','Date joined','date']]},
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
 function Auth({onLogin}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@vathanminerals.com');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('manager');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rolesList = [
    ['manager', 'Operations Manager'],
    ['hr', 'HR & People'],
    ['production', 'Production & Milling'],
    ['dispatch', 'Logistics & Dispatch'],
    ['accounts', 'Finance & Billing'],
    ['admin', 'System Administrator']
  ];

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const endpoint = isSignUp ? '/auth/signup' : '/auth/login';
      const payload = isSignUp ? { name, email, password, role } : { email, password };
      const d = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      onLogin(d.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white">
      <div className="hidden md:flex bg-slate-950 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div>
          <VMLogo size={72} showText={true} textVariant="light" />
        </div>

        <div className="my-auto py-8">
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Operations & Biometric AI Platform · Rly. Kodur
          </p>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mt-3 text-white">
            Mining, Processing & Plant Operations.
          </h1>
          <p className="text-slate-300 mt-4 max-w-md text-sm leading-relaxed">
            Integrated management for face & fingerprint biometric attendance, mineral production, stock reconciliation, lorry weighbridge dispatches and invoicing.
          </p>

          {/* Official Proprietor Card */}
          <div className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur max-w-md">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                Proprietor & Managing Director
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                Rly. Kodur, A.P.
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold text-white tracking-wide">MADDELA VENKATA SUBBAIAH</p>
                <p className="text-xs text-emerald-400 font-semibold">Managing Director (MD) & Proprietor</p>
              </div>
              <span className="text-[11px] font-extrabold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-lg">
                MD
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
          <p>© VATHAN MINERALS · All Rights Reserved</p>
          <p>Railway Kodur Barytes Hub</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-3 mb-6">
            <VMLogo size={46} showText={true} textVariant="dark" />
          </div>

          <div className="flex items-center justify-between mb-6">
            <ShieldCheck className="text-cyan-700" size={38} />
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(''); }}
                className={`px-3 py-1.5 rounded-lg transition ${!isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(''); }}
                className={`px-3 py-1.5 rounded-lg transition ${isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <h2 className="text-3xl font-bold mt-2 text-slate-900">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-slate-500 mt-1 mb-6 text-sm">
            {isSignUp ? 'Join the VATHAN MINERALS operational portal.' : 'Sign in to access your company dashboard.'}
          </p>

          {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm border border-red-200">{error}</div>}

          {isSignUp && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
              <input
                className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                required
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
            <input
              className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@vathanminerals.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <input
              className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-600 text-sm"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
            {isSignUp && <p className="text-[11px] text-slate-400 mt-1">Must be at least 6 characters</p>}
          </div>

          {isSignUp && (
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department / Role</label>
              <select
                className="w-full border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-600 text-sm bg-white"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                {rolesList.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <button
            disabled={busy}
            className="w-full bg-slate-950 hover:bg-slate-800 text-white rounded-xl py-3 font-bold text-sm disabled:opacity-60 transition shadow-lg mt-2"
          >
            {busy ? (isSignUp ? 'Creating Account…' : 'Signing In…') : (isSignUp ? 'Create Staff Account' : 'Sign In Securely')}
          </button>

          <div className="mt-6 text-center text-xs text-slate-500">
            {isSignUp ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(false); setError(''); }}
                  className="text-cyan-800 font-bold hover:underline"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p>
                Need a new user account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setError(''); }}
                  className="text-cyan-800 font-bold hover:underline"
                >
                  Sign Up
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
 }
function Field({field,value,onChange}) {
 const [key,label,type='text',options]=field;
 const selectOpts = Array.isArray(options) ? options : [];
 const scalarValue = typeof value === 'object' ? '' : (value ?? '');
 if(type==='select')return <label className="block text-sm"><span className="block font-medium text-slate-600 mb-1.5">{label}</span><select className="w-full border rounded-lg px-3 py-2.5 bg-white" value={scalarValue || selectOpts[0] || ''} onChange={e=>onChange(key,e.target.value)}>{selectOpts.map(o=><option key={o} value={o}>{o}</option>)}</select></label>;
 return <label className="block text-sm"><span className="block font-medium text-slate-600 mb-1.5">{label}</span><input className="w-full border rounded-lg px-3 py-2.5" type={type} value={scalarValue} onChange={e=>onChange(key,e.target.value)} /></label>;
}
function Module({module,role}) {
 const cfg=configs[module], [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[show,setShow]=useState(false),[saving,setSaving]=useState(false),[form,setForm]=useState({});
 async function load(){setLoading(true);try{setRows(await api(cfg.endpoint));setError('')}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[module]);
 function change(k,v){setForm(p=>({...p,[k]:v}))}
 async function save(e){e.preventDefault();setSaving(true);setError('');try{const payload={...form};for(const f of cfg.fields){if(f[2]==='number'&&payload[f[0]]!=='')payload[f[0]]=Number(payload[f[0]]);if(payload[f[0]]==='')delete payload[f[0]];}await api(cfg.endpoint,{method:'POST',body:JSON.stringify(payload)});setShow(false);setForm({});await load()}catch(e){setError(e.message)}finally{setSaving(false)}}
 const cols=rows.length?Object.keys(rows[0]).filter(k=>!['created_at','created_by','password_hash','face_photo','face_descriptor','face_snapshot'].includes(k)).slice(0,7):[];
 return <div><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"><div><h2 className="text-2xl font-bold">{cfg.title}</h2><p className="text-slate-500 text-sm mt-1">View and add company records.</p></div><div className="flex gap-2"><button onClick={load} className="border bg-white rounded-xl px-3 py-2.5"><RefreshCw size={17}/></button><button onClick={()=>setShow(!show)} className="bg-slate-950 text-white rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-semibold"><Plus size={17}/> Add record</button></div></div>
 {error&&<div className="mb-4 rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div>}
 {show&&<form onSubmit={save} className="bg-white border rounded-2xl p-5 mb-6"><h3 className="font-semibold mb-4">New record</h3><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{cfg.fields.map(f=>{const def = f[2]==='select' ? (Array.isArray(f[3]) ? f[3][0] : '') : (typeof f[3]==='string' ? f[3] : ''); return <Field key={f[0]} field={f} value={form[f[0]] ?? def} onChange={change}/>;})}</div><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={()=>setShow(false)} className="border rounded-lg px-4 py-2">Cancel</button><button disabled={saving} className="bg-cyan-800 text-white rounded-lg px-4 py-2">{saving?'Saving…':'Save record'}</button></div></form>}
 <div className="bg-white border rounded-2xl overflow-hidden"><div className="p-4 border-b flex justify-between"><span className="font-semibold">Recent records</span><span className="text-sm text-slate-500">{rows.length} shown</span></div>{loading?<div className="p-8 text-center text-slate-500">Loading records…</div>:rows.length===0?<div className="p-10 text-center"><Package className="mx-auto text-slate-300" size={34}/><p className="font-semibold mt-3">No records yet</p><p className="text-sm text-slate-500 mt-1">Add your first record to get started.</p></div>:<div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500"><tr>{cols.map(c=><th key={c} className="px-4 py-3 font-semibold whitespace-nowrap">{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i} className="border-t hover:bg-slate-50">{cols.map(c=><td key={c} className="px-4 py-3 whitespace-nowrap max-w-64 truncate">{typeof r[c]==='number'?fmt(r[c]):String(r[c]??'—')}</td>)}</tr>)}</tbody></table></div>}</div>
 <p className="text-xs text-slate-400 mt-3">IDs are shown for related records. Use the ID from the relevant table when linking records.</p></div>;
}
function Dashboard({user}) {
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
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Barytes Processing Hub
            </span>
            <span className="text-xs text-slate-400 font-semibold">RLY · KODUR</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
            VATHAN MINERALS
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            High Grade Barytes Ore Milling, Micronised Powder & Logistics Operations
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
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Managing Director & Proprietor</p>
            <p className="text-sm sm:text-base font-black text-white truncate">MADDELA VENKATA SUBBAIAH</p>
            <p className="text-[11px] text-slate-300 font-medium">VATHAN MINERALS · Rly. Kodur</p>
          </div>
        </div>
      </div>
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
  async function download(format){setBusy(true);setError('');setNotice('');try{const base=import.meta.env.VITE_API_URL||(import.meta.env.PROD?'/api':'http://localhost:4000/api');const response=await fetch(`${base}/reports/${type}.${format}?from=${from}&to=${to}`,{credentials:'include'});if(!response.ok){const e=await response.json().catch(()=>({}));throw new Error(e.error||`Download failed (${response.status})`)}const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`vathan-minerals-${type}-${from}-to-${to}.${format}`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);setNotice(`${format.toUpperCase()} report download started.`)}catch(e){setError(e.message)}finally{setBusy(false)}}
  const cols=data?.rows?.length?Object.keys(data.rows[0]):[];
  return <div><div className="mb-6"><p className="text-cyan-800 font-semibold text-sm">REPORTING CENTRE</p><h2 className="text-3xl font-bold mt-1">Downloadable reports</h2><p className="text-slate-500 mt-2">Filter operational records by date and export a CSV spreadsheet or PDF report.</p></div><form onSubmit={preview} className="bg-white border rounded-2xl p-5"><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><label className="text-sm font-medium">Report type<select value={type} onChange={e=>{setType(e.target.value);setData(null)}} className="block mt-1 w-full border rounded-lg px-3 py-2.5 bg-white">{types.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="text-sm font-medium">From date<input required type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)} className="block mt-1 w-full border rounded-lg px-3 py-2.5"/></label><label className="text-sm font-medium">To date<input required type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} className="block mt-1 w-full border rounded-lg px-3 py-2.5"/></label><div className="flex items-end"><button disabled={busy} className="w-full bg-slate-950 text-white rounded-lg px-4 py-2.5">{busy?'Please wait…':'Preview report'}</button></div></div><div className="flex flex-wrap gap-3 mt-4"><button type="button" disabled={busy} onClick={()=>download('csv')} className="bg-cyan-800 text-white rounded-lg px-4 py-2.5 text-sm font-semibold">Download CSV</button><button type="button" disabled={busy} onClick={()=>download('pdf')} className="border rounded-lg px-4 py-2.5 text-sm font-semibold">Download PDF</button><p className="text-xs text-slate-500 self-center">CSV opens in Excel or LibreOffice. PDF is suitable for printing and sharing.</p></div></form>{error&&<div className="bg-red-50 text-red-700 p-3 rounded-xl mt-4">{error}</div>}{notice&&<div className="bg-cyan-50 text-cyan-900 p-3 rounded-xl mt-4">{notice}</div>}
  <div className="bg-white border rounded-2xl overflow-hidden mt-5"><div className="p-4 border-b flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">Report preview</h3><p className="text-xs text-slate-500 mt-1">{data?`${data.count} records · ${data.from} to ${data.to}`:'Choose a report and select Preview report.'}</p></div>{data&&<span className="text-sm text-slate-500">{types.find(t=>t[0]===data.report)?.[1]}</span>}</div>{!data?<div className="p-10 text-center text-sm text-slate-500">Your filtered rows will appear here.</div>:data.rows.length===0?<div className="p-10 text-center text-sm text-slate-500">No records found for this period. You can still download an empty report.</div>:<div className="overflow-auto max-h-[560px]"><table className="w-full text-sm text-left"><thead className="bg-slate-50 sticky top-0"><tr>{cols.map(c=><th key={c} className="px-4 py-3 whitespace-nowrap font-semibold">{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{data.rows.map((row,i)=><tr key={row.id||i} className="border-t">{cols.map(c=><td key={c} className="px-4 py-3 whitespace-nowrap max-w-64 truncate">{row[c]===null||row[c]===undefined?'—':String(row[c])}</td>)}</tr>)}</tbody></table></div>}</div>
  <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-4 mt-5 text-sm"><strong>Report notes:</strong> Inventory exports show movement transactions, not a historical closing-stock snapshot. Accounts exports calculate payments received up to the report end date for invoices dated in the selected period. Review totals against source records before statutory or tax filing.</div></div>
 }
 export default function App(){
  const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[active,setActive]=useState('Dashboard'),[mobile,setMobile]=useState(false),[error,setError]=useState('');
  useEffect(()=>{api('/auth/me').then(d=>setUser(d.user)).catch(()=>{}).finally(()=>setChecking(false))},[]);
  async function logout(){try{await api('/auth/logout',{method:'POST'})}finally{setUser(null)}}
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
  if(!user)return <Auth onLogin={setUser}/>;
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
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold px-3 py-2">Workspace</p>
          {nav.map(([label,path,Icon])=>(
            <button
              key={label}
              onClick={()=>{setActive(label);setMobile(false)}}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                active===label ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18}/>{label}
            </button>
          ))}

          {/* Proprietors & Governance Badge in Sidebar */}
          <div className="pt-4 px-1 pb-2">
            <LeadershipBadge compact={true} dark={true} />
          </div>
        </nav>

        {/* User Profile & Sign Out */}
        <div className="p-4 border-t border-white/10 bg-slate-950/90">
          <div className="text-sm font-bold truncate text-white">{user.name}</div>
          <div className="text-xs text-emerald-400 capitalize mt-0.5">{user.role} Account</div>
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
                VATHAN MINERALS · RLY. KODUR / {active}
              </p>
              <h1 className="font-black text-lg text-slate-900">{active}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800">{user.name}</span>
              <span className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider">{user.role}</span>
            </div>
            <span className="hidden sm:block text-xs font-medium text-slate-400 border-l pl-3 ml-1">
              {new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
            </span>
            <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 grid place-items-center font-black text-sm shadow-xs">
              {user.name.slice(0,1).toUpperCase()}
            </span>
          </div>
        </header>

        <div className="p-5 sm:p-8 max-w-[1600px] mx-auto">
          {active==='Dashboard'?<Dashboard user={user}/>:active==='Reports'?<Reports/>:active==='Attendance'?<AttendanceManager user={user}/>:module?<Module key={module} module={module} role={user.role}/>:<div>Unknown page</div>}
        </div>
      </main>
    </div>
  );
 }
