import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BookmarkMinus, CheckCircle } from 'lucide-react';

export default function SavedItems({ userId }) {
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSaved();
  }, [userId]);

  const fetchSaved = async () => {
    const { data } = await supabase.from('saved_items').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setSaved(data);
    setLoading(false);
  };

  const removeBookmark = async (id) => {
    await supabase.from('saved_items').delete().eq('id', id);
    setSaved(prev => prev.filter(item => item.id !== id));
  };

  if (loading) return <div className="text-center py-10 text-slate-500 font-bold">Loading saved items...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pt-6 pb-10 w-full">
      <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">Saved Items</h2>
      
      {saved.length === 0 ? (
        <div className="text-center font-medium text-slate-500 bg-white dark:bg-slate-900 p-10 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          You haven't bookmarked any questions yet.
        </div>
      ) : (
        saved.map(item => (
          <div key={item.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <button onClick={() => removeBookmark(item.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition" title="Remove Bookmark">
              <BookmarkMinus className="w-5 h-5" />
            </button>
            <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">{item.subject}</div>
            <div className="text-slate-800 dark:text-slate-200 font-bold whitespace-pre-line mb-4 pr-8">{item.question_text}</div>
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg w-max">
              <CheckCircle className="w-4 h-4"/> <span>Correct: {item.correct_text}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}