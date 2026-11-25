import React, { useState, useMemo, useRef } from 'react';
import {
  Play,
  Clock,
  CheckCircle,
  BookOpen,
  RotateCcw,
  AlertCircle,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const SUBJECTS = ['PIPE', 'MDSP', 'MESL'];
const WEEKDAYS = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
const MOBILE_MODES = [
  { id: 'review', label: 'Review', activeText: 'text-blue-600 dark:text-blue-400' },
  { id: 'weakness', label: 'Weakness', activeText: 'text-red-600 dark:text-red-400' },
  { id: 'flashcards', label: 'Flashcards', activeText: 'text-indigo-600 dark:text-indigo-400' }
];

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const toLocalDateStr = (year, monthIndex, day) => {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Reusable Filter Group for Review Mode & Flashcard Mode
function ModeFilterSelectors({
  subject,
  onSelectSubject,
  sets,
  onToggleSet,
  onSelectAllSets,
  types,
  onToggleType,
  filterData,
  accentColor = 'blue'
}) {
  const availableSets = useMemo(() => {
    if (!subject || !filterData) return [];
    return [
      ...new Set(
        filterData
          .filter((d) => d.subject === subject)
          .map((d) => d.set_name)
          .filter(Boolean)
      )
    ].sort();
  }, [subject, filterData]);

  const availableTypes = useMemo(() => {
    if (!subject || !filterData) return [];
    let relevant = filterData.filter((d) => d.subject === subject);
    if (sets.length > 0) {
      relevant = relevant.filter((d) => sets.includes(d.set_name));
    }
    return [...new Set(relevant.map((d) => d.question_type).filter(Boolean))].sort();
  }, [subject, sets, filterData]);

  const activeChipClass =
    accentColor === 'indigo'
      ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
      : 'bg-blue-600 border-blue-600 text-white shadow-xs';

  const inactiveChipClass =
    'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500';

  return (
    <div className="space-y-4 mb-5">
      {/* 1. Single-Select Subject Chips */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Select Subject
        </label>
        <div className="grid grid-cols-3 gap-2">
          {SUBJECTS.map((subj) => {
            const isSelected = subject === subj;
            return (
              <button
                key={subj}
                type="button"
                onClick={() => onSelectSubject(isSelected ? '' : subj)}
                className={`py-2 px-3 rounded-xl border text-sm font-bold transition-all active:scale-[0.98] ${
                  isSelected ? activeChipClass : inactiveChipClass
                }`}
              >
                {subj}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Multi-Select Sets with Fixed Scrollable Viewport (Default: All) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Select Set(s)
          </label>
          {subject && availableSets.length > 0 && (
            <span className="text-[11px] font-semibold text-slate-400">
              {sets.length === 0 ? 'All selected' : `${sets.length} selected`}
            </span>
          )}
        </div>

        {!subject ? (
          <div className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80">
            Choose a subject first
          </div>
        ) : availableSets.length === 0 ? (
          <div className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80">
            No sets available for {subject}
          </div>
        ) : (
          <div className="max-h-32 overflow-y-auto pr-1 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onSelectAllSets}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                sets.length === 0 ? activeChipClass : inactiveChipClass
              }`}
            >
              All
            </button>
            {availableSets.map((s) => {
              const isSelected = sets.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onToggleSet(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    isSelected ? activeChipClass : inactiveChipClass
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Multi-Select Question Types */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Select Question Type(s)
        </label>
        {!subject ? (
          <div className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80">
            Choose a subject first
          </div>
        ) : availableTypes.length === 0 ? (
          <div className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80">
            No question types available
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableTypes.map((type) => {
              const isSelected = types.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleType(type)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-[0.98] ${
                    isSelected ? activeChipClass : inactiveChipClass
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({
  stats,
  filterData,
  onStartQuiz,
  onStartWeaknessQuiz,
  onStartFlashcards,
  surname
}) {
  // Mobile-Exclusive Mode Switcher State ('review' | 'weakness' | 'flashcards')
  const [mobileMode, setMobileMode] = useState('review');

  // 1. Review Mode State
  const [reviewSubject, setReviewSubject] = useState('');
  const [reviewSets, setReviewSets] = useState([]);
  const [reviewTypes, setReviewTypes] = useState([]);

  // 2. Weakness Mode State
  const [weaknessSubject, setWeaknessSubject] = useState('');

  // 3. Flashcard Mode State
  const [fcSubject, setFcSubject] = useState('');
  const [fcSets, setFcSets] = useState([]);
  const [fcTypes, setFcTypes] = useState([]);

  // 4. Monthly Calendar Heatmap State & Touch Swipe Ref
  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);
  const touchStartX = useRef(null);

  // Review Mode Handlers
  const handleSelectReviewSubject = (subj) => {
    setReviewSubject(subj);
    setReviewSets([]);
    setReviewTypes([]);
  };

  const toggleReviewSet = (set) => {
    setReviewSets((prev) =>
      prev.includes(set) ? prev.filter((s) => s !== set) : [...prev, set]
    );
  };

  const toggleReviewType = (type) => {
    setReviewTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const resetReviewMode = () => {
    setReviewSubject('');
    setReviewSets([]);
    setReviewTypes([]);
  };

  const handleStartReview = (limit) => {
    if (!reviewSubject) return alert('Please select a subject first.');
    if (reviewTypes.length === 0) {
      return alert('Please select at least one question type (Elements, Problem Solving, or both).');
    }
    onStartQuiz(reviewSubject, reviewSets, reviewTypes, limit);
  };

  // Weakness Mode Handlers
  const resetWeaknessMode = () => {
    setWeaknessSubject('');
  };

  const handleStartWeakness = () => {
    if (!weaknessSubject) return alert('Please choose a subject first.');
    onStartWeaknessQuiz(weaknessSubject, 30);
  };

  // Flashcard Mode Handlers
  const handleSelectFcSubject = (subj) => {
    setFcSubject(subj);
    setFcSets([]);
    setFcTypes([]);
  };

  const toggleFcSet = (set) => {
    setFcSets((prev) =>
      prev.includes(set) ? prev.filter((s) => s !== set) : [...prev, set]
    );
  };

  const toggleFcType = (type) => {
    setFcTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const resetFlashcardMode = () => {
    setFcSubject('');
    setFcSets([]);
    setFcTypes([]);
  };

  const handleStartFlashcards = () => {
    if (!fcSubject) return alert('Please select a subject first.');
    if (fcTypes.length === 0) {
      return alert('Please select at least one question type (Elements, Problem Solving, or both).');
    }
    onStartFlashcards(fcSubject, fcSets, fcTypes, 100);
  };

  // Monthly Calendar Calculations
  const changeMonth = (offset) => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    setSelectedDayInfo(null);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      changeMonth(diff > 0 ? 1 : -1);
    }
    touchStartX.current = null;
  };

  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const historyMap = stats?.history || {};

    const today = new Date();
    const todayStr = toLocalDateStr(today.getFullYear(), today.getMonth(), today.getDate());

    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ empty: true, key: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toLocalDateStr(year, month, day);
      const count = historyMap[dateStr] || 0;
      let level = 0;
      if (count > 0 && count <= 10) level = 1;
      else if (count > 10 && count <= 30) level = 2;
      else if (count > 30 && count <= 60) level = 3;
      else if (count > 60) level = 4;

      cells.push({
        empty: false,
        key: dateStr,
        day,
        dateStr,
        count,
        level,
        isToday: dateStr === todayStr
      });
    }
    return cells;
  }, [calendarDate, stats]);

  const monthYearLabel = useMemo(() => {
    const shortMonth = calendarDate.toLocaleDateString('en-US', { month: 'short' });
    const shortYear = String(calendarDate.getFullYear()).slice(-2);
    return `${shortMonth} ${shortYear}`;
  }, [calendarDate]);

  if (!stats) return null;

  const accuracy =
    stats.totalQuestions > 0
      ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
      : 0;
  const avgTime =
    stats.totalQuestions > 0
      ? Math.round(stats.totalTimeSpent / stats.totalQuestions)
      : 0;

  const renderSubjectCard = (subjectName) => {
    const s = stats.subjects[subjectName];
    if (!s || s.total === 0) return null;

    const probTotal = s.types['Problem Solving']?.total || 0;
    const probAcc =
      probTotal > 0
        ? Math.round((s.types['Problem Solving'].correct / probTotal) * 100)
        : 0;

    const elemTotal = s.types['Elements']?.total || 0;
    const elemAcc =
      elemTotal > 0
        ? Math.round((s.types['Elements'].correct / elemTotal) * 100)
        : 0;

    return (
      <div
        key={subjectName}
        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
      >
        <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center justify-between">
          {subjectName}
          <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
            {s.total} items
          </span>
        </h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-400 font-medium">
              <span>Problem Solving</span>
              <span>{probAcc}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${probAcc}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-400 font-medium">
              <span>Elements</span>
              <span>{elemAcc}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                style={{ width: `${elemAcc}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const levelStyles = [
    'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400',
    'bg-emerald-200 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300',
    'bg-emerald-400 dark:bg-emerald-800 text-emerald-950 dark:text-emerald-100',
    'bg-emerald-500 dark:bg-emerald-600 text-white',
    'bg-emerald-700 dark:bg-emerald-500 text-white font-black'
  ];

  const activeMobileModeIndex = MOBILE_MODES.findIndex((m) => m.id === mobileMode);

  return (
    <div className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-8 max-w-6xl mx-auto animate-in fade-in duration-500 w-full pb-8">
      {/* 1. GREETING */}
      <div className="md:col-span-12 pt-2">
        <h1 className="font-bold">
          <div className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 font-medium">
            Welcome back,
          </div>
          <div className="text-3xl md:text-5xl mt-1 text-slate-800 dark:text-white font-black tracking-tight">
            Engr. {surname}!
          </div>
        </h1>
      </div>

      {/* MOBILE-EXCLUSIVE UNIFIED MODE SWITCHER (Hidden on Desktop md+) */}
      <div className="md:hidden bg-slate-200/75 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
        <div className="relative grid grid-cols-3">
          {/* Smoothly Sliding Active Pill */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 bg-white dark:bg-slate-900 rounded-xl shadow-xs transition-transform duration-300 ease-out pointer-events-none"
            style={{ transform: `translateX(${activeMobileModeIndex * 100}%)` }}
          />
          {MOBILE_MODES.map((mode) => {
            const isActive = mobileMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMobileMode(mode.id)}
                className={`relative z-10 py-2.5 text-xs font-extrabold tracking-wide rounded-xl transition-colors duration-200 ${
                  isActive
                    ? mode.activeText
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. LEFT COLUMN: Single Active Card on Mobile | Stacked Cards on Desktop */}
      <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-5 h-max">
        {/* CARD 1: REVIEW MODE */}
        <div
          className={
            mobileMode === 'review'
              ? 'block animate-in fade-in slide-in-from-bottom-2 duration-300'
              : 'hidden md:block'
          }
        >
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">
                Review Mode
              </h3>
              <button
                type="button"
                onClick={resetReviewMode}
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <ModeFilterSelectors
              subject={reviewSubject}
              onSelectSubject={handleSelectReviewSubject}
              sets={reviewSets}
              onToggleSet={toggleReviewSet}
              onSelectAllSets={() => setReviewSets([])}
              types={reviewTypes}
              onToggleType={toggleReviewType}
              filterData={filterData}
              accentColor="blue"
            />

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleStartReview(9999)}
                className="w-full bg-slate-900 dark:bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-blue-700 transition shadow-xs active:scale-[0.99]"
              >
                <Play className="w-4 h-4 fill-current" /> Start
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleStartReview(10)}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-3 rounded-xl text-xs sm:text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200/80 dark:border-slate-700"
                >
                  Quick Review (10)
                </button>
                <button
                  type="button"
                  onClick={() => handleStartReview(100)}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-3 rounded-xl text-xs sm:text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200/80 dark:border-slate-700"
                >
                  Mock Exam (100)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: WEAKNESS MODE */}
        <div
          className={
            mobileMode === 'weakness'
              ? 'block animate-in fade-in slide-in-from-bottom-2 duration-300'
              : 'hidden md:block'
          }
        >
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-red-200/80 dark:border-red-500/25 shadow-xs transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                Weakness Mode
              </h3>
              <button
                type="button"
                onClick={resetWeaknessMode}
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <div className="mb-4">
              <select
                value={weaknessSubject}
                onChange={(e) => setWeaknessSubject(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              >
                <option value="" disabled>
                  Choose subject
                </option>
                {SUBJECTS.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleStartWeakness}
              className="w-full bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-500/25 transition border border-red-200 dark:border-red-500/30 active:scale-[0.99]"
            >
              <Play className="w-4 h-4 fill-current" /> Review Missed Items
            </button>
          </div>
        </div>

        {/* CARD 3: FLASHCARD MODE */}
        <div
          className={
            mobileMode === 'flashcards'
              ? 'block animate-in fade-in slide-in-from-bottom-2 duration-300'
              : 'hidden md:block'
          }
        >
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-indigo-200/80 dark:border-indigo-500/25 shadow-xs transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500 shrink-0" />
                Flashcard Mode
              </h3>
              <button
                type="button"
                onClick={resetFlashcardMode}
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <ModeFilterSelectors
              subject={fcSubject}
              onSelectSubject={handleSelectFcSubject}
              sets={fcSets}
              onToggleSet={toggleFcSet}
              onSelectAllSets={() => setFcSets([])}
              types={fcTypes}
              onToggleType={toggleFcType}
              filterData={filterData}
              accentColor="indigo"
            />

            <button
              type="button"
              onClick={handleStartFlashcards}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-xs active:scale-[0.99]"
            >
              <Play className="w-4 h-4 fill-current" /> Start Flashcards
            </button>
          </div>
        </div>
      </div>

      {/* 3. RIGHT COLUMN: Overall Stats, Subject Performance & Monthly Calendar Heatmap */}
      <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-6 h-max mt-2 md:mt-0">
        {/* Row 1: Overall Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl shrink-0">
              <CheckCircle className="text-emerald-500 w-7 h-7" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                {accuracy}%
              </div>
              <div className="font-semibold text-xs text-slate-500 dark:text-slate-400">
                Overall Accuracy
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl shrink-0">
              <Clock className="text-amber-500 w-7 h-7" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                {formatTime(avgTime)}
              </div>
              <div className="font-semibold text-xs text-slate-500 dark:text-slate-400">
                Avg Time
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="p-3.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl shrink-0">
              <BookOpen className="text-blue-500 w-7 h-7" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                {stats.totalQuestions}
              </div>
              <div className="font-semibold text-xs text-slate-500 dark:text-slate-400">
                Items Done
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Subject Performance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SUBJECTS.map(renderSubjectCard)}
        </div>

        {/* Row 3: Swipeable Minimal Monthly Calendar Heatmap */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs select-none"
        >
          {/* Header: Activity Tracker + Month Year (e.g., Nov 26) */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">
                Activity Tracker
              </h3>
              <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                {monthYearLabel}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 7-Column Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center">
            {WEEKDAYS.map((dayName) => (
              <div
                key={dayName}
                className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Days Heatmap Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarGrid.map((cell) => {
              if (cell.empty) {
                return <div key={cell.key} className="aspect-square" />;
              }
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDayInfo(cell)}
                  title={`${cell.dateStr}: ${cell.count} items`}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-transform active:scale-95 ${
                    levelStyles[cell.level]
                  } ${
                    cell.isToday
                      ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900'
                      : ''
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer: Selected Day Readout + Intensity Scale */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-400">
            <span>
              {selectedDayInfo
                ? `${selectedDayInfo.dateStr}: ${selectedDayInfo.count} items`
                : 'Swipe left or right to pan months'}
            </span>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-[10px]">Less</span>
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-100 dark:bg-slate-800" />
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-200 dark:bg-emerald-950" />
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 dark:bg-emerald-800" />
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 dark:bg-emerald-600" />
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700 dark:bg-emerald-500" />
              <span className="ml-1 text-[10px]">More</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}