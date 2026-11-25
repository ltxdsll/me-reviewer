import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  RotateCcw,
  CheckCircle,
  Bookmark,
  AlertTriangle,
  Eye,
  Layers,
  ArrowLeft,
  Timer,
  Sparkles
} from 'lucide-react';

export default function FlashcardMode({ questions: initialQuestions, onExit }) {
  // Active deck queue (cards marked "Repeat Later" get re-inserted ahead)
  const [deck, setDeck] = useState(() =>
    initialQuestions.map((q, idx) => ({ ...q, _uid: `${q.id || idx}-${Math.random()}`, _repeats: 0 }))
  );
  const [isRevealed, setIsRevealed] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [totalRepeats, setTotalRepeats] = useState(0);

  // Bookmark & Report states per card
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isReported, setIsReported] = useState(false);

  // Optional Auto-Flash Pace: 0 = Manual (default), 5 = 5s, 10 = 10s
  const [autoPace, setAutoPace] = useState(0);
  const [autoProgress, setAutoProgress] = useState(0);

  // Anti-double-tap timestamp lock when revealing answer
  const revealTimestampRef = useRef(0);

  const currentCard = deck[0];
  const isFinished = deck.length === 0;

  // Reset per-card UI flags whenever the top card changes
  useEffect(() => {
    setIsRevealed(false);
    setIsBookmarked(false);
    setIsReported(false);
    setAutoProgress(0);
  }, [currentCard?._uid]);

  const handleReveal = () => {
    if (isRevealed || isFinished) return;
    revealTimestampRef.current = Date.now();
    setIsRevealed(true);
    setAutoProgress(0);
  };

  const handleRepeatLater = () => {
    if (!isRevealed || isFinished) return;
    // Prevent accidental double-tap within 250ms of revealing
    if (Date.now() - revealTimestampRef.current < 250) return;

    setTotalRepeats((prev) => prev + 1);
    setDeck((prevDeck) => {
      const [first, ...rest] = prevDeck;
      const updatedCard = {
        ...first,
        _uid: `${first.id || 'card'}-${Date.now()}-${Math.random()}`,
        _repeats: first._repeats + 1
      };
      // Re-insert 3 positions ahead (or at the end if fewer than 3 cards remain)
      const insertIndex = Math.min(3, rest.length);
      const nextDeck = [...rest];
      nextDeck.splice(insertIndex, 0, updatedCard);
      return nextDeck;
    });
  };

  const handleGotIt = () => {
    if (!isRevealed || isFinished) return;
    // Prevent accidental double-tap within 250ms of revealing
    if (Date.now() - revealTimestampRef.current < 250) return;

    setMasteredCount((prev) => prev + 1);
    setDeck((prevDeck) => prevDeck.slice(1));
  };

  const handleRestartDeck = () => {
    const reshuffled = [...initialQuestions]
      .sort(() => Math.random() - 0.5)
      .map((q, idx) => ({ ...q, _uid: `${q.id || idx}-${Math.random()}`, _repeats: 0 }));
    setDeck(reshuffled);
    setMasteredCount(0);
    setTotalRepeats(0);
    setIsRevealed(false);
    setAutoProgress(0);
  };

  // Optional Auto-Flash Pace Timer (runs only when autoPace > 0)
  useEffect(() => {
    if (autoPace === 0 || isFinished) {
      setAutoProgress(0);
      return;
    }

    const durationMs = autoPace * 1000;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setAutoProgress(pct);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        if (!isRevealed) {
          revealTimestampRef.current = 0; // Allow auto-advance
          setIsRevealed(true);
          setAutoProgress(0);
        } else {
          setMasteredCount((prev) => prev + 1);
          setDeck((prevDeck) => prevDeck.slice(1));
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [autoPace, isRevealed, currentCard?._uid, isFinished]);

  // Keyboard Shortcuts: Space (Reveal / Got It), 1 or LeftArrow (Repeat), 2 or RightArrow (Got It)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isFinished) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isRevealed) handleReveal();
        else handleGotIt();
        return;
      }

      if (isRevealed) {
        if (e.key === '1' || e.key === 'ArrowLeft') {
          e.preventDefault();
          handleRepeatLater();
        } else if (e.key === '2' || e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          handleGotIt();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, isFinished, deck]);

  // Silent Bookmark & Report Handlers (same tables as QuizActive)
  const handleBookmark = async () => {
    if (isBookmarked || !currentCard) return;
    setIsBookmarked(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('saved_items').insert({
      user_id: session.user.id,
      question_text: currentCard.question_text,
      correct_text: currentCard.correct_text,
      subject: currentCard.subject
    });
  };

  const handleReport = async () => {
    if (isReported || !currentCard) return;
    if (!window.confirm('Report this question as erroneous?')) return;
    setIsReported(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('reported_questions').insert({
      user_id: session.user.id,
      question_text: currentCard.question_text
    });
    alert('Question reported successfully. Thank you!');
  };

  // END-OF-DECK COMPLETION SCREEN (Zero DB Writes)
  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto w-full pt-10 pb-12 animate-in zoom-in-95 duration-300 text-center">
        <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Deck Completed!</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            Quick recall session finished. No stats or history were recorded.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Cards Cleared</div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{masteredCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Repeats Used</div>
              <div className="text-3xl font-black text-amber-500 mt-1">{totalRepeats}</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleRestartDeck}
              className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 transition shadow-sm"
            >
              <RotateCcw className="w-4 h-4" /> Shuffle & Restart Deck
            </button>
            <button
              onClick={onExit}
              className="px-6 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = (masteredCount / initialQuestions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
      {/* Deck Mastery Progress Bar */}
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-5 shrink-0">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Top Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 shrink-0">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onExit}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Exit Flashcards"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-md font-bold text-sm flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            {deck.length} left
          </span>
          <span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-md text-sm hidden sm:inline-block">
            {currentCard.subject}
          </span>
          {currentCard._repeats > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
              Re-queued
            </span>
          )}
        </div>

        {/* Pace Toggle + Bookmark/Report */}
        <div className="flex items-center space-x-3">
          {/* Auto-Flash Pace Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-bold">
            <Timer className="w-3.5 h-3.5 text-slate-400 mx-1.5 hidden sm:inline" />
            {[
              { label: 'Manual', val: 0 },
              { label: '5s', val: 5 },
              { label: '10s', val: 10 }
            ].map((mode) => (
              <button
                key={mode.val}
                onClick={() => setAutoPace(mode.val)}
                className={`px-2.5 py-1 rounded-md transition ${
                  autoPace === mode.val
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
            <button
              onClick={handleReport}
              disabled={isReported}
              className={`p-1.5 rounded transition ${
                isReported
                  ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Report Erroneous Question"
            >
              <AlertTriangle className="w-5 h-5" />
            </button>
            <button
              onClick={handleBookmark}
              disabled={isBookmarked}
              className={`p-1.5 rounded transition ${
                isBookmarked
                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Save for Later"
            >
              <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Expanding Card Body (No fixed height so long problems never clip) */}
      <div className="pb-20 flex-1 flex flex-col gap-5">
        {/* Question Card */}
        <div
          onClick={() => !isRevealed && handleReveal()}
          className={`bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border-2 transition-all shadow-sm relative overflow-hidden ${
            !isRevealed
              ? 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          {/* Auto-Flash Pace Countdown Bar */}
          {autoPace > 0 && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full transition-all duration-75 ${
                  isRevealed ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${autoProgress}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            <span>{currentCard.set_name ? `${currentCard.set_name} • ${currentCard.question_type || 'Question'}` : 'Prompt'}</span>
            {!isRevealed && <span className="text-blue-500">Tap card or press Space to reveal</span>}
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white leading-relaxed whitespace-pre-line">
            {currentCard.question_text}
          </h2>
        </div>

        {/* Expanding Answer Card */}
        {isRevealed && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-6 md:p-8 rounded-2xl border-2 border-emerald-500/40 shadow-sm animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Correct Answer
            </div>
            <div className="text-lg md:text-xl font-black text-emerald-900 dark:text-emerald-300 leading-relaxed whitespace-pre-line">
              {currentCard.correct_text}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Controls (Prevents accidental double-tap skips) */}
      <div className="sticky bottom-0 -mx-6 md:-mx-10 -mb-6 md:-mb-10 px-6 md:px-10 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 mt-auto z-10 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] dark:shadow-none">
        {!isRevealed ? (
          <button
            onClick={handleReveal}
            className="w-full bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-xl transition shadow-sm flex items-center justify-center gap-3"
          >
            <Eye className="w-5 h-5" />
            <span>Reveal Answer</span>
            <kbd className="hidden md:inline-block text-[10px] font-mono border border-white/30 bg-white/10 px-1.5 rounded text-white/70">
              Space
            </kbd>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleRepeatLater}
              className="bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Repeat Later</span>
              <kbd className="hidden md:inline-block text-[10px] font-mono border border-amber-400/40 px-1.5 rounded opacity-75">
                1
              </kbd>
            </button>
            <button
              onClick={handleGotIt}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Got It</span>
              <kbd className="hidden md:inline-block text-[10px] font-mono border border-white/30 bg-white/10 px-1.5 rounded text-white/80">
                2 / Space
              </kbd>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}