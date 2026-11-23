import React, { useState, useMemo } from 'react';
import { Play, Clock, CheckCircle, BookOpen, RotateCcw, AlertCircle, Activity } from 'lucide-react';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function Dashboard({ stats, filterData, onStartQuiz, onStartWeaknessQuiz, surname }) {
  // Main Quiz Setup State
  const [selectedSubject, setSelectedSubject] = useState(''); 
  const [selectedSets, setSelectedSets] = useState([]); 
  const [selectedTypes, setSelectedTypes] = useState([]);
  
  // Dedicated Weakness Mode State
  const [weaknessSubject, setWeaknessSubject] = useState('');

  const availableSets = useMemo(() => {
    if (!selectedSubject || !filterData) return [];
    return [...new Set(filterData.filter(d => d.subject === selectedSubject).map(d => d.set_name).filter(Boolean))].sort();
  }, [selectedSubject, filterData]);

  const availableTypes = useMemo(() => {
    if (!selectedSubject || !filterData) return [];
    let relevantData = filterData.filter(d => d.subject === selectedSubject);
    if (selectedSets.length > 0) {
      relevantData = relevantData.filter(d => selectedSets.includes(d.set_name));
    }
    return [...new Set(relevantData.map(d => d.question_type).filter(Boolean))].sort();
  }, [selectedSubject, selectedSets, filterData]);

  const toggleSet = (set) => {
    if (selectedSets.includes(set)) {
      setSelectedSets(selectedSets.filter(s => s !== set));
    } else {
      setSelectedSets([...selectedSets, set]);
    }
    setSelectedTypes([]);
  };

  const toggleType = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleReset = () => {
    setSelectedSubject('');
    setSelectedSets([]);
    setSelectedTypes([]);
  };

  const handleStart = (limit) => {
    if (!selectedSubject) return alert("Please choose a subject first.");
    if (selectedSets.length === 0) return alert("Please select at least one set.");
    if (selectedTypes.length === 0) return alert("Please select at least one question type (e.g., Problem Solving, Elements).");
    onStartQuiz(selectedSubject, selectedSets, selectedTypes, limit);
  };

  const handleWeaknessStart = (limit) => {
    if (!weaknessSubject) return alert("Please choose a subject from the Weakness Mode dropdown first.");
    onStartWeaknessQuiz(weaknessSubject, limit);
  };

  const heatmapData = useMemo(() => {
    if (!stats) return [];
    const data = [];
    const today = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = stats.history[dateStr] || 0;
      let level = 0;
      if (count > 0 && count <= 10) level = 1;
      else if (count > 10 && count <= 30) level = 2;
      else if (count > 30 && count <= 60) level = 3;
      else if (count > 60) level = 4;
      data.push({ date: dateStr, level });
    }
    return data;
  }, [stats]);

  if (!stats) return null;

  const accuracy = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
  const avgTime = stats.totalQuestions > 0 ? Math.round(stats.totalTimeSpent / stats.totalQuestions) : 0;

  const renderSubjectCard = (subjectName) => {
    const s = stats.subjects[subjectName];
    if (!s || s.total === 0) return null;
    
    const probTotal = s.types['Problem Solving']?.total || 0;
    const probAcc = probTotal > 0 ? Math.round((s.types['Problem Solving'].correct / probTotal) * 100) : 0;
    
    const elemTotal = s.types['Elements']?.total || 0;
    const elemAcc = elemTotal > 0 ? Math.round((s.types['Elements'].correct / elemTotal) * 100) : 0;

    return (
      <div key={subjectName} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mt-4">
        <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center justify-between">
          {subjectName} <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{s.total} items</span>
        </h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-400 font-medium">
              <span>Problem Solving</span><span>{probAcc}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${probAcc}%` }}></div></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-400 font-medium">
              <span>Elements</span><span>{elemAcc}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${elemAcc}%` }}></div></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8 max-w-6xl mx-auto animate-in fade-in duration-500 w-full">
      <div className="md:col-span-12 pt-2">
        <h1 className="font-bold">
          <div className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 font-medium">Welcome back,</div>
          <div className="text-3xl md:text-5xl mt-1 text-slate-800 dark:text-white font-black tracking-tight">Engr. {surname}!</div>
        </h1>
      </div>

      <div className="md:col-span-5 lg:col-span-4 flex flex-col h-max">
        
        {/* WEAKNESS MODE SECTION */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-red-500/20 shadow-sm transition-colors mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Activity className="w-16 h-16 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" /> Weakness Mode
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 pr-10">
            Re-test yourself on recently missed questions to build true mastery.
          </p>
          
          <div className="mb-4">
            <select 
              value={weaknessSubject} 
              onChange={e => setWeaknessSubject(e.target.value)} 
              className="w-full p-2.5 rounded-lg border border-red-200 dark:border-red-500/30 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
            >
              <option value="" disabled>Choose subject for review</option>
              <option value="PIPE">PIPE</option>
              <option value="MDSP">MDSP</option>
              <option value="MESL">MESL</option>
            </select>
          </div>

          <button onClick={() => handleWeaknessStart(30)} className="w-full bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-500/20 transition border border-red-200 dark:border-red-500/30 shadow-sm">
            <Play className="w-5 h-5 fill-current" /> Review Missed Items
          </button>
        </div>

        {/* STANDARD QUIZ SETUP SECTION */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Start a Review Session</h3>
            <button onClick={handleReset} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white transition">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
          
          <div className="space-y-5 mb-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Subject</label>
              <select value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedSets([]); setSelectedTypes([]); }} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                <option value="" disabled>Choose subject</option>
                <option value="PIPE">PIPE</option>
                <option value="MDSP">MDSP</option>
                <option value="MESL">MESL</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Select Set(s)</label>
              {!selectedSubject ? (
                <div className="text-sm text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">Please choose a subject first.</div>
              ) : availableSets.length === 0 ? (
                <div className="text-sm text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">No sets logged for this subject yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setSelectedSets([]); setSelectedTypes([]); }} className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${selectedSets.length === 0 ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`}>All Sets</button>
                  {availableSets.map(s => (
                    <button key={s} onClick={() => toggleSet(s)} className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${selectedSets.includes(s) ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`}>{s}</button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Select Question Type(s)</label>
              {!selectedSubject ? (
                <div className="text-sm text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">Please choose a subject first.</div>
              ) : availableTypes.length === 0 ? (
                <div className="text-sm text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">No question types available for this selection.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableTypes.map(type => (
                    <button key={type} onClick={() => toggleType(type)} className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${selectedTypes.includes(type) ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`}>{type}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={() => handleStart(9999)} className="w-full bg-slate-900 dark:bg-slate-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-600 transition shadow-sm">
              <Play className="w-5 h-5 fill-current" /> Start
            </button>
            <button onClick={() => handleStart(10)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
              Quick Review (10)
            </button>
            <button onClick={() => handleStart(100)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
              Mock Exam (100)
            </button>
          </div>
        </div>
      </div>

      <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-6 h-max">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl shrink-0">
              <CheckCircle className="text-emerald-500 w-8 h-8" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{accuracy}%</div>
              <div className="font-semibold text-sm text-slate-500 dark:text-slate-400">Overall Accuracy</div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl shrink-0">
              <Clock className="text-amber-500 w-8 h-8" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{formatTime(avgTime)}</div>
              <div className="font-semibold text-sm text-slate-500 dark:text-slate-400">Avg Time</div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl shrink-0">
              <BookOpen className="text-blue-500 w-8 h-8" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{stats.totalQuestions}</div>
              <div className="font-semibold text-sm text-slate-500 dark:text-slate-400">Items Done</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {['PIPE', 'MDSP', 'MESL'].map(renderSubjectCard)}
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Activity Tracker</h3>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {heatmapData.map((day, i) => {
              const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
              const darkColors = ['#1e293b', '#0e4429', '#006d32', '#26a641', '#39d353'];
              const activeColor = document.documentElement.classList.contains('dark') ? darkColors[day.level] : colors[day.level];
              return <div key={i} title={`${day.date}: Level ${day.level}`} style={{ width: '14px', height: '14px', backgroundColor: activeColor, borderRadius: '3px' }} />
            })}
          </div>
          <p className="text-xs text-slate-400 mt-4 text-right">Last 60 days</p>
        </div>
      </div>
    </div>
  );
}