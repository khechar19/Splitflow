import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserPlus, AlertCircle } from 'lucide-react';

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpErr) throw signUpErr;

      setSuccessMsg('Signup successful! Check your email for verification, or you can now sign in.');
      // Empty fields
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup.');
    } finally {
      setLoading(false);
    }
  };

  const setValidationError = (msg: string) => {
    setError(msg);
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
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Create Account</h1>
          <p className="text-sm text-gray-400">Join SplitFlow and manage group bills seamlessly.</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2 animate-in slide-in-from-top-1 duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2 animate-in slide-in-from-top-1 duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
            <input
              type="text"
              required
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary text-sm"
            />
          </div>

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
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
            <input
              type="password"
              required
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-gray-500 transition-all focus:ring-1 focus:ring-brand-primary text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-indigo-400 text-white py-3 rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] disabled:opacity-50 pt-2"
          >
            <UserPlus className="w-5 h-5" />
            {loading ? 'Signing up...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-6">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-primary hover:text-indigo-300 font-semibold transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
