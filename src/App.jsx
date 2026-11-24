import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { LogOut, Moon, Sun, Menu, X, Eye, EyeOff } from 'lucide-react';

import Dashboard from './components/Dashboard';
import Analytics from './components/Analytics';
import StudyHistory from './components/StudyHistory';
import SavedItems from './components/SavedItems'; // NEW IMPORT
import Settings from './components/Settings';
import QuizActive from './components/QuizActive';
import QuizResults from './components/QuizResults';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('Dashboard'); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [stats, setStats] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [quizScore, setQuizScore] = useState(0);

  const [filterData, setFilterData] = useState([]);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    supabase.auth.getSession().then(({ data: { session } }) => handleSessionCheck(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => handleSessionCheck(session));
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
  const { data, error } = await supabase.from('unique_filters').select('*');
  if (error) console.error("Error fetching filters:", error);
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
    const { error } = await supabase.auth.updateUser({ password: newPassword, data: { first_name: firstName, last_name: lastName }});
    if (error) alert(error.message);
    else {
      setNeedsProfile(false);
      await loadUserStats(session.user.id);
      fetchFilters();
    }
  };

  const startQuiz = async (selectedSubject, selectedSets, selectedTypes, limit) => {
    try {
      let query = supabase.from('questions').select('*').eq('subject', selectedSubject);
      if (selectedSets && selectedSets.length > 0) query = query.in('set_name', selectedSets);
      if (selectedTypes && selectedTypes.length > 0) query = query.in('question_type', selectedTypes);
      
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
    } catch (error) { alert("Error generating quiz: " + error.message); }
  };

  const startWeaknessQuiz = async (selectedSubject, limit) => {
    try {
      const { data: historyData, error: historyError } = await supabase.from('study_history').select('details').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(30);
      if (historyError) throw historyError;

      const missedTexts = new Set();
      historyData?.forEach(session => {
        session.details?.forEach(item => {
          if (!item.isCorrect && item.subject === selectedSubject) missedTexts.add(item.q);
        });
      });

      const missedArray = Array.from(missedTexts);
      if (missedArray.length === 0) return alert(`Great job! You have no recently missed questions for ${selectedSubject}.`);

      const { data, error } = await supabase.from('questions').select('*').eq('subject', selectedSubject).in('question_text', missedArray.slice(0, 100));
      if (error) throw error;
      if (!data || data.length === 0) return alert(`Could not sync missed questions for ${selectedSubject}.`);

      const randomized = data.sort(() => Math.random() - 0.5).slice(0, limit).map(q => {
        const correctMap = { 'A': q.option_a, 'B': q.option_b, 'C': q.option_c, 'D': q.option_d };
        const correctText = correctMap[String(q.correct_answer).toUpperCase()] || q.option_a;
        let options = [q.option_a, q.option_b, q.option_c, q.option_d].sort(() => Math.random() - 0.5);
        return { ...q, choices: options, correct_text: correctText };
      });

      setQuestions(randomized);
      setView('quiz');
    } catch (error) { alert("Error generating weakness mode: " + error.message); }
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
    await supabase.from('user_stats').upsert({ user_id: session.user.id, stats_data: newStats });

    const historyDetails = finalResults.map(r => ({
      q: r.question.question_text, userAnswer: r.userAnswer, correctText: r.question.correct_text,
      isCorrect: r.isCorrect, subject: r.question.subject
    }));

    await supabase.from('study_history').insert({ user_id: session.user.id, score: finalScore, total: finalResults.length, details: historyDetails });
    setQuizResults(finalResults);
    setQuizScore(finalScore);
    setView('results');
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div></div>;

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
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
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
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
            </div>
            <button type="submit" className="p-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition mt-2">Save & Enter Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex transition-colors duration-300">
      
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex backdrop-blur-sm transition-all" onClick={() => setIsSidebarOpen(false)}>
          <div className="w-72 h-full bg-white dark:bg-slate-900 p-6 flex flex-col shadow-2xl animate-in slide-in-from-left-8 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-500 font-black text-2xl tracking-tight"><span>MELE Reviewer</span></div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 dark:text-slate-400 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"><X className="w-6 h-6"/></button>
            </div>
            <div className="flex flex-col gap-2 flex-grow">
              {['Dashboard', 'Analytics', 'Study History', 'Saved Items', 'Settings'].map(tab => (
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

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="h-16 flex items-center justify-between px-6 md:px-10 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition flex items-center gap-2 font-bold"><Menu className="w-7 h-7" /></button>
          <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition ml-auto">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:px-10 md:pb-10 pt-0 relative flex flex-col">
          {view === 'dashboard' && activeTab === 'Dashboard' && <Dashboard stats={stats} filterData={filterData} onStartQuiz={startQuiz} onStartWeaknessQuiz={startWeaknessQuiz} surname={session.user.user_metadata?.last_name || ''} />}
          {view === 'dashboard' && activeTab === 'Analytics' && <Analytics stats={stats} />}
          {view === 'dashboard' && activeTab === 'Study History' && <StudyHistory userId={session.user.id} />}
          {view === 'dashboard' && activeTab === 'Saved Items' && <SavedItems userId={session.user.id} />}
          {view === 'dashboard' && activeTab === 'Settings' && <Settings />}
          
          {view === 'quiz' && questions.length > 0 && <QuizActive questions={questions} onComplete={handleQuizComplete} />}
          {view === 'results' && <QuizResults results={quizResults} score={quizScore} onBack={() => setView('dashboard')} />}
        </div>
      </div>
    </div>
  );
}