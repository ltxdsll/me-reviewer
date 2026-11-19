// ==========================================
// ANALYTICS COMPONENT
// ==========================================

import React, { useState } from 'react';

export default function Analytics({ stats }) {
  const [selectedSubj, setSelectedSubj] = useState('Overall');

  if (!stats) return null;

  let s = { correct: 0, total: 0, types: { 'Problem Solving': { correct: 0, total: 0 }, 'Elements': { correct: 0, total: 0 } }, topics: {} };

  if (selectedSubj === 'Overall') {
    ['PIPE', 'MDSP', 'MESL'].forEach(subj => {
      const subData = stats.subjects[subj] || { correct: 0, total: 0, types: {}, topics: {} };
      s.total += subData.total || 0;
      s.correct += subData.correct || 0;

      ['Problem Solving', 'Elements'].forEach(type => {
        if (!s.types[type]) s.types[type] = { correct: 0, total: 0 };
        if (subData.types && subData.types[type]) {
          s.types[type].total += subData.types[type].total || 0;
          s.types[type].correct += subData.types[type].correct || 0;
        }
      });

      if (subData.topics) {
        Object.keys(subData.topics).forEach(topic => {
          if (!s.topics[topic]) s.topics[topic] = { correct: 0, total: 0 };
          s.topics[topic].total += subData.topics[topic].total || 0;
          s.topics[topic].correct += subData.topics[topic].correct || 0;
        });
      }
    });
  } else {
    s = stats.subjects[selectedSubj] || { correct: 0, total: 0, types: {}, topics: {} };
  }
  
  const overallAcc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
  const probAcc = s.types['Problem Solving']?.total > 0 ? Math.round((s.types['Problem Solving'].correct / s.types['Problem Solving'].total) * 100) : 0;
  const elemAcc = s.types['Elements']?.total > 0 ? Math.round((s.types['Elements'].correct / s.types['Elements'].total) * 100) : 0;

  const topicsList = Object.keys(s.topics).map(topic => {
    const t = s.topics[topic];
    return { name: topic, acc: Math.round((t.correct / t.total) * 100), total: t.total };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pt-6 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h2 className="text-3xl font-black text-slate-800 dark:text-white">Analytics</h2>
        <select value={selectedSubj} onChange={e => setSelectedSubj(e.target.value)} className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none w-full md:w-64 font-bold shadow-sm">
          <option value="Overall">Overall (All Subjects)</option>
          <option value="PIPE">PIPE</option>
          <option value="MDSP">MDSP</option>
          <option value="MESL">MESL</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <div className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">{selectedSubj} Total</div>
          <div className="text-4xl font-black text-slate-800 dark:text-white">{overallAcc}%</div>
          <div className="text-xs text-slate-400 mt-2 font-medium">{s.total} items attempted</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <div className="text-sm font-bold text-blue-500 mb-2 uppercase tracking-wider">Problem Solving</div>
          <div className="text-4xl font-black text-slate-800 dark:text-white">{probAcc}%</div>
          <div className="text-xs text-slate-400 mt-2 font-medium">{s.types['Problem Solving']?.total || 0} items attempted</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <div className="text-sm font-bold text-emerald-500 mb-2 uppercase tracking-wider">Elements</div>
          <div className="text-4xl font-black text-slate-800 dark:text-white">{elemAcc}%</div>
          <div className="text-xs text-slate-400 mt-2 font-medium">{s.types['Elements']?.total || 0} items attempted</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-800 dark:text-white">Topic Mastery Breakdown</h3>
        </div>
        <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
          {topicsList.length === 0 ? (
            <div className="text-slate-500 text-center py-10 font-medium">No topic data logged for {selectedSubj} yet.</div>
          ) : (
            topicsList.map(t => (
              <div key={t.name}>
                <div className="flex justify-between text-sm mb-2 font-bold">
                  <span className="text-slate-700 dark:text-slate-300">{t.name} <span className="text-xs font-medium text-slate-400 ml-2">({t.total} items)</span></span>
                  <span className={t.acc < 50 ? 'text-red-500' : 'text-emerald-500'}>{t.acc}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${t.acc < 50 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${t.acc}%` }}></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}