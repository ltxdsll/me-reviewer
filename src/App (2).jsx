import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Play, Clock, CheckCircle, XCircle, BarChart2, BookOpen, Activity, LogOut, ChevronRight, SkipForward, AlertCircle, Calendar, Moon, Sun, Menu, X, Eye, EyeOff } from 'lucide-react';

const TIME_PER_QUESTION_SEC = 180;

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Auth & Onboarding State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [needsProfile, setNeedsProfile] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // App Navigation & Theme
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('Dashboard'); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Quiz State
  const [stats, setStats] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [quizScore, setQuizScore] = useState(0);

  // Filters from DB (Stores subject and set correlations)
  const [filterData, setFilterData] = useState([]);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionCheck(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionCheck(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSessionCheck = async (session) => {
    setSession(session);
    if (session) {
      if (!session.user.user_metadata?.last_name) {
        setNeedsProfile(true);
      } else {
        setNeedsProfile(false);
        await loadUserStats(session.user.id);
        fetchFilters();
      }
    }
    setAuthLoading(false);
  };

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const loadUserStats = async (userId) => {
    try {
      const { data, error } = await supabase.from('user_stats').select('stats_data').eq('user_id', userId).single();
      
      if (data && data.stats_data) {
        const s = data.stats_data;
        if (!s.subjects) s.subjects = {};
        ['PIPE', 'MDSP', 'MESL'].forEach(subj => {
          if (!s.subjects[subj]) s.subjects[subj] = { correct: 0, total: 0, types: {}, topics: {} };
          if (!s.subjects[subj].types) s.subjects[subj].types = {};
          if (!s.subjects[subj].topics) s.subjects[subj].topics = {};
        });
        setStats(s);
      } else {
        setStats({
          totalQuizzes: 0, totalQuestions: 0, correctAnswers: 0, totalTimeSpent: 0, history: {}, 
          subjects: { 
            'PIPE': { correct: 0, total: 0, types: {}, topics: {} }, 
            'MDSP': { correct: 0, total: 0, types: {}, topics: {} }, 
            'MESL': { correct: 0, total: 0, types: {}, topics: {} } 
          }
        });
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchFilters = async () => {
    // Fetch subject and set_name mapping to create dynamic dropdowns
    const { data } = await supabase.from('questions').select('subject, set_name');
    if (data) setFilterData(data);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) alert(error.message);
    else alert("Password reset link sent to your email!");
    setIsForgotPassword(false);
  };

  const handleProfileComplete = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { first_name: firstName, last_name: lastName }
    });
    
    if (error) alert(error.message);
    else {
      setNeedsProfile(false);
      await loadUserStats(session.user.id);
      fetchFilters();
    }
  };

  const startQuiz = async (selectedSubject, selectedSets, selectedType, limit) => {
    try {
      // 1. Filter by required Subject
      let query = supabase.from('questions').select('*').eq('subject', selectedSubject);
      
      // 2. Filter by multiple sets (if array is not empty, meaning specific sets were chosen)
      if (selectedSets && selectedSets.length > 0) {
        query = query.in('set_name', selectedSets);
      }

      // 3. Filter by Question Type
      if (selectedType !== 'All') {
        query = query.eq('question_type', selectedType);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return alert("No questions found for these specific filters.");

      const randomized = data.sort(() => Math.random() - 0.5).slice(0, limit).map(q => {
        const correctMap = { 'A': q.option_a, 'B': q.option_b, 'C': q.option_c, 'D': q.option_d };
        const correctText = correctMap[String(q.correct_answer).toUpperCase()] || q.option_a;
        let options = [q.option_a, q.option_b, q.option_c, q.option_d].sort(() => Math.random() - 0.5);
        return { ...q, choices: options, correct_text: correctText };
      });

      setQuestions(randomized);
      setView('quiz');
    } catch (error) {
      alert("Error generating quiz: " + error.message);
    }
  };

  const handleQuizComplete = async (finalResults, finalScore) => {
    const totalTimeForQuiz = finalResults.reduce((acc, curr) => acc + curr.timeSpent, 0);
    const newStats = { ...stats };
    
    newStats.totalQuizzes += 1;
    newStats.totalQuestions += finalResults.length;
    newStats.correctAnswers += finalScore;
    newStats.totalTimeSpent += totalTimeForQuiz;

    const today = new Date().toISOString().split('T')[0];
    newStats.history[today] = (newStats.history[today] || 0) + finalResults.length;

    finalResults.forEach(res => {
      const subj = res.question.subject || 'Mixed';
      const qType = res.question.question_type || 'Uncategorized';
      const topic = res.question.topic || 'General';

      if (!newStats.subjects[subj]) newStats.subjects[subj] = { correct: 0, total: 0, types: {}, topics: {} };
      
      newStats.subjects[subj].total += 1;
      if (res.isCorrect) newStats.subjects[subj].correct += 1;

      if (!newStats.subjects[subj].types[qType]) newStats.subjects[subj].types[qType] = { correct: 0, total: 0 };
      newStats.subjects[subj].types[qType].total += 1;
      if (res.isCorrect) newStats.subjects[subj].types[qType].correct += 1;

      if (!newStats.subjects[subj].topics[topic]) newStats.subjects[subj].topics[topic] = { correct: 0, total: 0 };
      newStats.subjects[subj].topics[topic].total += 1;
      if (res.isCorrect) newStats.subjects[subj].topics[topic].correct += 1;
    });

    setStats(newStats);
    
    await supabase.from('user_stats').upsert({
      user_id: session.user.id,
      stats_data: newStats
    });

    const historyDetails = finalResults.map(r => ({
      q: r.question.question_text,
      userAnswer: r.userAnswer,
      correctText: r.question.correct_text,
      isCorrect: r.isCorrect,
      subject: r.question.subject
    }));

    await supabase.from('study_history').insert({
      user_id: session.user.id,
      score: finalScore,
      total: finalResults.length,
      details: historyDetails
    });

    setQuizResults(finalResults);
    setQuizScore(finalScore);
    setView('results');
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div></div>;

  // 1. PUBLIC LOGIN SCREEN
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
        <div className="p-10 bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-md relative">
          <h2 className="text-3xl font-black mb-6 text-center text-slate-800 tracking-tight">MELE Reviewer</h2>
          
          {!isForgotPassword ? (
            <>
              <p className="text-center text-slate-500 mb-6 text-sm">Authorized Access Only</p>
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="p-3 rounded-lg border border-slate-300 outline-none" />
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="p-3 rounded-lg border border-slate-300 outline-none w-full pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="text-right">
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-blue-600 hover:underline">Forgot password?</button>
                </div>
                <button type="submit" className="p-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition">Login</button>
              </form>
            </>
          ) : (
            <>
              <p className="text-center text-slate-500 mb-6 text-sm">Enter your email to receive a reset link.</p>
              <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="p-3 rounded-lg border border-slate-300 outline-none" />
                <button type="submit" className="p-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">Send Reset Link</button>
                <button type="button" onClick={() => setIsForgotPassword(false)} className="text-sm text-slate-500 hover:underline mt-2">Back to Login</button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // 2. FIRST-TIME ONBOARDING SCREEN
  if (needsProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
        <div className="p-10 bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2 text-center text-slate-800">Welcome!</h2>
          <p className="text-center text-slate-500 mb-6 text-sm">Please complete your profile and set a new password to continue.</p>
          <form onSubmit={handleProfileComplete} className="flex flex-col gap-4">
            <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required className="p-3 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" placeholder="Last Name (e.g. Dela Cruz)" value={lastName} onChange={e => setLastName(e.target.value)} required className="p-3 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
            
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} placeholder="New Personal Password (min. 6 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="p-3 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 w-full pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            
            <button type="submit" className="p-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition mt-2">Save & Enter Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  // 3. MAIN APPLICATION
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex transition-colors duration-300">
      
      {/* UNIFIED COLLAPSIBLE SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex backdrop-blur-sm transition-all" onClick={() => setIsSidebarOpen(false)}>
          <div className="w-72 h-full bg-white dark:bg-slate-900 p-6 flex flex-col shadow-2xl animate-in slide-in-from-left-8 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-500 font-black text-2xl tracking-tight">
                <span>MELE Reviewer</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 dark:text-slate-400 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"><X className="w-6 h-6"/></button>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {['Dashboard', 'Analytics', 'Study History', 'Settings'].map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); setView('dashboard'); setIsSidebarOpen(false); }} className={`text-left p-3.5 rounded-xl font-bold transition-all ${activeTab === tab ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 scale-[1.02]' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <button onClick={() => supabase.auth.signOut()} className="flex items-center space-x-3 text-slate-500 dark:text-slate-400 hover:text-red-500 font-bold transition p-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl">
              <LogOut className="w-5 h-5" /><span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* MINIMALIST HEADER BAR */}
        <div className="h-16 flex items-center justify-between px-6 md:px-10 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition flex items-center gap-2 font-bold">
            <Menu className="w-7 h-7" />
          </button>
          
          <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition ml-auto">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:px-10 md:pb-10 pt-0 relative flex flex-col">
          {view === 'dashboard' && activeTab === 'Dashboard' && (
            <Dashboard stats={stats} filterData={filterData} onStartQuiz={startQuiz} surname={session.user.user_metadata?.last_name || ''} />
          )}
          
          {view === 'dashboard' && activeTab === 'Analytics' && <Analytics stats={stats} />}
          {view === 'dashboard' && activeTab === 'Study History' && <StudyHistory userId={session.user.id} />}
          {view === 'dashboard' && activeTab === 'Settings' && <Settings />}

          {view === 'quiz' && questions.length > 0 && <QuizActive questions={questions} onComplete={handleQuizComplete} />}
          {view === 'results' && <QuizResults results={quizResults} score={quizScore} onBack={() => setView('dashboard')} />}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD COMPONENT
// ==========================================
function Dashboard({ stats, filterData, onStartQuiz, surname }) {
  // Setup Dashboard States
  const [selectedSubject, setSelectedSubject] = useState(''); // Default is empty to force a choice
  const [selectedSets, setSelectedSets] = useState([]); // Array for multi-select
  const [selectedType, setSelectedType] = useState('All');

  // Derive available sets based on the currently selected subject
  const availableSets = useMemo(() => {
    if (!selectedSubject || !filterData) return [];
    return [...new Set(filterData.filter(d => d.subject === selectedSubject).map(d => d.set_name).filter(Boolean))].sort();
  }, [selectedSubject, filterData]);

  // Handle checking/unchecking sets
  const toggleSet = (set) => {
    if (selectedSets.includes(set)) {
      setSelectedSets(selectedSets.filter(s => s !== set));
    } else {
      setSelectedSets([...selectedSets, set]);
    }
  };

  const handleStart = (limit) => {
    if (!selectedSubject) return alert("Please choose a subject first.");
    onStartQuiz(selectedSubject, selectedSets, selectedType, limit);
  };

  // Heatmap calculation
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
      
      {/* 1. GREETING */}
      <div className="md:col-span-12 pt-2">
        <h1 className="font-bold">
          <div className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 font-medium">Welcome back,</div>
          <div className="text-3xl md:text-5xl mt-1 text-slate-800 dark:text-white font-black tracking-tight">Engr. {surname}!</div>
        </h1>
      </div>

      {/* 2. LEFT COLUMN (Quiz Setup Only) */}
      <div className="md:col-span-5 lg:col-span-4 flex flex-col h-max">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Start a Review Session</h3>
          <div className="space-y-5 mb-6">
            
            {/* Subject Selector (No 'All' option, default is empty) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Subject</label>
              <select 
                value={selectedSubject} 
                onChange={e => { setSelectedSubject(e.target.value); setSelectedSets([]); }} 
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none"
              >
                <option value="" disabled>Choose subject</option>
                <option value="PIPE">PIPE</option>
                <option value="MDSP">MDSP</option>
                <option value="MESL">MESL</option>
              </select>
            </div>

            {/* Set Selector (Dynamic Multi-Select Chips) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Select Set(s)</label>
              {!selectedSubject ? (
                <div className="text-sm text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  Please choose a subject first.
                </div>
              ) : availableSets.length === 0 ? (
                <div className="text-sm text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  No sets logged for this subject yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setSelectedSets([])} 
                    className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${selectedSets.length === 0 ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`}
                  >
                    All Sets
                  </button>
                  {availableSets.map(s => {
                    const isSelected = selectedSets.includes(s);
                    return (
                      <button 
                        key={s} 
                        onClick={() => toggleSet(s)} 
                        className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Question Type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                <option value="All">Problem Solving & Elements</option>
                <option value="Problem Solving">Problem Solving Only</option>
                <option value="Elements">Elements Only</option>
              </select>
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

      {/* 3. RIGHT COLUMN (All Stats & Heatmap) */}
      <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-6 h-max">
        
        {/* Row 1: Overall Stats */}
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

        {/* Row 2: Subject Performance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {['PIPE', 'MDSP', 'MESL'].map(renderSubjectCard)}
        </div>

        {/* Row 3: Heatmap */}
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

// ==========================================
// ANALYTICS COMPONENT
// ==========================================
function Analytics({ stats }) {
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

// ==========================================
// STUDY HISTORY COMPONENT
// ==========================================
function StudyHistory({ userId }) {
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

// ==========================================
// ACTIVE QUIZ COMPONENT
// ==========================================
function QuizActive({ questions: initialQuestions, onComplete }) {
  const [questionsList, setQuestionsList] = useState(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION_SEC);
  const [results, setResults] = useState([]);
  const [score, setScore] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState(null);
  
  const currentQ = questionsList[currentIndex];
  
  useEffect(() => {
    setTimeLeft(TIME_PER_QUESTION_SEC);
    setHasAnswered(false);
    setSelectedOpt(null);
  }, [currentIndex]);

  useEffect(() => {
    if (hasAnswered) return;
    if (timeLeft <= 0) { handleAnswer(null, true); return; }
    const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, currentIndex, hasAnswered]);

  const handleAnswer = (choiceText, isTimeout = false) => {
    if (hasAnswered) return;
    setHasAnswered(true);
    setSelectedOpt(choiceText);
    const timeSpent = TIME_PER_QUESTION_SEC - timeLeft;
    const isCorrect = !isTimeout && choiceText === currentQ.correct_text;
    if (isCorrect) setScore(score + 1);
    setResults(prev => [...prev, { question: currentQ, userAnswer: choiceText, isCorrect, isTimeout, timeSpent, skipped: false }]);
  };

  const handleSkip = () => {
    if (hasAnswered) return;
    setQuestionsList(prev => [...prev, currentQ]);
    setCurrentIndex(prev => prev + 1);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questionsList.length) setCurrentIndex(currentIndex + 1);
    else onComplete(results, score);
  };

  const progressPercent = (results.length / initialQuestions.length) * 100;
  const timerColor = timeLeft > 60 ? 'text-emerald-600 dark:text-emerald-400' : timeLeft > 30 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6 shrink-0">
        <div className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
      </div>
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 shrink-0">
        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md font-bold text-sm">
            Item {results.length + 1} / {initialQuestions.length}
          </span>
          <span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-md text-sm">
            {currentQ.subject || currentQ.topic}
          </span>
        </div>
        <div className={`flex items-center space-x-2 font-mono text-xl font-bold ${timerColor}`}>
          <Clock className="w-5 h-5" /><span>{formatTime(timeLeft)}</span>
        </div>
      </div>
      
      <div className="pb-16 flex-1">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white mb-8 leading-relaxed whitespace-pre-line">{currentQ.question_text}</h2>
        <div className="space-y-3 mb-8">
          {currentQ.choices.map((choice, idx) => {
            const isSelected = selectedOpt === choice;
            const isActuallyCorrect = choice === currentQ.correct_text;
            let btnStyle = "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 font-medium";
            if (hasAnswered) {
              if (isActuallyCorrect) btnStyle = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 font-bold";
              else if (isSelected) btnStyle = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 font-bold";
              else btnStyle = "border-slate-100 dark:border-slate-800 opacity-50";
            }
            return (
              <button key={idx} disabled={hasAnswered} onClick={() => handleAnswer(choice)} className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start ${btnStyle}`}>
                <div className="font-bold mr-4 shrink-0">{String.fromCharCode(65 + idx)}.</div>
                <div className="pt-0.5">{choice}</div>
                {hasAnswered && isActuallyCorrect && <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 ml-auto shrink-0" />}
                {hasAnswered && isSelected && !isActuallyCorrect && <XCircle className="w-5 h-5 text-red-500 ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="sticky bottom-0 -mx-6 md:-mx-10 -mb-6 md:-mb-10 px-6 md:px-10 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 mt-auto z-10 flex justify-end shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] dark:shadow-none">
        {!hasAnswered ? (
          <button onClick={handleSkip} className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold px-4 py-2">
            <span>Skip Question</span><SkipForward className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={nextQuestion} className="bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition shadow-sm">
            {results.length === initialQuestions.length ? "Finish & Review" : "Next Question"}
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// RESULTS COMPONENT
// ==========================================
function QuizResults({ results, score, onBack }) {
  const percentage = Math.round((score / results.length) * 100);
  const missed = results.filter(r => !r.isCorrect);
  const correct = results.filter(r => r.isCorrect);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 pb-10 w-full">
      <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-8 pt-6">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">Quiz Completed!</h2>
        <div className="flex justify-center gap-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-40">
            <div className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Final Score</div>
            <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mt-2">{score}/{results.length}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-40">
            <div className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Accuracy</div>
            <div className="text-4xl font-black text-slate-700 dark:text-slate-200 mt-2">{percentage}%</div>
          </div>
        </div>
      </div>
      {missed.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-6 h-6"/> Needs Review (Missed)</h3>
          {missed.map((res, i) => (
            <div key={i} className="p-5 rounded-xl bg-white dark:bg-slate-900 border-l-4 border-l-red-500 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-slate-800 dark:text-slate-200 font-bold whitespace-pre-line mb-3">{res.question.question_text}</div>
              <div className="flex flex-col gap-2 text-sm font-medium">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400"><XCircle className="w-4 h-4"/> <span className="line-through opacity-80">You answered: {res.userAnswer || "Skipped/Timeout"}</span></div>
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold"><CheckCircle className="w-4 h-4"/> <span>Correct: {res.question.correct_text}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
      {correct.length > 0 && (
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2"><CheckCircle className="w-6 h-6"/> Mastered (Correct)</h3>
          {correct.map((res, i) => (
            <div key={i} className="p-5 rounded-xl bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-slate-800 dark:text-slate-200 font-bold whitespace-pre-line mb-3">{res.question.question_text}</div>
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-bold"><CheckCircle className="w-4 h-4"/> <span>You answered: {res.userAnswer}</span></div>
            </div>
          ))}
        </div>
      )}
      <div className="pt-6 text-center">
        <button onClick={onBack} className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-4 px-10 rounded-xl shadow-md transition">Return to Dashboard</button>
      </div>
    </div>
  );
}

// ==========================================
// SETTINGS COMPONENT
// ==========================================
function Settings() {
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