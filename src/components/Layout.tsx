import React from 'react';
import { Navbar } from './Navbar';
import { Profile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  profile: Profile | null;
}

export function Layout({ children, profile }: LayoutProps) {
  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-brand-primary selection:text-white pb-10">
      {/* Dynamic Background Visual Elements */}
      <div className="fixed inset-0 bg-dots-matrix pointer-events-none z-0 opacity-80"></div>
      
      {/* Animated Glowing Orbs */}
      <div className="fixed top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-primary/15 blur-[120px] pointer-events-none z-0 animate-float-blob1"></div>
      <div className="fixed bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full bg-brand-accent/15 blur-[130px] pointer-events-none z-0 animate-float-blob2"></div>

      <Navbar currentProfile={profile} />

      <main className="max-w-7xl mx-auto px-6 pb-20 relative z-10 animate-fade-in mt-6">
        {children}
      </main>
    </div>
  );
}
