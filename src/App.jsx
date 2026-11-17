import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Play, Clock, CheckCircle, XCircle, BarChart2, BookOpen, Activity, LogOut, ChevronRight, SkipForward, AlertCircle, Calendar } from 'lucide-react';

const TIME_PER_QUESTION_SEC = 180; // 3 minutes[cite: 12]

// --- Utility: Format Time[cite: 12] ---
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  
  const [view, setView] = useState('dashboard'); // 'dashboard', 'quiz', 'results'
  const [activeTab, setActiveTab] = useState('Dashboard'); // Sidebar tabs
  
  // App State
  const [stats, setStats] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [quizScore, setQuizScore] = useState(0);

  // Filters from DB[cite: 13]
  const [availableSets, setAvailableSets] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);

  // --- 1. Auth & Data Initialization ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadUserStats();
      fetchFilters();
    }
  }, [session, view]);

  const loadUserStats = () => {
    // For MVP, tracking accurate stats in localStorage keyed to the user's ID
    const savedStats = localStorage.getItem(`me_stats_${session.user.id}`);
    if (savedStats) {
      setStats(JSON.parse(savedStats));
    } else {
      setStats({
        totalQuizzes: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        totalTimeSpent: 0,
        history: {}, // Format: { 'YYYY-MM-DD': questionsAnsweredCount }
        subjects: {
          'PIPE': { correct: 0, total: 0 },
          'MDSP': { correct: 0, total: 0 },
          'MESL': { correct: 0, total: 0 }
        }
      });
    }
  };

  const fetchFilters = async () => {
    const { data, error } = await supabase.from('questions').select('set_name, question_type');
    if (data) {
      const sets = [...new Set(data.map(q => q.set_name).filter(Boolean))];
      const types = [...new Set(data.map(q => q.question_type).filter(Boolean))];
      setAvailableSets(sets);
      setAvailableTypes(types);
    }
  };

  // --- 2. Auth Handlers ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- 3. Start Quiz (Supabase Fetch) ---
  const startQuiz = async (selectedSet, selectedType, limit) => {
    try {
      let query = supabase.from('questions').select('*');
      if (selectedSet !== 'All') query = query.eq('set_name', selectedSet); //[cite: 13]
      if (selectedType !== 'All') query = query.eq('question_type', selectedType); //[cite: 13]
      
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return alert("No questions found for these filters.");

      // Shuffle & Format[cite: 12]
      const randomized = data.sort(() => Math.random() - 0.5).slice(0, limit).map(q => {
        const correctMap = { 'A': q.option_a, 'B': q.option_b, 'C': q.option_c, 'D': q.option_d };
        const correctText = correctMap[String(q.correct_answer).toUpperCase()] || q.option_a;
        let options = [q.option_a, q.option_b, q.option_c, q.option_d];
        options.sort(() => Math.random() - 0.5); // Shuffle choices

        return { ...q, choices: options, correct_text: correctText };
      });

      setQuestions(randomized);
      setView('quiz');
    } catch (error) {
      alert("Error generating quiz: " + error.message);
    }
  };

  // --- 4. End Quiz & Save Real Stats ---
  const handleQuizComplete = (finalResults, finalScore) => {
    const totalTimeForQuiz = finalResults.reduce((acc, curr) => acc + curr.timeSpent, 0);
    const newStats = { ...stats };
    
    newStats.totalQuizzes += 1;
    newStats.totalQuestions += finalResults.length;
    newStats.correctAnswers += finalScore;
    newStats.totalTimeSpent += totalTimeForQuiz;

    // Accurate Heatmap Tracking
    const today = new Date().toISOString().split('T')[0];
    newStats.history[today] = (newStats.history[today] || 0) + finalResults.length;

    // Subject Tracking
    finalResults.forEach(res => {
      const subj = res.question.subject || 'Mixed';
      if (!newStats.subjects[subj]) newStats.subjects[subj] = { correct: 0, total: 0 };
      newStats.subjects[subj].total += 1;
      if (res.isCorrect) newStats.subjects[subj].correct += 1;
    });

    setStats(newStats);
    localStorage.setItem(`me_stats_${session.user.id}`, JSON.stringify(newStats));
    
    setQuizResults(finalResults);
    setQuizScore(finalScore);
    setView('results');
  };

  // --- UI COMPONENTS ---
  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div></div>;

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="p-10 bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-800">ME Board Prep</h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            <button type="submit" className="p-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex selection:bg-blue-200">
      
      {/* SIDEBAR[cite: 12] */}
      <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col hidden md:flex">
        <div className="flex items-center space-x-2 text-blue-700 font-bold text-xl mb-10 cursor-pointer" onClick={() => setView('dashboard')}>
          <Activity className="w-6 h-6" /><span>ME Reviewer</span>
        </div>
        
        <div className="flex flex-col gap-2 flex-grow">
          {['Dashboard', 'Analytics', 'Study History'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setView('dashboard'); }} className={`text-left p-3 rounded-lg font-medium transition ${activeTab === tab ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
              {tab}
            </button>
          ))}
        </div>
        
        <button onClick={handleLogout} className="flex items-center space-x-2 text-slate-500 hover:text-red-500 transition p-2">
          <LogOut className="w-5 h-5" /><span>Logout</span>
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        {view === 'dashboard' && activeTab === 'Dashboard' && (
          <Dashboard stats={stats} sets={availableSets} types={availableTypes} onStartQuiz={startQuiz} />
        )}
        
        {view === 'dashboard' && activeTab !== 'Dashboard' && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Calendar className="w-16 h-16 mb-4 opacity-50" />
            <h2 className="text-xl font-bold text-slate-600">{activeTab} coming soon...</h2>
          </div>
        )}

        {view === 'quiz' && questions.length > 0 && (
          <QuizActive questions={questions} onComplete={handleQuizComplete} />
        )}

        {view === 'results' && (
          <QuizResults results={quizResults} score={quizScore} onBack={() => setView('dashboard')} />
        )}
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD COMPONENT
// ==========================================
function Dashboard({ stats, sets, types, onStartQuiz }) {
  const [selectedSet, setSelectedSet] = useState('All');
  const [selectedType, setSelectedType] = useState('All');

  // CRITICAL FIX: Hook is now placed BEFORE the early return
  const heatmapData = useMemo(() => {
    if (!stats) return []; // Safety check
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

  // Early return is now safely AFTER all hooks
  if (!stats) return null;

  const accuracy = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
  const avgTime = stats.totalQuestions > 0 ? Math.round(stats.totalTimeSpent / stats.totalQuestions) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold text-slate-800">Welcome back.</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <CheckCircle className="text-emerald-500 w-8 h-8 mb-4" />
          <div className="text-3xl font-black text-slate-800 mb-1">{accuracy}%</div>
          <div className="font-semibold text-sm text-slate-600">Overall Accuracy</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <Clock className="text-amber-500 w-8 h-8 mb-4" />
          <div className="text-3xl font-black text-slate-800 mb-1">{formatTime(avgTime)}</div>
          <div className="font-semibold text-sm text-slate-600">Avg Time per Item</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <BookOpen className="text-blue-500 w-8 h-8 mb-4" />
          <div className="text-3xl font-black text-slate-800 mb-1">{stats.totalQuestions}</div>
          <div className="font-semibold text-sm text-slate-600">Items Answered</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Quiz Setup & Filters */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Start a Review Session</h3>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Select Set</label>
              <select value={selectedSet} onChange={e => setSelectedSet(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="All">All Sets</option>
                {sets.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Select Question Type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="All">All Types (Theory + Problem Solving)</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onStartQuiz(selectedSet, selectedType, 20)} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-3 rounded-xl transition">Short (20)</button>
            <button onClick={() => onStartQuiz(selectedSet, selectedType, 100)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-sm transition">Exam (100)</button>
          </div>
        </div>

        {/* Real Activity Heatmap */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Activity Tracker</h3>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {heatmapData.map((day, i) => {
              const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
              return <div key={i} title={`${day.date}: Level ${day.level}`} style={{ width: '14px', height: '14px', backgroundColor: colors[day.level], borderRadius: '3px' }} />
            })}
          </div>
          <p className="text-xs text-slate-400 mt-4 text-right">Last 60 days</p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ACTIVE QUIZ COMPONENT
// ==========================================
function QuizActive({ questions, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION_SEC); //[cite: 12]
  const [results, setResults] = useState([]);
  const [score, setScore] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false); //[cite: 13]
  const [selectedOpt, setSelectedOpt] = useState(null);
  
  const currentQ = questions[currentIndex];
  
  // Timer Logic[cite: 12]
  useEffect(() => {
    setTimeLeft(TIME_PER_QUESTION_SEC);
    setHasAnswered(false);
    setSelectedOpt(null);
  }, [currentIndex]);

  useEffect(() => {
    if (hasAnswered) return; // Stop timer when answered
    if (timeLeft <= 0) { handleAnswer(null, true); return; } // Timeout[cite: 12]
    const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, currentIndex, hasAnswered]);

  const handleAnswer = (choiceText, isTimeout = false) => {
    if (hasAnswered) return;
    setHasAnswered(true);
    setSelectedOpt(choiceText);

    const timeSpent = TIME_PER_QUESTION_SEC - timeLeft; //[cite: 12]
    const isCorrect = !isTimeout && choiceText === currentQ.correct_text;
    
    if (isCorrect) setScore(score + 1);

    setResults([...results, {
      question: currentQ,
      userAnswer: choiceText,
      isCorrect,
      isTimeout,
      timeSpent,
      skipped: choiceText === null && !isTimeout
    }]);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) setCurrentIndex(currentIndex + 1);
    else onComplete(results, score);
  };

  const progressPercent = (currentIndex / questions.length) * 100; //[cite: 13]
  const timerColor = timeLeft > 60 ? 'text-emerald-600' : timeLeft > 30 ? 'text-amber-500' : 'text-red-500'; //[cite: 12]

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
      
      {/* Top Progress Bar[cite: 13] */}
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
      </div>

      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md font-bold text-sm">Item {currentIndex + 1} / {questions.length}</span>
          <span className="font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-md text-sm">{currentQ.subject || currentQ.topic}</span>
        </div>
        <div className={`flex items-center space-x-2 font-mono text-xl font-bold ${timerColor}`}>
          <Clock className="w-5 h-5" /><span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      <h2 className="text-xl md:text-2xl font-semibold text-slate-800 mb-8 leading-relaxed whitespace-pre-line">
        {currentQ.question_text}
      </h2>

      {/* Immediate Evaluation Options[cite: 13] */}
      <div className="space-y-3 mb-8">
        {currentQ.choices.map((choice, idx) => {
          const isSelected = selectedOpt === choice;
          const isActuallyCorrect = choice === currentQ.correct_text;
          
          let btnStyle = "border-slate-200 bg-white text-slate-700 hover:border-blue-300";
          if (hasAnswered) {
            if (isActuallyCorrect) btnStyle = "border-green-500 bg-green-50 text-green-800 font-bold";
            else if (isSelected) btnStyle = "border-red-500 bg-red-50 text-red-800";
            else btnStyle = "border-slate-100 opacity-50";
          }

          return (
            <button key={idx} disabled={hasAnswered} onClick={() => handleAnswer(choice)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start ${btnStyle}`}>
              <div className="font-bold mr-4 shrink-0">{String.fromCharCode(65 + idx)}.</div>
              <div className="pt-0.5">{choice}</div>
              {hasAnswered && isActuallyCorrect && <CheckCircle className="w-5 h-5 text-green-600 ml-auto shrink-0" />}
              {hasAnswered && isSelected && !isActuallyCorrect && <XCircle className="w-5 h-5 text-red-500 ml-auto shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex justify-end">
        {!hasAnswered ? (
          <button onClick={() => handleAnswer(null)} className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 font-medium px-4 py-2">
            <span>Skip Question</span><SkipForward className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={nextQuestion} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-xl transition">
            {currentIndex + 1 === questions.length ? "Finish & Review" : "Next Question"}
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// RESULTS COMPONENT[cite: 13]
// ==========================================
function QuizResults({ results, score, onBack }) {
  const percentage = Math.round((score / results.length) * 100);
  const missed = results.filter(r => !r.isCorrect);
  const correct = results.filter(r => r.isCorrect);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
      
      <div className="text-center border-b border-slate-200 pb-8">
        <h2 className="text-3xl font-black text-slate-900 mb-6">Quiz Completed!</h2>
        <div className="flex justify-center gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm w-40">
            <div className="text-sm text-slate-500 font-bold uppercase">Final Score</div>
            <div className="text-4xl font-black text-indigo-600 mt-2">{score}/{results.length}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm w-40">
            <div className="text-sm text-slate-500 font-bold uppercase">Accuracy</div>
            <div className="text-4xl font-black text-slate-700 mt-2">{percentage}%</div>
          </div>
        </div>
      </div>

      {missed.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-red-600 flex items-center gap-2"><AlertCircle className="w-6 h-6"/> Needs Review (Missed)</h3>
          {missed.map((res, i) => (
            <div key={i} className="p-5 rounded-xl bg-white border-l-4 border-l-red-500 border border-slate-200 shadow-sm">
              <div className="text-slate-800 font-medium whitespace-pre-line mb-3">{res.question.question_text}</div>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 text-red-600"><XCircle className="w-4 h-4"/> <span className="line-through opacity-80">You answered: {res.userAnswer || "Skipped/Timeout"}</span></div>
                <div className="flex items-center gap-2 text-green-700 font-bold"><CheckCircle className="w-4 h-4"/> <span>Correct: {res.question.correct_text}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {correct.length > 0 && (
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-bold text-green-600 flex items-center gap-2"><CheckCircle className="w-6 h-6"/> Mastered (Correct)</h3>
          {correct.map((res, i) => (
            <div key={i} className="p-5 rounded-xl bg-white border-l-4 border-l-green-500 border border-slate-200 shadow-sm">
              <div className="text-slate-800 font-medium whitespace-pre-line mb-3">{res.question.question_text}</div>
              <div className="flex items-center gap-2 text-green-700 text-sm font-bold"><CheckCircle className="w-4 h-4"/> <span>You answered: {res.userAnswer}</span></div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-6 text-center">
        <button onClick={onBack} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 px-10 rounded-xl shadow-md transition">Return to Dashboard</button>
      </div>
    </div>
  );
}