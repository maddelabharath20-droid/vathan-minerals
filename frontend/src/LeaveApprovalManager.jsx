import React, { useState, useEffect } from 'react';
import { api } from './api';
import { 
  CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, 
  Search, Filter, ShieldCheck, User, Calendar
} from 'lucide-react';

export default function LeaveApprovalManager() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
  const [search, setSearch] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [message, setMessage] = useState('');

  async function loadLeaves() {
    try {
      setLoading(true);
      const data = await api('/leave-requests');
      setLeaves(data);
    } catch (err) {
      console.error('Failed to load leave requests:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaves();
  }, []);

  async function updateLeaveStatus(id, newStatus) {
    try {
      setActionInProgress(id);
      setMessage('');
      const note = reviewNotes[id] || (newStatus === 'approved' ? 'Approved by Operations Management.' : 'Declined per plant operational requirement.');
      
      await api(`/leave-requests/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: newStatus,
          review_notes: note
        })
      });

      setMessage(`Leave request #${id} has been ${newStatus}. Attendance records updated.`);
      await loadLeaves();
    } catch (err) {
      alert(err.message || 'Failed to update leave status');
    } finally {
      setActionInProgress(null);
    }
  }

  const filteredLeaves = leaves.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.full_name?.toLowerCase().includes(q) ||
        l.employee_code?.toLowerCase().includes(q) ||
        l.job_title?.toLowerCase().includes(q) ||
        l.leave_type?.toLowerCase().includes(q) ||
        l.reason?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const approvedCount = leaves.filter(l => l.status === 'approved').length;
  const rejectedCount = leaves.filter(l => l.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock size={24} className="text-emerald-600" />
            Staff Leave Approval & Management
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Review, approve, or decline employee leave applications. Approved leaves automatically sync with plant attendance.
          </p>
        </div>

        <button
          onClick={loadLeaves}
          className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 self-start sm:self-auto transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-2xl flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div 
          onClick={() => setFilter('all')}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            filter === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-800 border-slate-200'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${filter === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>Total Requests</span>
          <p className="text-2xl font-extrabold mt-1">{leaves.length}</p>
        </div>

        <div 
          onClick={() => setFilter('pending')}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            filter === 'pending' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${filter === 'pending' ? 'text-amber-100' : 'text-amber-700'}`}>Pending Review</span>
          <p className="text-2xl font-extrabold mt-1">{pendingCount}</p>
        </div>

        <div 
          onClick={() => setFilter('approved')}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            filter === 'approved' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-emerald-50 text-emerald-900 border-emerald-200'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${filter === 'approved' ? 'text-emerald-100' : 'text-emerald-700'}`}>Approved</span>
          <p className="text-2xl font-extrabold mt-1">{approvedCount}</p>
        </div>

        <div 
          onClick={() => setFilter('rejected')}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            filter === 'rejected' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${filter === 'rejected' ? 'text-red-100' : 'text-red-700'}`}>Declined</span>
          <p className="text-2xl font-extrabold mt-1">{rejectedCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee, designation, reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs font-semibold">
          <span className="text-slate-400 mr-1 flex items-center gap-1"><Filter size={13}/> Filter:</span>
          {['all', 'pending', 'approved', 'rejected'].map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-lg capitalize transition ${
                filter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Leaves Card List */}
      <div className="space-y-4">
        {filteredLeaves.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
            <Clock size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700 text-sm">No leave requests matching your filter</p>
            <p className="text-xs text-slate-400 mt-1">Select a different filter or check back later.</p>
          </div>
        ) : (
          filteredLeaves.map(leave => (
            <div 
              key={leave.id}
              className={`bg-white rounded-2xl p-5 border transition shadow-sm ${
                leave.status === 'pending' ? 'border-amber-300 ring-1 ring-amber-200/50' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm shadow">
                    {leave.full_name?.charAt(0) || 'E'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-base">{leave.full_name}</h4>
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2 py-0.5 rounded border border-slate-200">
                        {leave.employee_code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{leave.job_title || 'Staff Team'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                    leave.status === 'approved' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                    leave.status === 'rejected' ? 'bg-red-50 text-red-800 border-red-300' :
                    'bg-amber-50 text-amber-900 border-amber-300 animate-pulse'
                  }`}>
                    {leave.status === 'pending' ? '⏳ Pending Approval' : leave.status === 'approved' ? '✓ Approved' : '✕ Declined'}
                  </span>
                </div>
              </div>

              {/* Leave Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Leave Type</span>
                  <span className="font-bold text-slate-900 capitalize">{leave.leave_type} Leave</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Dates Requested</span>
                  <span className="font-bold text-slate-900">{leave.start_date} to {leave.end_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Days Count</span>
                  <span className="font-bold text-emerald-700">{leave.days_count} {leave.days_count === 1 ? 'Day' : 'Days'}</span>
                </div>
              </div>

              {/* Reason */}
              <div className="text-xs text-slate-700 mb-3">
                <span className="font-bold text-slate-900">Reason: </span>
                <span className="italic">"{leave.reason}"</span>
              </div>

              {/* Review notes if already reviewed */}
              {leave.review_notes && (
                <div className={`p-3 rounded-xl text-xs mb-3 border ${
                  leave.status === 'approved' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
                }`}>
                  <span className="font-bold">Manager Review: </span>
                  <span>{leave.review_notes}</span>
                  {leave.reviewer_name && <span className="opacity-75 ml-1">({leave.reviewer_name})</span>}
                </div>
              )}

              {/* Action Buttons for Pending Leaves */}
              {leave.status === 'pending' && (
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    placeholder="Optional manager remark (e.g. Approved, shift adjusted)..."
                    value={reviewNotes[leave.id] || ''}
                    onChange={e => setReviewNotes({ ...reviewNotes, [leave.id]: e.target.value })}
                    className="w-full sm:flex-1 border rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      disabled={actionInProgress === leave.id}
                      onClick={() => updateLeaveStatus(leave.id, 'approved')}
                      className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow"
                    >
                      <CheckCircle2 size={14} /> Approve Leave
                    </button>
                    <button
                      disabled={actionInProgress === leave.id}
                      onClick={() => updateLeaveStatus(leave.id, 'rejected')}
                      className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow"
                    >
                      <XCircle size={14} /> Decline
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
