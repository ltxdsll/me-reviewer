// ==========================================
// SETTINGS COMPONENT
// ==========================================

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Settings() {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Password successfully updated!');
      setNewPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pt-6 w-full">
      <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-6">Account Settings</h2>
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Change Password</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Update your password at any time to secure your account.</p>
        <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-4">
          <input type="password" placeholder="Enter new password (min. 6 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={loading} className="p-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50">{loading ? "Updating..." : "Update Password"}</button>
        </form>
        {message && <div className={`mt-4 p-3 rounded-lg text-sm font-bold ${message.includes('Error') ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>{message}</div>}
      </div>
    </div>
  );
}