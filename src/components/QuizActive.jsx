// ==========================================
// ACTIVE QUIZ COMPONENT
// ==========================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, CheckCircle, XCircle, SkipForward, Bookmark, AlertTriangle, HelpCircle } from 'lucide-react';

const TIME_PER_QUESTION_SEC = 180;

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function QuizActive({ questions: initialQuestions, onComplete }) {
  const [questionsList, setQuestionsList] = useState(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [endTime, setEndTime] = useState(null); // NEW: Absolute Timestamp logic
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION_SEC);
  const [results, setResults] = useState([]);
  const [score, setScore] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState(null);
  
  // Feature states
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isReported, setIsReported] = useState(false);
  
  const currentQ = questionsList[currentIndex];
  
  useEffect(() => {
    // Set the exact future timestamp the question should end at
    setEndTime(Date.now() + TIME_PER_QUESTION_SEC * 1000);
    setTimeLeft(TIME_PER_QUESTION_SEC);
    setHasAnswered(false);
    setSelectedOpt(null);
    setIsBookmarked(false);
    setIsReported(false);
  }, [currentIndex]);

  // ABSOLUTE TIMER HOOK: Never pauses even if tab is inactive
  useEffect(() => {
    if (hasAnswered || !endTime) return;
    
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.round((endTime - now) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        handleAnswer(null, true);
      }
    };

    updateTimer(); // Run once immediately
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [endTime, hasAnswered]);

  const handleAnswer = (choiceText, isTimeout = false, isDontKnow = false) => {
    if (hasAnswered) return;
    setHasAnswered(true);
    
    if (isDontKnow) setSelectedOpt("I didn't know the answer");
    else setSelectedOpt(choiceText);
    
    const timeSpent = TIME_PER_QUESTION_SEC - timeLeft;
    const isCorrect = !isTimeout && !isDontKnow && choiceText === currentQ.correct_text;
    
    if (isCorrect) setScore(prev => prev + 1);
    setResults(prev => [...prev, { question: currentQ, userAnswer: isDontKnow ? "I didn't know the answer" : choiceText, isCorrect, isTimeout, timeSpent, skipped: false }]);
  };

  const handleSkip = () => {
    if (hasAnswered) return;
    setQuestionsList(prev => [...prev, currentQ]);
    setCurrentIndex(prev => prev + 1);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questionsList.length) setCurrentIndex(prev => prev + 1);
    else onComplete(results, score);
  };

  // Zero-Friction Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); 
        if (!hasAnswered) handleSkip();
        else nextQuestion();
        return;
      }

      if (!hasAnswered) {
        if (e.key === '1' && currentQ.choices[0]) handleAnswer(currentQ.choices[0]);
        if (e.key === '2' && currentQ.choices[1]) handleAnswer(currentQ.choices[1]);
        if (e.key === '3' && currentQ.choices[2]) handleAnswer(currentQ.choices[2]);
        if (e.key === '4' && currentQ.choices[3]) handleAnswer(currentQ.choices[3]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasAnswered, currentQ, currentIndex, questionsList, results, score]);

  // Background Database Actions
  const handleBookmark = async () => {
    if (isBookmarked) return;
    setIsBookmarked(true);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('saved_items').insert({
      user_id: session.user.id,
      question_text: currentQ.question_text,
      correct_text: currentQ.correct_text,
      subject: currentQ.subject
    });
  };

  const handleReport = async () => {
    if (isReported) return;
    if (!window.confirm("Report this question as erroneous?")) return;
    
    setIsReported(true);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('reported_questions').insert({
      user_id: session.user.id,
      question_text: currentQ.question_text
    });
    alert("Question reported successfully. Thank you!");
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
          <span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-md text-sm hidden sm:inline-block">
            {currentQ.subject || currentQ.topic}
          </span>
        </div>
        
        {/* NEW: Action Tools & Timer */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-700 pr-4">
            <button onClick={handleReport} disabled={isReported} className={`p-1.5 rounded transition ${isReported ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Report Erroneous Question">
              <AlertTriangle className="w-5 h-5" />
            </button>
            <button onClick={handleBookmark} disabled={isBookmarked} className={`p-1.5 rounded transition ${isBookmarked ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Save for Later">
              <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
          <div className={`flex items-center space-x-2 font-mono text-xl font-bold ${timerColor}`}>
            <Clock className="w-5 h-5" /><span>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>
      
      <div className="pb-16 flex-1">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white mb-8 leading-relaxed whitespace-pre-line">
          {currentQ.question_text}
        </h2>
        
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
                <div className="font-bold mr-4 shrink-0 flex items-center gap-2">
                  <span>{String.fromCharCode(65 + idx)}.</span>
                  <kbd className="hidden md:inline-block text-[10px] font-mono border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 rounded">{idx + 1}</kbd>
                </div>
                <div className="pt-0.5">{choice}</div>
                {hasAnswered && isActuallyCorrect && <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 ml-auto shrink-0" />}
                {hasAnswered && isSelected && !isActuallyCorrect && <XCircle className="w-5 h-5 text-red-500 ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* NEW: I Don't Know Button */}
        {!hasAnswered && (
          <div className="text-center mt-6">
            <button onClick={() => handleAnswer(null, false, true)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <HelpCircle className="w-4 h-4" /> I don't know the answer
            </button>
          </div>
        )}
      </div>
      
      <div className="sticky bottom-0 -mx-6 md:-mx-10 -mb-6 md:-mb-10 px-6 md:px-10 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 mt-auto z-10 flex justify-end shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] dark:shadow-none">
        {!hasAnswered ? (
          <button onClick={handleSkip} className="flex items-center space-x-3 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold px-4 py-2 transition group">
            <span>Skip Question</span>
            <kbd className="hidden md:inline-block text-[10px] font-mono border border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-800 px-1.5 rounded opacity-60 group-hover:opacity-100 transition">Space</kbd>
            <SkipForward className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={nextQuestion} className="bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition shadow-sm flex items-center gap-3">
            {results.length === initialQuestions.length ? "Finish & Review" : "Next Question"}
            <kbd className="hidden md:inline-block text-[10px] font-mono border border-white/30 bg-white/10 px-1.5 rounded text-white/70">Space</kbd>
          </button>
        )}
      </div>
    </div>
  );
}