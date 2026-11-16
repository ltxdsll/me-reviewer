import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [screen, setScreen] = useState('dashboard') // dashboard, quiz, result
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(false)

  // Instantly shuffles A, B, C, D choices and maps the correct text
  const shuffleOptions = (q) => {
    const correctMap = {
      'A': q.option_a, 'B': q.option_b, 'C': q.option_c, 'D': q.option_d
    };
    const correctText = correctMap[q.correct_answer.toUpperCase()];
    const options = [q.option_a, q.option_b, q.option_c, q.option_d];
    
    // Fisher-Yates Shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { ...q, shuffled_options: options, correct_text: correctText };
  }

  const startQuiz = async (limit) => {
    setLoading(true)
    try {
      // For tonight's MVP, we fetch everything and shuffle locally to guarantee it works
      const { data, error } = await supabase.from('questions').select('*')
      if (error) throw error

      if (!data || data.length === 0) {
        alert("No questions found in Supabase! Did you upload the CSV?")
        setLoading(false)
        return
      }

      // Shuffle the questions themselves, slice the limit, then shuffle their choices
      const randomizedQuiz = data
        .sort(() => Math.random() - 0.5)
        .slice(0, limit)
        .map(shuffleOptions)

      setQuestions(randomizedQuiz)
      setCurrentIndex(0)
      setScore(0)
      setScreen('quiz')
    } catch (err) {
      alert("Database error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (selectedText) => {
    if (selectedText === questions[currentIndex].correct_text) {
      setScore(score + 1)
    }
    
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setScreen('result')
    }
  }

  // --- MINIMALIST UI STYLES ---
  const containerStyle = { fontFamily: 'Inter, sans-serif', maxWidth: '600px', margin: '40px auto', padding: '20px', color: '#333' }
  const buttonStyle = { display: 'block', width: '100%', padding: '15px', margin: '10px 0', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff', fontSize: '16px', cursor: 'pointer', transition: '0.2s' }
  const primaryBtnStyle = { ...buttonStyle, backgroundColor: '#0070f3', color: '#fff', border: 'none', fontWeight: 'bold' }

  return (
    <div style={containerStyle}>
      {screen === 'dashboard' && (
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>ME Board Reviewer</h1>
          <p style={{ color: '#666', marginBottom: '30px' }}>Select a quiz mode to begin.</p>
          
          <button style={buttonStyle} onClick={() => startQuiz(65)} disabled={loading}>
            {loading ? 'Loading...' : 'Refresher Set (65 Items)'}
          </button>
          <button style={buttonStyle} onClick={() => startQuiz(10)} disabled={loading}>
            {loading ? 'Loading...' : 'Subject Quiz (10 Items)'}
          </button>
          <button style={primaryBtnStyle} onClick={() => startQuiz(100)} disabled={loading}>
            {loading ? 'Loading...' : 'Mock Exam (100 Items)'}
          </button>
        </div>
      )}

      {screen === 'quiz' && questions.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '14px', marginBottom: '20px' }}>
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>Subject: {questions[currentIndex].subject}</span>
          </div>
          
          <h2 style={{ fontSize: '18px', lineHeight: '1.5', marginBottom: '20px' }}>
            {questions[currentIndex].question_text}
          </h2>
          
          {questions[currentIndex].shuffled_options.map((opt, i) => (
            <button key={i} style={buttonStyle} onClick={() => handleAnswer(opt)}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {screen === 'result' && (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <h1 style={{ fontSize: '36px', marginBottom: '10px' }}>{score} / {questions.length}</h1>
          <p style={{ fontSize: '18px', color: '#666', marginBottom: '30px' }}>Quiz Completed!</p>
          <button style={primaryBtnStyle} onClick={() => setScreen('dashboard')}>
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  )
}