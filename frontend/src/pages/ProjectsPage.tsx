import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Play,
  Square,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Loader2,
  X,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Project, Client } from '../types';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [manualTimeModalOpen, setManualTimeModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // New Project Form
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('IN_PROGRESS');
  const [billingType, setBillingType] = useState<'FIXED' | 'HOURLY'>('FIXED');
  const [rate, setRate] = useState('100');
  const [budget, setBudget] = useState('5000');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Manual Time Entry Form
  const [timeDescription, setTimeDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const [projRes, clientRes] = await Promise.all([
        apiRequest<{ success: boolean; data: Project[] }>('/projects'),
        apiRequest<{ success: boolean; data: Client[] }>('/clients'),
      ]);
      if (projRes.data) setProjects(projRes.data);
      if (clientRes.data) setClients(clientRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleStartTimer = async (projectId: string) => {
    try {
      await apiRequest(`/projects/${projectId}/timer/start`, { method: 'POST' });
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to start timer');
    }
  };

  const handleStopTimer = async (projectId: string) => {
    try {
      await apiRequest(`/projects/${projectId}/timer/stop`, { method: 'POST' });
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to stop timer');
    }
  };

  const handleLogManualTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    try {
      await apiRequest(`/projects/${selectedProjectId}/time-entry`, {
        method: 'POST',
        body: JSON.stringify({
          description: timeDescription,
          durationMinutes: parseInt(durationMinutes, 10),
        }),
      });
      setManualTimeModalOpen(false);
      setTimeDescription('');
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to log time');
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientId) {
      setFormError('Title and Client are required');
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title,
          clientId,
          description,
          status,
          billingType,
          rate: parseFloat(rate),
          budget: budget ? parseFloat(budget) : null,
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });
      setModalOpen(false);
      fetchProjects();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Move project "${name}" to recycle bin?`)) return;
    try {
      await apiRequest(`/projects/${id}`, { method: 'DELETE' });
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Projects & Time
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track project milestones, timers, and real-time profitability
          </p>
        </div>

        <button
          onClick={() => {
            setTitle('');
            setDescription('');
            setClientId(clients[0]?.id || '');
            setFormError('');
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => {
            const isTimerRunning = Boolean(p.activeTimer);
            return (
              <div
                key={p.id}
                className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        {p.title}
                      </h3>
                      <div className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-0.5">
                        {p.client?.name}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>

                  {p.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{p.description}</p>
                  )}

                  {/* Financials / Profitability stats */}
                  <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Paid</div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        ${p.totalPaid.toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Expenses</div>
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        ${p.totalExpenses.toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Net Profit</div>
                      <div
                        className={`text-xs font-bold ${
                          p.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        ${p.netProfit.toFixed(0)}
                      </div>
                    </div>
                  </div>

                  {/* Time tracking summary */}
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-3 px-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{p.totalHours} hrs logged</span>
                    </div>
                    <div className="font-medium text-slate-700 dark:text-slate-300">
                      {p.billingType === 'HOURLY' ? `$${p.rate}/hr` : `Fixed Budget: $${p.budget || 0}`}
                    </div>
                  </div>
                </div>

                {/* Bottom Timer & Action Buttons */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {isTimerRunning ? (
                    <button
                      onClick={() => handleStopTimer(p.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Timer</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartTimer(p.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 rounded-lg transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Timer</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        setManualTimeModalOpen(true);
                      }}
                      className="p-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      title="Add manual hours"
                    >
                      + Log Time
                    </button>
                    <button
                      onClick={() => handleDeleteProject(p.id, p.title)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Briefcase className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-semibold text-slate-900 dark:text-white">No active projects</h3>
          <p className="text-sm text-slate-500 mt-1">Start tracking client projects, hours, and budgets.</p>
          <button
            onClick={() => {
              setTitle('');
              setDescription('');
              setClientId(clients[0]?.id || '');
              setModalOpen(true);
            }}
            className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl"
          >
            Create Project
          </button>
        </div>
      )}

      {/* New Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Create New Project</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Website Redesign & CMS Integration"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Client *
                </label>
                <select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Billing Type
                  </label>
                  <select
                    value={billingType}
                    onChange={(e) => setBillingType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  >
                    <option value="FIXED">Fixed Budget</option>
                    <option value="HOURLY">Hourly Rate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    {billingType === 'FIXED' ? 'Budget ($)' : 'Hourly Rate ($/hr)'}
                  </label>
                  <input
                    type="number"
                    value={billingType === 'FIXED' ? budget : rate}
                    onChange={(e) => (billingType === 'FIXED' ? setBudget(e.target.value) : setRate(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope of work, deliverables, and targets"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Time Entry Modal */}
      {manualTimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Log Project Time</h3>
              <button onClick={() => setManualTimeModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleLogManualTime} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  required
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="60"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Description of Work
                </label>
                <input
                  type="text"
                  value={timeDescription}
                  onChange={(e) => setTimeDescription(e.target.value)}
                  placeholder="Frontend bug fixes and review"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManualTimeModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg"
                >
                  Log Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
