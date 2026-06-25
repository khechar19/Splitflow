import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { LogOut, Check, AlertCircle, Upload } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { CURRENCIES } from '../lib/currency';

interface ProfileProps {
  currentProfile: Profile | null;
  onRefreshProfile: () => void;
}

export default function ProfilePage({ currentProfile, onRefreshProfile }: ProfileProps) {
  const { theme: activeTheme, setTheme, themes } = useTheme();

  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('https://ui-avatars.com/api/?name=User&background=6366F1&color=fff');

  useEffect(() => {
    if (currentProfile) {
      setFullName(currentProfile.full_name || '');
      setCurrency(currentProfile.currency || 'USD');
      setAvatarUrl(
        currentProfile.avatar_url ||
          `https://ui-avatars.com/api/?name=${currentProfile.full_name || 'U'}&background=6366F1&color=fff`
      );
    }
  }, [currentProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAvatarUpload = async (file: File) => {
    if (!currentProfile) return '';

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${currentProfile.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadErr } = await supabase.storage
        .from('receipts') // Reuse receipts bucket as it is already configured and public
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      throw err;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setErrorMsg('');
      setSuccessMsg('');

      try {
        setUpdating(true);
        const uploadedUrl = await handleAvatarUpload(file);
        setAvatarUrl(uploadedUrl);
        
        // Update database instantly
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: uploadedUrl })
          .eq('id', currentProfile?.id);

        if (error) throw error;
        setSuccessMsg('Avatar updated successfully!');
        onRefreshProfile();
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to upload avatar.');
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;

    setUpdating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          currency: currency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentProfile.id);

      if (error) throw error;

      setSuccessMsg('Profile updated successfully!');
      onRefreshProfile();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Profile</h1>
          <p className="text-gray-400">View and update your profile details.</p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Avatar Section */}
        <div className="md:col-span-1 flex flex-col items-center">
          <div className="glass-panel p-6 rounded-2xl w-full flex flex-col items-center border border-white/5">
            <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-brand-primary/50 shadow-glass mb-4 group cursor-pointer">
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Upload className="w-6 h-6 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={updating}
                />
              </label>
            </div>
            <h3 className="font-bold text-white text-base text-center">
              {currentProfile?.full_name || 'Group Member'}
            </h3>
            <span className="text-xs font-semibold font-mono text-brand-primary mt-1.5 bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 rounded-full">
              {currentProfile?.username}
            </span>
            <p className="text-[10px] text-gray-500 text-center mt-4 uppercase font-semibold tracking-wider">
              Unique User Handle
            </p>
          </div>
        </div>

        {/* Update Form Section */}
        <div className="md:col-span-2 space-y-8">
          <div className="glass-panel p-8 rounded-2xl border border-white/5">
            <h2 className="text-xl font-bold text-white mb-6">Account Settings</h2>

            {errorMsg && (
              <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2">
                <Check className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">User Handle (Unique)</label>
                <input
                  type="text"
                  disabled
                  value={currentProfile?.username || ''}
                  className="w-full glass-input px-4 py-3 rounded-xl text-gray-400 border border-white/5 cursor-not-allowed text-sm font-mono focus:ring-0"
                />
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Other users can search and add you to groups only using this handle.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Preferred Currency</label>
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
                  This will be used as your default display currency for global balance stats.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="w-full md:w-auto bg-brand-primary hover:bg-indigo-400 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {updating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Theme Selector */}
          <div className="glass-panel p-8 rounded-2xl border border-white/5">
            <h2 className="text-xl font-bold text-white mb-2">Choose Application Theme</h2>
            <p className="text-xs text-gray-400 mb-6">Switch between custom premium looks and mode profiles.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {themes.map((t) => {
                const isActive = activeTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`glass-panel p-4 rounded-xl flex items-center justify-between hover:bg-white/5 border transition-all cursor-pointer ${
                      isActive
                        ? 'border-brand-primary bg-brand-primary/10 shadow-[0_0_15px_rgba(99,102,241,0.15)] font-semibold'
                        : 'border-white/5'
                    }`}
                  >
                    <span className="text-sm text-white">{t.name}</span>
                    <div className="flex -space-x-1">
                      <span
                        className="w-4 h-4 rounded-full border border-black/25 shadow-sm"
                        style={{ backgroundColor: t.colors[0] }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/25 shadow-sm"
                        style={{ backgroundColor: t.colors[1] }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
