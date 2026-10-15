import React, { useState, useEffect } from 'react';
import { api } from './api';
import { 
  DollarSign, CheckCircle2, Clock, Printer, RefreshCw, 
  Search, Plus, ShieldCheck, ArrowUpRight, TrendingUp,
  Pencil, Trash2, X, AlertCircle, Check
} from 'lucide-react';

export default function SalariesManager() {
  const [salaries, setSalaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [txnInput, setTxnInput] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSalary, setEditingSalary] = useState(null);
  const [saving, setSaving] = useState(false);

  // Add Form State
  const [addForm, setAddForm] = useState({
    employee_id: '',
    month_year: '2026-10',
    basic_salary: '',
    allowances: 0,
    deductions: 0,
    payment_status: 'pending',
    payment_method: 'Bank Transfer (NEFT/IMPS)',
    payment_date: '',
    transaction_ref: '',
    notes: ''
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    basic_salary: 0,
    allowances: 0,
    deductions: 0,
    payment_status: 'pending',
    payment_method: 'Bank Transfer (NEFT/IMPS)',
    payment_date: '',
    transaction_ref: '',
    notes: ''
  });

  async function loadEmployees() {
    try {
      const list = await api('/employees');
      const activeEmps = list.filter(e => e.active !== 0);
      setEmployees(activeEmps);
      if (activeEmps.length > 0 && !addForm.employee_id) {
        setAddForm(prev => ({ ...prev, employee_id: activeEmps[0].id }));
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }

  async function loadSalaries() {
    try {
      setLoading(true);
      const data = await api(`/salaries?month_year=${selectedMonth}`);
      setSalaries(data);
      setError('');
    } catch (err) {
      console.error('Failed to load salaries:', err);
      setError(err.message || 'Failed to load salaries list');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSalaries();
    loadEmployees();
  }, [selectedMonth]);

  function openAddModal() {
    setAddForm({
      employee_id: employees[0]?.id || '',
      month_year: selectedMonth,
      basic_salary: '',
      allowances: 0,
      deductions: 0,
      payment_status: 'pending',
      payment_method: 'Bank Transfer (NEFT/IMPS)',
      payment_date: '',
      transaction_ref: '',
      notes: ''
    });
    setError('');
    setShowAddModal(true);
  }

  function openEditModal(salary) {
    setEditingSalary(salary);
    setEditForm({
      basic_salary: Number(salary.basic_salary || 0),
      allowances: Number(salary.allowances || 0),
      deductions: Number(salary.deductions || 0),
      payment_status: salary.payment_status || 'pending',
      payment_method: salary.payment_method || 'Bank Transfer (NEFT/IMPS)',
      payment_date: salary.payment_date ? String(salary.payment_date).slice(0, 10) : '',
      transaction_ref: salary.transaction_ref || '',
      notes: salary.notes || ''
    });
    setError('');
  }

  async function handleAddSalary(e) {
    e.preventDefault();
    if (!addForm.employee_id) {
      setError('Please select an employee');
      return;
    }
    if (addForm.basic_salary === '' || Number(addForm.basic_salary) < 0) {
      setError('Please enter a valid basic salary');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        employee_id: Number(addForm.employee_id),
        month_year: addForm.month_year || selectedMonth,
        basic_salary: Number(addForm.basic_salary),
        allowances: Number(addForm.allowances || 0),
        deductions: Number(addForm.deductions || 0),
        payment_status: addForm.payment_status,
        payment_method: addForm.payment_method,
        payment_date: addForm.payment_date || (addForm.payment_status === 'paid' ? new Date().toISOString().slice(0, 10) : null),
        transaction_ref: addForm.transaction_ref || null,
        notes: addForm.notes || null
      };

      await api('/salaries', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowAddModal(false);
      setSuccess('Salary record created successfully!');
      setTimeout(() => setSuccess(''), 4000);
      await loadSalaries();
    } catch (err) {
      setError(err.message || 'Failed to save salary record');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingSalary) return;
    if (editForm.basic_salary === '' || Number(editForm.basic_salary) < 0) {
      setError('Please enter a valid basic salary');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        basic_salary: Number(editForm.basic_salary),
        allowances: Number(editForm.allowances || 0),
        deductions: Number(editForm.deductions || 0),
        payment_status: editForm.payment_status,
        payment_method: editForm.payment_method,
        payment_date: editForm.payment_date || (editForm.payment_status === 'paid' ? new Date().toISOString().slice(0, 10) : null),
        transaction_ref: editForm.transaction_ref || null,
        notes: editForm.notes || null
      };

      await api(`/salaries/${editingSalary.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setEditingSalary(null);
      setSuccess('Salary record updated successfully!');
      setTimeout(() => setSuccess(''), 4000);
      await loadSalaries();
    } catch (err) {
      setError(err.message || 'Failed to update salary record');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSalary(salary) {
    const confirmMsg = `Are you sure you want to delete the salary record for ${salary.full_name} (${salary.month_year})?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(salary.id);
    setError('');
    try {
      await api(`/salaries/${salary.id}`, { method: 'DELETE' });
      setSuccess('Salary record deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      await loadSalaries();
    } catch (err) {
      setError(err.message || 'Failed to delete salary record');
    } finally {
      setDeletingId(null);
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      setUpdatingId(id);
      const txn = txnInput[id] || (newStatus === 'paid' ? `VM-NEFT-${Date.now().toString().slice(-6)}` : null);
      await api(`/salaries/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          payment_status: newStatus,
          transaction_ref: txn,
          payment_date: new Date().toISOString().slice(0, 10)
        })
      });
      await loadSalaries();
    } catch (err) {
      alert(err.message || 'Failed to update salary payment status');
    } finally {
      setUpdatingId(null);
    }
  }

  const totalPayroll = salaries.reduce((acc, s) => acc + Number(s.net_salary || 0), 0);
  const totalPaid = salaries.filter(s => s.payment_status === 'paid').reduce((acc, s) => acc + Number(s.net_salary || 0), 0);
  const totalPending = salaries.filter(s => s.payment_status !== 'paid').reduce((acc, s) => acc + Number(s.net_salary || 0), 0);

  // Computed net previews
  const addNetPreview = Math.max(0, Number(addForm.basic_salary || 0) + Number(addForm.allowances || 0) - Number(addForm.deductions || 0));
  const editNetPreview = Math.max(0, Number(editForm.basic_salary || 0) + Number(editForm.allowances || 0) - Number(editForm.deductions || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign size={24} className="text-emerald-600" />
            Staff Salaries & Payroll Management
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Disburse employee wages, record bank transfers, add, and edit monthly staff payroll.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <select
            value={selectedMonth}
            onChange={e => {
              setSelectedMonth(e.target.value);
              setAddForm(prev => ({ ...prev, month_year: e.target.value }));
            }}
            className="border rounded-xl px-3 py-2 text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
          >
            <option value="2026-10">October 2026 (Current)</option>
            <option value="2026-09">September 2026</option>
            <option value="2026-08">August 2026</option>
            <option value="2026-07">July 2026</option>
            <option value="2026-06">June 2026</option>
          </select>
          <button
            onClick={loadSalaries}
            title="Refresh list"
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAddModal}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus size={15} /> Add Salary Record
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2 font-medium">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2 font-bold">
          <Check size={18} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Monthly Payroll</span>
          <p className="text-2xl font-black text-slate-900 mt-1">₹{totalPayroll.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-0.5">{salaries.length} Staff Members recorded</p>
        </div>

        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total Disbursed (Paid)</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">₹{totalPaid.toLocaleString('en-IN')}</p>
          <p className="text-xs text-emerald-600 font-medium mt-0.5">
            {salaries.filter(s => s.payment_status === 'paid').length} Paid
          </p>
        </div>

        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending Disbursement</span>
          <p className="text-2xl font-black text-amber-700 mt-1">₹{totalPending.toLocaleString('en-IN')}</p>
          <p className="text-xs text-amber-600 font-medium mt-0.5">
            {salaries.filter(s => s.payment_status !== 'paid').length} In Queue
          </p>
        </div>
      </div>

      {/* Salaries Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">Staff Payroll Details ({selectedMonth})</h3>
            <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
              {salaries.length} records
            </span>
          </div>
          <button
            onClick={() => window.print()}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            <Printer size={14} /> Print Summary
          </button>
        </div>

        {salaries.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign size={40} className="mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700">No salary records for {selectedMonth}</p>
            <p className="text-xs text-slate-500 mt-1">Click "Add Salary Record" above to create payroll entries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Basic Pay</th>
                  <th className="py-3 px-4">Allowances</th>
                  <th className="py-3 px-4">Deductions</th>
                  <th className="py-3 px-4">Net Salary</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Txn Ref / Details</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {salaries.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{s.full_name}</p>
                      <p className="text-[11px] text-slate-500">{s.employee_code} · {s.job_title}</p>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">₹{Number(s.basic_salary).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-emerald-600 font-semibold">+₹{Number(s.allowances).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-red-500 font-semibold">-₹{Number(s.deductions).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-900 text-sm">₹{Number(s.net_salary).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        s.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        s.payment_status === 'processing' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {s.payment_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {s.transaction_ref ? (
                        <div className="font-mono text-slate-800 font-medium">{s.transaction_ref}</div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Txn ID..."
                          value={txnInput[s.id] || ''}
                          onChange={e => setTxnInput({ ...txnInput, [s.id]: e.target.value })}
                          className="border rounded px-2 py-0.5 text-[11px] w-28 outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      )}
                      {s.payment_method && (
                        <div className="text-[10px] text-slate-400 mt-0.5">{s.payment_method}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Mark Paid / Reopen */}
                        {s.payment_status !== 'paid' ? (
                          <button
                            disabled={updatingId === s.id}
                            onClick={() => updateStatus(s.id, 'paid')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs transition shadow-xs"
                          >
                            {updatingId === s.id ? '…' : 'Mark Paid'}
                          </button>
                        ) : (
                          <button
                            disabled={updatingId === s.id}
                            onClick={() => updateStatus(s.id, 'processing')}
                            className="text-slate-400 hover:text-slate-600 text-[11px] underline px-1.5 py-1"
                          >
                            Reopen
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(s)}
                          title="Edit Salary & Amounts"
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Pencil size={15} />
                        </button>

                        {/* Delete Button */}
                        <button
                          disabled={deletingId === s.id}
                          onClick={() => handleDeleteSalary(s)}
                          title="Delete Salary"
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

      {/* ADD SALARY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border shadow-2xl max-w-xl w-full p-6 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Plus size={20} className="text-emerald-600" />
                  Add New Staff Salary Record
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Assign salary disbursements, allowances, and payment details.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSalary} className="mt-5 space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Employee *</label>
                <select
                  required
                  value={addForm.employee_id}
                  onChange={e => setAddForm({ ...addForm, employee_id: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code} - {emp.job_title || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Month / Year */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Month-Year (YYYY-MM) *</label>
                <input
                  type="text"
                  required
                  placeholder="2026-10"
                  pattern="^\d{4}-\d{2}$"
                  value={addForm.month_year}
                  onChange={e => setAddForm({ ...addForm, month_year: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Basic, Allowances, Deductions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Basic Pay (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="25000"
                    value={addForm.basic_salary}
                    onChange={e => setAddForm({ ...addForm, basic_salary: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Allowances (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="2000"
                    value={addForm.allowances}
                    onChange={e => setAddForm({ ...addForm, allowances: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm text-emerald-700 font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="500"
                    value={addForm.deductions}
                    onChange={e => setAddForm({ ...addForm, deductions: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm text-red-600 font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Net Salary Preview Banner */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Calculated Net Salary:</span>
                <span className="text-lg font-black text-emerald-700">₹{addNetPreview.toLocaleString('en-IN')}</span>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Status</label>
                  <select
                    value={addForm.payment_status}
                    onChange={e => setAddForm({ ...addForm, payment_status: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={addForm.payment_method}
                    onChange={e => setAddForm({ ...addForm, payment_method: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date (Optional)</label>
                  <input
                    type="date"
                    value={addForm.payment_date}
                    onChange={e => setAddForm({ ...addForm, payment_date: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Ref / UTR</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR12345678"
                    value={addForm.transaction_ref}
                    onChange={e => setAddForm({ ...addForm, transaction_ref: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={addForm.notes}
                  onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="border rounded-xl px-4 py-2 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-5 py-2 text-sm font-bold shadow-sm disabled:opacity-50 transition"
                >
                  {saving ? 'Saving Record…' : 'Save Salary Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SALARY MODAL */}
      {editingSalary && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border shadow-2xl max-w-xl w-full p-6 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Pencil size={18} className="text-blue-600" />
                  Edit Salary: {editingSalary.full_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Code: <span className="font-semibold text-slate-700">{editingSalary.employee_code}</span> · Period: <span className="font-semibold text-slate-700">{editingSalary.month_year}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSalary(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              {/* Basic, Allowances, Deductions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Basic Pay (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editForm.basic_salary}
                    onChange={e => setEditForm({ ...editForm, basic_salary: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Allowances (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.allowances}
                    onChange={e => setEditForm({ ...editForm, allowances: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm text-emerald-700 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.deductions}
                    onChange={e => setEditForm({ ...editForm, deductions: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm text-red-600 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Net Salary Preview Banner */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Recalculated Net Salary:</span>
                <span className="text-lg font-black text-blue-700">₹{editNetPreview.toLocaleString('en-IN')}</span>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Status</label>
                  <select
                    value={editForm.payment_status}
                    onChange={e => setEditForm({ ...editForm, payment_status: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={editForm.payment_method}
                    onChange={e => setEditForm({ ...editForm, payment_method: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={editForm.payment_date}
                    onChange={e => setEditForm({ ...editForm, payment_date: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Ref / UTR</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR12345678"
                    value={editForm.transaction_ref}
                    onChange={e => setEditForm({ ...editForm, transaction_ref: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingSalary(null)}
                  className="border rounded-xl px-4 py-2 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2 text-sm font-bold shadow-sm disabled:opacity-50 transition"
                >
                  {saving ? 'Updating Salary…' : 'Save Salary Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
