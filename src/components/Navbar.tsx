import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface NavbarProps {
  currentProfile: Profile | null;
}

export function Navbar({ currentProfile }: NavbarProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<Profile | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError('');
    setSearchResult(null);

    const formattedQuery = searchQuery.trim().startsWith('@')
      ? searchQuery.trim().toUpperCase()
      : `@${searchQuery.trim().toUpperCase()}`;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', formattedQuery)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSearchResult(data);
      } else {
        setSearchError('User handle not found');
      }
    } catch (err: any) {
      setSearchError('Error searching user');
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="w-full px-6 pt-4 sticky top-0 z-40">
      <nav className="max-w-7xl mx-auto glass-panel border border-brand-border/30 px-6 py-3 rounded-2xl flex justify-between items-center shadow-lg transition-all duration-300">
        <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center font-bold shadow-lg text-white font-display">
            S
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">SplitFlow</span>
        </Link>

        <div className="flex items-center gap-6">
          <form onSubmit={handleSearch} className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Search User ID (e.g. @AB1234)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input pl-11 pr-5 py-2.5 rounded-full text-sm w-64 transition-all duration-300 placeholder-slate-400 dark:placeholder-gray-400 text-slate-900 dark:text-white shadow-inner focus:w-80"
            />

            {/* Search Result Overlay Dropdown */}
            {(searchResult || searching || searchError) && (
              <div className="absolute top-14 right-0 w-80 glass-panel rounded-2xl p-4 shadow-float z-50 animate-in fade-in slide-in-from-top-2 duration-200 border border-brand-border/40">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider">User Search Result</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchResult(null);
                      setSearchError('');
                      setSearchQuery('');
                    }}
                    className="text-xs text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white font-medium"
                  >
                    Clear
                  </button>
                </div>

                {searching && <div className="text-sm text-slate-500 dark:text-gray-400 py-2">Searching...</div>}

                {searchError && <div className="text-sm text-rose-500 dark:text-rose-400 py-2">{searchError}</div>}

                {searchResult && (
                  <div className="flex items-center gap-3 py-2 border-t border-slate-200 dark:border-white/5 mt-2">
                    <img
                      src={searchResult.avatar_url || `https://ui-avatars.com/api/?name=${searchResult.full_name || 'User'}&background=6366F1&color=fff`}
                      alt={searchResult.full_name || ''}
                      className="w-10 h-10 rounded-full object-cover border border-brand-border"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-950 dark:text-white">
                        {searchResult.full_name || 'Anonymous User'}
                      </p>
                      <p className="text-xs text-brand-primary font-mono">{searchResult.username}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>

          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full glass-panel flex items-center justify-center hover:bg-slate-200/20 dark:hover:bg-white/10 transition-colors cursor-pointer border border-brand-border overflow-hidden shrink-0"
            title="View Profile"
          >
            {currentProfile?.avatar_url ? (
              <img
                src={currentProfile.avatar_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-slate-600 dark:text-gray-300" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
