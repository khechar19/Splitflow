import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, ArrowRight, FolderPlus, X, AlertCircle } from 'lucide-react';
import { useGroups } from '../hooks/useGroups';
import { Profile } from '../types';
import { CURRENCIES } from '../lib/currency';

interface GroupsProps {
  currentProfile: Profile | null;
}

export default function Groups({ currentProfile }: GroupsProps) {
  const navigate = useNavigate();
  const { groups, loading, error, fetchGroups, createGroup } = useGroups();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentProfile) {
      fetchGroups();
    }
  }, [currentProfile, fetchGroups]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!name.trim()) {
      setValidationError('Please enter a group name.');
      return;
    }
    if (!currentProfile) return;

    try {
      setSaving(true);
      const newGroup = await createGroup(name, description, currentProfile.id, currency);
      if (newGroup) {
        setIsModalOpen(false);
        setName('');
        setDescription('');
        setCurrency('USD');
        fetchGroups(); // Refresh
        // Navigate to the newly created group page
        navigate(`/group/${newGroup.id}`);
      }
    } catch (err: any) {
      setValidationError(err.message || 'Failed to create group.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Groups</h1>
          <p className="text-gray-400">Manage your expense splitting groups.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-primary hover:bg-indigo-400 text-white px-6 py-2.5 rounded-xl font-medium transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Create Group
        </button>
      </div>

      {loading && groups.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-primary"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>Error loading groups: {error}</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center text-gray-400 flex flex-col items-center justify-center max-w-xl mx-auto mt-10">
          <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mb-6">
            <Users className="w-8 h-8 text-brand-primary" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Groups Yet</h3>
          <p className="text-sm text-gray-400 mb-6">
            Create a group to start splitting expenses with your friends. Add members using their unique handle handles.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-primary hover:bg-indigo-400 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center gap-2"
          >
            <FolderPlus className="w-5 h-5" />
            Get Started
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group.id}
              onClick={() => navigate(`/group/${group.id}`)}
              className="glass-panel p-6 rounded-2xl shadow-glass hover:bg-white/[0.08] hover:border-brand-primary/40 transition-all cursor-pointer group flex flex-col justify-between h-48 border border-white/5"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold group-hover:text-brand-primary transition-colors text-white truncate max-w-[70%]">
                    {group.name}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-400">
                      {group.currency || 'USD'}
                    </span>
                    <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2">{group.description || 'No description provided'}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                  <div className="flex -space-x-1.5">
                    {group.members?.slice(0, 4).map((m) => (
                      <img
                        key={m.id}
                        src={m.avatar_url || `https://ui-avatars.com/api/?name=${m.full_name || 'Member'}&background=random`}
                        alt={m.full_name || ''}
                        className="w-6 h-6 rounded-full border-2 border-brand-bg object-cover"
                        title={m.full_name || m.username}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    {group.members?.length || 0} members
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md rounded-3xl shadow-float p-8 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Create Group</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {validationError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apartment 102 🏠"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description (Optional)</label>
                <textarea
                  placeholder="What is this group for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Group Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full glass-input px-4 py-3 rounded-xl text-white appearance-none cursor-pointer focus:ring-1 focus:ring-brand-primary text-sm"
                >
                  {CURRENCIES.map((cur) => (
                    <option key={cur.code} value={cur.code} className="bg-brand-bg text-white">
                      {cur.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  All expenses and settlements within this group will operate in this currency.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-300 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-brand-primary hover:bg-indigo-400 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
