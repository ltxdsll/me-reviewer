import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const [screen, setScreen] = useState('dashboard') // dashboard, quiz, result
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(false)
  
  // Persistent Theme Setup
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  // Authentication & 7-Day Inactivity Tracker
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSession = (session) => {
    if (session) {
      const lastActive = localStorage.getItem('lastActiveTime')
      const now = new Date().getTime()
      const sevenDays = 7 * 24 * 60 * 60 * 1000

      if (lastActive && (now - parseInt(lastActive)) > sevenDays) {
        // Log out if inactive for > 7 days
        supabase.auth.signOut()
        setSession(null)
        alert("You have been logged out due to 7 days of inactivity.")
      } else {
        setSession(session)
        localStorage.setItem('lastActiveTime', now.toString())
      }
    } else {
      setSession(null)
    }
  }

  // Auth Functions
  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('Account created! You are now logged in.')
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // Quiz Functions
  const shuffleOptions = (q) => {
    const correctMap = { 'A': q.option_a, 'B': q.option_b, 'C': q.option_c, 'D': q.option_d }
    const correctText = correctMap[String(q.correct_answer).toUpperCase()] || q.option_a
    const options = [q.option_a, q.option_b, q.option_c, q.option_d]
    
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { ...q, shuffled_options: options, correct_text: correctText }
  }

  const startQuiz = async (limit) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('questions').select('*')
      if (error) throw error
      if (!data || data.length === 0) return alert("No questions found!")

      const randomizedQuiz = data.sort(() => Math.random() - 0.5).slice(0, limit).map(shuffleOptions)
      setQuestions(randomizedQuiz)
      setCurrentIndex(0)
      setScore(0)
      setScreen('quiz')
      localStorage.setItem('lastActiveTime', new Date().getTime().toString())
    } catch (err) {
      alert("Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (selectedText) => {
    if (selectedText === questions[currentIndex].correct_text) setScore(score + 1)
    if (currentIndex + 1 < questions.length) setCurrentIndex(currentIndex + 1)
    else setScreen('result')
  }

  // Dynamic Theming
  const theme = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    sidebar: isDarkMode ? '#1e293b' : '#ffffff',
    text: isDarkMode ? '#f1f5f9' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    card: isDarkMode ? '#1e293b' : '#ffffff',
    border: isDarkMode ? '#334155' : '#e2e8f0',
    primary: '#3b82f6',
    cardBg1: '#ef4444', // Red stat card
    cardBg2: '#8b5cf6', // Purple stat card
    cardBg3: '#f97316'  // Orange stat card
  }

  // --- UI COMPONENTS ---
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg, color: theme.text, fontFamily: 'sans-serif' }}>
        <div style={{ padding: '40px', backgroundColor: theme.card, borderRadius: '12px', border: `1px solid ${theme.border}`, width: '100%', maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>ME Board Reviewer</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '12px', borderRadius: '6px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '12px', borderRadius: '6px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
            <button type="submit" disabled={loading} style={{ padding: '12px', backgroundColor: theme.primary, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{loading ? 'Logging in...' : 'Login'}</button>
            <button type="button" onClick={handleSignUp} style={{ padding: '12px', backgroundColor: 'transparent', color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '6px', cursor: 'pointer' }}>Sign Up</button>
          </form>
        </div>
      </div>
    )
  }

  // GitHub Heatmap Mock Data (Last 60 days)
  const heatmapData = Array.from({ length: 60 }, () => Math.floor(Math.random() * 4))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, fontFamily: 'sans-serif', transition: '0.3s' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: '250px', backgroundColor: theme.sidebar, borderRight: `1px solid ${theme.border}`, padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '40px' }}>ME Reviewer</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flexGrow: 1 }}>
          <span style={{ cursor: 'pointer', fontWeight: 'bold', color: theme.primary }}>Dashboard</span>
          <span style={{ cursor: 'pointer', color: theme.textMuted }}>Analytics</span>
          <span style={{ cursor: 'pointer', color: theme.textMuted }}>Study History</span>
        </div>
        
        <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ padding: '10px', marginBottom: '10px', backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '6px', cursor: 'pointer' }}>
          {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
        <button onClick={handleLogout} style={{ padding: '10px', backgroundColor: 'transparent', color: '#ef4444', border: `1px solid #ef4444`, borderRadius: '6px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        {screen === 'dashboard' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '5px' }}>Welcome back.</h1>
            <p style={{ color: theme.textMuted, marginBottom: '30px' }}>Your licensure exam progress at a glance.</p>

            {/* TOP STAT CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
              <div style={{ padding: '20px', backgroundColor: theme.cardBg1, color: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', opacity: 0.9 }}>Questions Answered</h3>
                <h2 style={{ fontSize: '32px', margin: '10px 0 0 0' }}>1,284</h2>
              </div>
              <div style={{ padding: '20px', backgroundColor: theme.cardBg2, color: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', opacity: 0.9 }}>Overall Accuracy</h3>
                <h2 style={{ fontSize: '32px', margin: '10px 0 0 0' }}>76%</h2>
              </div>
              <div style={{ padding: '20px', backgroundColor: theme.cardBg3, color: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '14px', opacity: 0.9 }}>Study Streak</h3>
                <h2 style={{ fontSize: '32px', margin: '10px 0 0 0' }}>12 Days</h2>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '40px' }}>
              <button onClick={() => startQuiz(10)} style={{ flex: 1, padding: '15px', backgroundColor: theme.card, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>Quick Quiz (10)</button>
              <button onClick={() => startQuiz(65)} style={{ flex: 1, padding: '15px', backgroundColor: theme.card, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>Refresher (65)</button>
              <button onClick={() => startQuiz(100)} style={{ flex: 1, padding: '15px', backgroundColor: theme.primary, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>Mock Exam (100)</button>
            </div>

            {/* GITHUB CALENDAR HEATMAP */}
            <div style={{ padding: '20px', backgroundColor: theme.card, borderRadius: '12px', border: `1px solid ${theme.border}` }}>
              <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Activity Tracker</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {heatmapData.map((level, i) => {
                  const colors = isDarkMode 
                    ? ['#334155', '#0e4429', '#006d32', '#26a641'] 
                    : ['#ebedf0', '#9be9a8', '#40c463', '#30a14e']
                  return (
                    <div key={i} style={{ width: '12px', height: '12px', backgroundColor: colors[level], borderRadius: '2px' }} title={`Activity level ${level}`} />
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* QUIZ INTERFACE */}
        {screen === 'quiz' && questions.length > 0 && (
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: theme.card, padding: '30px', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: theme.textMuted, fontSize: '14px', marginBottom: '20px' }}>
              <span>Question {currentIndex + 1} of {questions.length}</span>
              <span>Subject: {questions[currentIndex].subject || 'Mixed'}</span>
            </div>
            
            <h2 style={{ fontSize: '20px', lineHeight: '1.5', marginBottom: '30px' }}>
              {questions[currentIndex].question_text}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {questions[currentIndex].shuffled_options.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(opt)} style={{ padding: '15px', textAlign: 'left', backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RESULTS INTERFACE */}
        {screen === 'result' && (
          <div style={{ maxWidth: '600px', margin: '50px auto', textAlign: 'center', backgroundColor: theme.card, padding: '40px', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
            <h1 style={{ fontSize: '48px', margin: '20px 0', color: theme.primary }}>{score} / {questions.length}</h1>
            <p style={{ fontSize: '18px', color: theme.textMuted, marginBottom: '30px' }}>Quiz Completed!</p>
            <button onClick={() => setScreen('dashboard')} style={{ padding: '15px 30px', backgroundColor: theme.primary, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}