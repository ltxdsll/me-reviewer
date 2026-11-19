// ==========================================
// STUDY HISTORY COMPONENT
// ==========================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronRight, XCircle, CheckCircle } from 'lucide-react';

export default function StudyHistory({ userId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      const { data } = await supabase.from('study_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
      if (data) setHistory(data);
      setLoading(false);
    }
    fetchHistory();
  }, [userId]);

  if (loading) return <div className="text-center py-10 text-slate-500 font-bold">Loading history...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pt-6 pb-10 w-full">
      <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">Study History</h2>
      
      {history.length === 0 ? (
        <div className="text-center font-medium text-slate-500 bg-white dark:bg-slate-900 p-10 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          No review sessions found yet. Take a quiz to log your history!
        </div>
      ) : (
        history.map(session => {
          const missed = session.details?.filter(q => !q.isCorrect) || [];
          const correct = session.details?.filter(q => q.isCorrect) || [];

          return (
            <div key={session.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
              <div 
                className="p-5 md:px-6 flex flex-col md:flex-row md:items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
              >
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 font-bold mb-1 tracking-wider uppercase">
                    {new Date(session.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  <div className="font-black text-slate-800 dark:text-white text-xl">
                    Score: {session.score} / {session.total} <span className="text-sm font-semibold text-slate-500 ml-2">({Math.round((session.score/session.total)*100)}%)</span>
                  </div>
                </div>
                <ChevronRight className={`w-6 h-6 text-slate-400 mt-3 md:mt-0 transition-transform ${expandedId === session.id ? 'rotate-90' : ''}`} />
              </div>

              {expandedId === session.id && session.details && (
                <div className="p-5 md:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-8 max-h-[450px] overflow-y-auto">
                  
                  {missed.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2 text-lg"><XCircle className="w-5 h-5"/> Needs Review</h4>
                      {missed.map((q, i) => (
                        <div key={`missed-${i}`} className="p-4 rounded-xl border-l-4 border-l-red-500 bg-white dark:bg-slate-900 shadow-sm">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">{q.q}</div>
                          <div className="text-xs space-y-1.5 font-medium">
                            <div className="text-red-500 line-through opacity-80">Your Answer: {q.userAnswer || 'Skipped / Timeout'}</div>
                            <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">Correct: {q.correctText}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {correct.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-lg"><CheckCircle className="w-5 h-5"/> Mastered</h4>
                      {correct.map((q, i) => (
                        <div key={`correct-${i}`} className="p-4 rounded-xl border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 shadow-sm">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">{q.q}</div>
                          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">You answered: {q.userAnswer}</div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}