import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Play, Clock, CheckCircle, XCircle, BarChart2, BookOpen, Activity, LogOut, ChevronRight, SkipForward, AlertCircle, Calendar, Moon, Sun } from 'lucide-react';

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
  const [needsProfile, setNeedsProfile] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPassword, setNewPassword] = useState(''); // Add this line
  
  // App Navigation & Theme
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Quiz State
  const [stats, setStats] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [quizScore, setQuizScore] = useState(0);

  // Filters from DB
  const [availableSets, setAvailableSets] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);

  useEffect(() => {
    // Check saved theme and apply it to the <html> tag on load
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

  const handleSessionCheck = (session) => {
    setSession(session);
    if (session) {
      // Check if user was manually created and is missing their name
      if (!session.user.user_metadata?.last_name) {
        setNeedsProfile(true);
      } else {
        setNeedsProfile(false);
        loadUserStats(session.user.id);
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

  const loadUserStats = (userId) => {
    const savedStats = localStorage.getItem(`me_stats_${userId}`);
    if (savedStats) {
      setStats(JSON.parse(savedStats));
    } else {
      setStats({
        totalQuizzes: 0, totalQuestions: 0, correctAnswers: 0, totalTimeSpent: 0, history: {}, 
        subjects: { 'PIPE': { correct: 0, total: 0 }, 'MDSP': { correct: 0, total: 0 }, 'MESL': { correct: 0, total: 0 } }
      });
    }
  };

  const fetchFilters = async () => {
    const { data } = await supabase.from('questions').select('set_name, question_type');
    if (data) {
      setAvailableSets([...new Set(data.map(q => q.set_name).filter(Boolean))]);
      setAvailableTypes([...new Set(data.map(q => q.question_type).filter(Boolean))]);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleProfileComplete = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({
      password: newPassword, // This updates the password
      data: { first_name: firstName, last_name: lastName } // This updates the name
    });
    
    if (error) {
      alert(error.message);
    } else {
      setNeedsProfile(false);
      loadUserStats(session.user.id);
      fetchFilters();
    }
  };

  const startQuiz = async (selectedSubject, selectedSet, selectedType, limit) => {
    try {
      let query = supabase.from('questions').select('*');
      if (selectedSubject !== 'All') query = query.eq('subject', selectedSubject);
      if (selectedSet !== 'All') query = query.eq('set_name', selectedSet);
      if (selectedType !== 'All') query = query.eq('question_type', selectedType);
      
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return alert("No questions found for these filters.");

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

  const handleQuizComplete = (finalResults, finalScore) => {
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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div></div>;

  // 1. PUBLIC LOGIN SCREEN (No Sign Up Button)
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
        <div className="p-10 bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-800">ME Board Prep</h2>
          <p className="text-center text-slate-500 mb-6 text-sm">Authorized Access Only</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="p-3 rounded-lg border border-slate-300 outline-none" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="p-3 rounded-lg border border-slate-300 outline-none" />
            <button type="submit" className="p-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. FIRST-TIME ONBOARDING SCREEN
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
            
            {/* New Password Field */}
            <input 
              type="password" 
              placeholder="New Personal Password (min. 6 characters)" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              required 
              minLength={6}
              className="p-3 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" 
            />
            
            <button type="submit" className="p-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition mt-2">
              Save & Enter Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. MAIN APPLICATION
  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex transition-colors duration-300">
        
        {/* SIDEBAR */}
        <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col hidden md:flex transition-colors">
          <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-500 font-bold text-xl mb-10 cursor-pointer" onClick={() => setView('dashboard')}>
            <Activity className="w-6 h-6" /><span>ME Reviewer</span>
          </div>
          
          <div className="flex flex-col gap-2 flex-grow">
            {['Dashboard', 'Analytics', 'Study History'].map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setView('dashboard'); }} className={`text-left p-3 rounded-lg font-medium transition ${activeTab === tab ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                {tab}
              </button>
            ))}
          </div>
          
          <button onClick={() => supabase.auth.signOut()} className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 hover:text-red-500 transition p-2">
            <LogOut className="w-5 h-5" /><span>Logout</span>
          </button>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          
          {/* HEADER BAR */}
          <div className="h-16 flex items-center justify-end px-6 md:px-10 shrink-0">
            <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:px-10 md:pb-10 pt-0">
            {view === 'dashboard' && activeTab === 'Dashboard' && (
              <Dashboard stats={stats} sets={availableSets} types={availableTypes} onStartQuiz={startQuiz} surname={session.user.user_metadata?.last_name || ''} />
            )}
            
            {view === 'dashboard' && activeTab !== 'Dashboard' && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Calendar className="w-16 h-16 mb-4 opacity-50" />
                <h2 className="text-xl font-bold text-slate-600">{activeTab} coming soon...</h2>
              </div>
            )}

            {view === 'quiz' && questions.length > 0 && <QuizActive questions={questions} onComplete={handleQuizComplete} />}
            {view === 'results' && <QuizResults results={quizResults} score={quizScore} onBack={() => setView('dashboard')} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD COMPONENT
// ==========================================
function Dashboard({ stats, sets, types, onStartQuiz, surname }) {
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedSet, setSelectedSet] = useState('All');
  const [selectedType, setSelectedType] = useState('All');

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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
        Welcome back, Engr. {surname}!
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <CheckCircle className="text-emerald-500 w-8 h-8 mb-4" />
          <div className="text-3xl font-black text-slate-800 dark:text-white mb-1">{accuracy}%</div>
          <div className="font-semibold text-sm text-slate-600 dark:text-slate-400">Overall Accuracy</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <Clock className="text-amber-500 w-8 h-8 mb-4" />
          <div className="text-3xl font-black text-slate-800 dark:text-white mb-1">{formatTime(avgTime)}</div>
          <div className="font-semibold text-sm text-slate-600 dark:text-slate-400">Avg Time per Item</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <BookOpen className="text-blue-500 w-8 h-8 mb-4" />
          <div className="text-3xl font-black text-slate-800 dark:text-white mb-1">{stats.totalQuestions}</div>
          <div className="font-semibold text-sm text-slate-600 dark:text-slate-400">Items Answered</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* QUIZ SETUP */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Start a Review Session</h3>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Subject</label>
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                <option value="All">All Subjects</option>
                <option value="PIPE">PIPE</option>
                <option value="MDSP">MDSP</option>
                <option value="MESL">MESL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Set</label>
              <select value={selectedSet} onChange={e => setSelectedSet(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                <option value="All">All Sets</option>
                {sets.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Question Type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                <option value="All">Problem Solving & Elements</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <button onClick={() => onStartQuiz(selectedSubject, selectedSet, selectedType, 50)} className="w-full bg-slate-900 dark:bg-slate-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-600 transition shadow-sm">
              <Play className="w-5 h-5 fill-current" /> Start
            </button>
            <button onClick={() => onStartQuiz(selectedSubject, selectedSet, selectedType, 10)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
              Quick Review (10)
            </button>
            <button onClick={() => onStartQuiz(selectedSubject, selectedSet, selectedType, 100)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
              Mock Exam (100)
            </button>
          </div>
        </div>

        {/* HEATMAP */}
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
// ACTIVE QUIZ COMPONENT
// ==========================================
function QuizActive({ questions, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION_SEC);
  const [results, setResults] = useState([]);
  const [score, setScore] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState(null);
  
  const currentQ = questions[currentIndex];
  
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

    setResults([...results, {
      question: currentQ, userAnswer: choiceText, isCorrect, isTimeout, timeSpent, skipped: choiceText === null && !isTimeout
    }]);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) setCurrentIndex(currentIndex + 1);
    else onComplete(results, score);
  };

  const progressPercent = (currentIndex / questions.length) * 100;
  const timerColor = timeLeft > 60 ? 'text-emerald-600 dark:text-emerald-400' : timeLeft > 30 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6 shrink-0">
        <div className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
      </div>

      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 shrink-0">
        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md font-bold text-sm">Item {currentIndex + 1} / {questions.length}</span>
          <span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-md text-sm">{currentQ.subject || currentQ.topic}</span>
        </div>
        <div className={`flex items-center space-x-2 font-mono text-xl font-bold ${timerColor}`}>
          <Clock className="w-5 h-5" /><span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="overflow-y-auto pb-6">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-white mb-8 leading-relaxed whitespace-pre-line">
          {currentQ.question_text}
        </h2>

        <div className="space-y-3 mb-8">
          {currentQ.choices.map((choice, idx) => {
            const isSelected = selectedOpt === choice;
            const isActuallyCorrect = choice === currentQ.correct_text;
            
            let btnStyle = "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500";
            if (hasAnswered) {
              if (isActuallyCorrect) btnStyle = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 font-bold";
              else if (isSelected) btnStyle = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400";
              else btnStyle = "border-slate-100 dark:border-slate-800 opacity-50";
            }

            return (
              <button key={idx} disabled={hasAnswered} onClick={() => handleAnswer(choice)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start ${btnStyle}`}>
                <div className="font-bold mr-4 shrink-0">{String.fromCharCode(65 + idx)}.</div>
                <div className="pt-0.5">{choice}</div>
                {hasAnswered && isActuallyCorrect && <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 ml-auto shrink-0" />}
                {hasAnswered && isSelected && !isActuallyCorrect && <XCircle className="w-5 h-5 text-red-500 ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto flex justify-end shrink-0 pt-4 border-t border-slate-200 dark:border-slate-800">
        {!hasAnswered ? (
          <button onClick={() => handleAnswer(null)} className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium px-4 py-2">
            <span>Skip Question</span><SkipForward className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={nextQuestion} className="bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition">
            {currentIndex + 1 === questions.length ? "Finish & Review" : "Next Question"}
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
    <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 pb-10">
      
      <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-8">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">Quiz Completed!</h2>
        <div className="flex justify-center gap-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-40">
            <div className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase">Final Score</div>
            <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mt-2">{score}/{results.length}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-40">
            <div className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase">Accuracy</div>
            <div className="text-4xl font-black text-slate-700 dark:text-slate-200 mt-2">{percentage}%</div>
          </div>
        </div>
      </div>

      {missed.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-6 h-6"/> Needs Review (Missed)</h3>
          {missed.map((res, i) => (
            <div key={i} className="p-5 rounded-xl bg-white dark:bg-slate-900 border-l-4 border-l-red-500 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line mb-3">{res.question.question_text}</div>
              <div className="flex flex-col gap-2 text-sm">
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
              <div className="text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line mb-3">{res.question.question_text}</div>
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