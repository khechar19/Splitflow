import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden selection:bg-brand-primary selection:text-white">
      {/* Background blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-primary/20 blur-[130px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-accent/20 blur-[130px] pointer-events-none"></div>

      <div className="glass-panel w-full max-w-md rounded-3xl shadow-float p-8 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center font-bold shadow-lg mx-auto text-xl mb-4 text-white">
            S
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">SplitFlow</h1>
          <p className="text-sm text-gray-400">Simplify your shared expenses.</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2 animate-in slide-in-from-top-1 duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Address</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary text-sm"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-gray-300">Password</label>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-indigo-400 text-white py-3 rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] disabled:opacity-50"
          >
            <LogIn className="w-5 h-5" />
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-6">
          <p className="text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-primary hover:text-indigo-300 font-semibold transition-colors">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
