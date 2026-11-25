import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Play,
  Clock,
  CheckCircle,
  BookOpen,
  RotateCcw,
  AlertCircle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Search,
  X
} from 'lucide-react';

const SUBJECTS = ['PIPE', 'MDSP', 'MESL'];
const WEEKDAYS = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

const MODES = [
  { id: 'review', label: 'Review', activeText: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'weakness', label: 'Weakness', activeText: 'text-red-600 dark:text-red-400' },
  { id: 'flashcards', label: 'Flashcards', activeText: 'text-blue-600 dark:text-blue-400' }
];

const GITHUB_LEVEL_CLASSES = [
  'bg-[#ebedf0] dark:bg-[#1e293b]',
  'bg-[#9be9a8] dark:bg-[#0e4429]',
  'bg-[#40c463] dark:bg-[#006d32]',
  'bg-[#30a14e] dark:bg-[#26a641]',
  'bg-[#216e39] dark:bg-[#39d353]'
];

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const toLocalDateStr = (year, monthIndex, day) => {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

function buildMonthCalendar(baseDate, historyMap) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayStr = toLocalDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const shortMonth = baseDate.toLocaleDateString('en-US', { month: 'short' });
  const shortYear = String(year).slice(-2);

  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ empty: true, key: `empty-${year}-${month}-${i}` });
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

  return {
    label: `${shortMonth} ${shortYear}`,
    cells
  };
}

function useMatchingQuestionCount(subject, sets, types, filterData) {
  const hasPrecomputedCounts = useMemo(
    () => Array.isArray(filterData) && filterData.some((d) => typeof d.item_count === 'number'),
    [filterData]
  );

  const instantCount = useMemo(() => {
    if (!hasPrecomputedCounts || !subject || types.length === 0) return null;
    return filterData
      .filter((d) => {
        const matchSubj = d.subject?.trim() === subject;
        const matchSet = sets.length === 0 || sets.includes(d.set_name?.trim());
        const matchType = types.includes(d.question_type?.trim());
        return matchSubj && matchSet && matchType;
      })
      .reduce((sum, d) => sum + (Number(d.item_count) || 0), 0);
  }, [hasPrecomputedCounts, subject, sets, types, filterData]);

  const [fallbackCount, setFallbackCount] = useState(null);

  useEffect(() => {
    if (hasPrecomputedCounts) return;
    if (!subject || types.length === 0) {
      setFallbackCount(null);
      return;
    }

    let cancelled = false;
    async function fetchExactCount() {
      let query = supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('subject', subject)
        .in('question_type', types);

      if (sets.length > 0) {
        query = query.in('set_name', sets);
      }

      const { count } = await query;
      if (!cancelled) setFallbackCount(count ?? 0);
    }

    fetchExactCount();
    return () => {
      cancelled = true;
    };
  }, [hasPrecomputedCounts, subject, sets, types]);

  if (!subject || types.length === 0) return null;
  return hasPrecomputedCounts ? instantCount : fallbackCount;
}

function ModeSwitcherBar({ activeMode, onChange, activeModeIndex }) {
  return (
    <div className="bg-slate-200/75 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
      <div className="relative grid grid-cols-3">
        <div
          className="absolute inset-y-0 left-0 w-1/3 bg-white dark:bg-slate-900 rounded-lg shadow-sm transition-transform duration-300 ease-out pointer-events-none"
          style={{ transform: `translateX(${activeModeIndex * 100}%)` }}
        />
        {MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={`relative z-10 py-2.5 text-xs font-extrabold tracking-wide rounded-lg transition-colors duration-200 ${
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
  );
}

function ModeFilterSelectors({
  subject,
  onSelectSubject,
  sets,
  onToggleSet,
  onSelectAllSets,
  setSearch,
  onSetSearchChange,
  types,
  onToggleType,
  filterData,
  theme = 'emerald'
}) {
  const availableSets = useMemo(() => {
    if (!subject || !filterData) return [];
    return [
      ...new Set(
        filterData
          .filter((d) => d.subject?.trim() === subject)
          .map((d) => d.set_name?.trim())
          .filter(Boolean)
      )
    ].sort();
  }, [subject, filterData]);

  const filteredSets = useMemo(() => {
    const q = setSearch.trim().toLowerCase();
    if (!q) return availableSets;
    return availableSets.filter((s) => s.toLowerCase().includes(q));
  }, [availableSets, setSearch]);

  const availableTypes = useMemo(() => {
    if (!subject || !filterData) return [];
    let relevant = filterData.filter((d) => d.subject?.trim() === subject);
    if (sets.length > 0) {
      relevant = relevant.filter((d) => sets.includes(d.set_name?.trim()));
    }
    return [...new Set(relevant.map((d) => d.question_type?.trim()).filter(Boolean))].sort();
  }, [subject, sets, filterData]);

  const activeChipClass =
    theme === 'emerald'
      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
      : 'bg-blue-600 border-blue-600 text-white shadow-sm';

  const searchFocusClass =
    theme === 'emerald'
      ? 'focus:border-emerald-500 focus:ring-emerald-500/20'
      : 'focus:border-blue-500 focus:ring-blue-500/20';

  const inactiveChipClass =
    'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500';

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && filteredSets.length === 1) {
      e.preventDefault();
      onToggleSet(filteredSets[0]);
    }
  };

  return (
    <div className="space-y-3.5 mb-4">
      {/* 1. Single-Select Subject Chips */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
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

      {/* 2. Multi-Select Sets with Inline Search + Scrollable Viewport */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Select Set(s)
          </label>
          {subject && availableSets.length > 0 && (
            <button
              type="button"
              onClick={onSelectAllSets}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              {sets.length === 0 ? 'All selected' : `${sets.length} selected • Clear`}
            </button>
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
          <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 p-2 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={setSearch}
                onChange={(e) => onSetSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={`Filter ${availableSets.length} sets...`}
                className={`w-full pl-8 pr-7 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-base sm:text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 transition ${searchFocusClass}`}
              />
              {setSearch && (
                <button
                  type="button"
                  onClick={() => onSetSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear set search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-[clamp(9.5rem,22dvh,13.5rem)] md:max-h-48 overflow-y-auto pr-1 flex flex-wrap gap-1.5 content-start">
              {!setSearch.trim() && (
                <button
                  type="button"
                  onClick={onSelectAllSets}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    sets.length === 0 ? activeChipClass : inactiveChipClass
                  }`}
                >
                  All
                </button>
              )}

              {filteredSets.length === 0 ? (
                <div className="w-full py-3 text-center text-xs text-slate-400 italic">
                  No sets matching "{setSearch}"
                </div>
              ) : (
                filteredSets.map((s) => {
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
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Multi-Select Question Types */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
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

function CompactMonthHeatmap({ monthData, onSelectCell, showMonthSubheader = false }) {
  return (
    <div className="flex flex-col items-center">
      {showMonthSubheader && (
        <div className="w-full text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 text-left">
          {monthData.label}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center">
        {WEEKDAYS.map((dayName) => (
          <div
            key={dayName}
            className="w-7 sm:w-5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500"
          >
            {dayName}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {monthData.cells.map((cell) => {
          if (cell.empty) {
            return <div key={cell.key} className="w-7 h-7 sm:w-5 sm:h-5" />;
          }
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectCell(cell)}
              title={`${cell.dateStr}: ${cell.count} items`}
              aria-label={`${cell.dateStr}: ${cell.count} items`}
              className={`w-7 h-7 sm:w-5 sm:h-5 rounded-[3px] transition-transform hover:scale-110 active:scale-95 ${
                GITHUB_LEVEL_CLASSES[cell.level]
              } ${
                cell.isToday
                  ? 'ring-2 ring-slate-800 dark:ring-white ring-offset-1 dark:ring-offset-slate-900'
                  : ''
              }`}
            />
          );
        })}
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
  const [activeMode, setActiveMode] = useState('review');

  // 1. Review Mode State
  const [reviewSubject, setReviewSubject] = useState('');
  const [reviewSets, setReviewSets] = useState([]);
  const [reviewSetSearch, setReviewSetSearch] = useState('');
  const [reviewTypes, setReviewTypes] = useState([]);

  // 2. Weakness Mode State
  const [weaknessSubject, setWeaknessSubject] = useState('');
  const [missedCountsBySubject, setMissedCountsBySubject] = useState(null);

  // 3. Flashcard Mode State
  const [fcSubject, setFcSubject] = useState('');
  const [fcSets, setFcSets] = useState([]);
  const [fcSetSearch, setFcSetSearch] = useState('');
  const [fcTypes, setFcTypes] = useState([]);

  // 4. Calendar Heatmap State
  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);
  const touchStartX = useRef(null);

  const reviewMatchCount = useMatchingQuestionCount(
    reviewSubject,
    reviewSets,
    reviewTypes,
    filterData
  );
  const fcMatchCount = useMatchingQuestionCount(fcSubject, fcSets, fcTypes, filterData);

  useEffect(() => {
    let cancelled = false;
    async function loadMissedCounts() {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) return;

      const { data } = await supabase
        .from('study_history')
        .select('details')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(30);

      if (cancelled || !data) return;

      const setsMap = { PIPE: new Set(), MDSP: new Set(), MESL: new Set() };
      data.forEach((row) => {
        row.details?.forEach((item) => {
          if (!item.isCorrect && setsMap[item.subject]) {
            setsMap[item.subject].add(item.q);
          }
        });
      });

      setMissedCountsBySubject({
        PIPE: setsMap.PIPE.size,
        MDSP: setsMap.MDSP.size,
        MESL: setsMap.MESL.size
      });
    }

    loadMissedCounts();
    return () => {
      cancelled = true;
    };
  }, [stats?.totalQuizzes]);

  // Review Mode Handlers
  const handleSelectReviewSubject = (subj) => {
    setReviewSubject(subj);
    setReviewSets([]);
    setReviewSetSearch('');
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
    setReviewSetSearch('');
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
    if (!weaknessSubject) return alert('Please select a subject first.');
    onStartWeaknessQuiz(weaknessSubject, 30);
  };

  // Flashcard Mode Handlers
  const handleSelectFcSubject = (subj) => {
    setFcSubject(subj);
    setFcSets([]);
    setFcSetSearch('');
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
    setFcSetSearch('');
    setFcTypes([]);
  };

  const handleStartFlashcards = () => {
    if (!fcSubject) return alert('Please select a subject first.');
    if (fcTypes.length === 0) {
      return alert('Please select at least one question type (Elements, Problem Solving, or both).');
    }
    onStartFlashcards(fcSubject, fcSets, fcTypes, 100);
  };

  // Calendar Navigation & Touch Swipe
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

  const prevMonthData = useMemo(() => {
    const prevDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    return buildMonthCalendar(prevDate, stats?.history || {});
  }, [calendarDate, stats]);

  const currentMonthData = useMemo(() => {
    return buildMonthCalendar(calendarDate, stats?.history || {});
  }, [calendarDate, stats]);

  if (!stats) return null;

  const accuracy =
    stats.totalQuestions > 0
      ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
      : 0;
  const avgTime =
    stats.totalQuestions > 0
      ? Math.round(stats.totalTimeSpent / stats.totalQuestions)
      : 0;

  const activeModeIndex = MODES.findIndex((m) => m.id === activeMode);
  const weaknessMatchCount =
    weaknessSubject && missedCountsBySubject ? missedCountsBySubject[weaknessSubject] : null;

  const activeSubjects = SUBJECTS.filter(
    (subj) => stats.subjects[subj] && stats.subjects[subj].total > 0
  );

  const desktopLeftBorderAccent =
    activeMode === 'review'
      ? 'md:border-emerald-500/25'
      : activeMode === 'weakness'
      ? 'md:border-red-500/25'
      : 'md:border-blue-500/25';

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
        className="bg-white dark:bg-slate-900 md:bg-slate-50/80 md:dark:bg-slate-800/50 p-5 md:p-4 rounded-2xl md:rounded-xl border border-slate-200 dark:border-slate-800 md:border-slate-200/70 md:dark:border-slate-700/60 shadow-sm md:shadow-none"
      >
        <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center justify-between">
          <span>{subjectName}</span>
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 md:bg-white md:dark:bg-slate-900/80 px-2 py-0.5 rounded">
            {s.total} items
          </span>
        </h4>
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-400 font-medium">
              <span>Problem Solving</span>
              <span>{probAcc}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 md:bg-slate-200/70 md:dark:bg-slate-900 rounded-full h-1.5">
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
            <div className="w-full bg-slate-100 dark:bg-slate-800 md:bg-slate-200/70 md:dark:bg-slate-900 rounded-full h-1.5">
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

  return (
    <div className="flex flex-col md:grid md:grid-cols-2 md:items-start gap-3.5 md:gap-8 max-w-7xl mx-auto animate-in fade-in duration-500 w-full pb-8">
      {/* GREETING (Full Width Across Top) */}
      <div className="md:col-span-2 pt-1 md:pt-2">
        <h1 className="font-bold">
          <div className="text-lg md:text-2xl text-slate-500 dark:text-slate-400 font-medium">
            Welcome back,
          </div>
          <div className="text-2xl sm:text-3xl md:text-5xl mt-0.5 text-slate-800 dark:text-white font-black tracking-tight">
            Engr. {surname}!
          </div>
        </h1>
      </div>

      {/* MOBILE-ONLY STANDALONE MODE SWITCHER (Preserves Mobile View) */}
      <div className="md:hidden">
        <ModeSwitcherBar
          activeMode={activeMode}
          onChange={setActiveMode}
          activeModeIndex={activeModeIndex}
        />
      </div>

      {/* =========================================================
          GROUP 1 (LEFT 50% ON DESKTOP): UNIFIED STUDY SETUP GROUP
         ========================================================= */}
      <div
        className={`w-full md:bg-white md:dark:bg-slate-900 md:p-6 md:rounded-2xl md:border border-slate-200 dark:border-slate-800 ${desktopLeftBorderAccent} md:shadow-sm transition-colors`}
      >
        {/* Embedded Mode Switcher Inside Group 1 on Desktop */}
        <div className="hidden md:block mb-5">
          <ModeSwitcherBar
            activeMode={activeMode}
            onChange={setActiveMode}
            activeModeIndex={activeModeIndex}
          />
        </div>

        {/* REVIEW MODE */}
        {activeMode === 'review' && (
          <div className="bg-white dark:bg-slate-900 md:bg-transparent md:dark:bg-transparent p-4 sm:p-6 md:p-0 rounded-2xl md:rounded-none border border-emerald-200/80 dark:border-emerald-500/25 md:border-0 shadow-sm md:shadow-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">
                  Review Mode
                </h3>
                {reviewMatchCount !== null && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 animate-in fade-in duration-200">
                    {reviewMatchCount.toLocaleString()} {reviewMatchCount === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetReviewMode}
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white transition shrink-0"
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
              setSearch={reviewSetSearch}
              onSetSearchChange={setReviewSetSearch}
              types={reviewTypes}
              onToggleType={toggleReviewType}
              filterData={filterData}
              theme="emerald"
            />

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={reviewMatchCount === 0}
                onClick={() => handleStartReview(9999)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-sm active:scale-[0.99]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {reviewMatchCount !== null && reviewMatchCount > 0
                    ? `Start (${Math.min(reviewMatchCount, 1000).toLocaleString()})`
                    : 'Start'}
                </span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={reviewMatchCount === 0}
                  onClick={() => handleStartReview(10)}
                  className="w-full bg-emerald-50/70 dark:bg-slate-800 text-emerald-800 dark:text-slate-200 font-bold py-2.5 px-3 rounded-xl text-xs sm:text-sm hover:bg-emerald-100 dark:hover:bg-slate-700 disabled:opacity-50 transition border border-emerald-200/70 dark:border-slate-700"
                >
                  Quick Review (10)
                </button>
                <button
                  type="button"
                  disabled={reviewMatchCount === 0}
                  onClick={() => handleStartReview(100)}
                  className="w-full bg-emerald-50/70 dark:bg-slate-800 text-emerald-800 dark:text-slate-200 font-bold py-2.5 px-3 rounded-xl text-xs sm:text-sm hover:bg-emerald-100 dark:hover:bg-slate-700 disabled:opacity-50 transition border border-emerald-200/70 dark:border-slate-700"
                >
                  Mock Exam (100)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WEAKNESS MODE */}
        {activeMode === 'weakness' && (
          <div className="bg-white dark:bg-slate-900 md:bg-transparent md:dark:bg-transparent p-4 sm:p-6 md:p-0 rounded-2xl md:rounded-none border border-red-200/80 dark:border-red-500/25 md:border-0 shadow-sm md:shadow-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  Weakness Mode
                </h3>
                {weaknessMatchCount !== null && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 animate-in fade-in duration-200">
                    {weaknessMatchCount} missed
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetWeaknessMode}
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white transition shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Select Subject
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SUBJECTS.map((subj) => {
                  const isSelected = weaknessSubject === subj;
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setWeaknessSubject(isSelected ? '' : subj)}
                      className={`py-2 px-3 rounded-xl border text-sm font-bold transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'bg-red-600 border-red-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      {subj}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartWeakness}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-sm active:scale-[0.99]"
            >
              <Play className="w-4 h-4 fill-current" /> Review Missed Items
            </button>
          </div>
        )}

        {/* FLASHCARD MODE */}
        {activeMode === 'flashcards' && (
          <div className="bg-white dark:bg-slate-900 md:bg-transparent md:dark:bg-transparent p-4 sm:p-6 md:p-0 rounded-2xl md:rounded-none border border-blue-200/80 dark:border-blue-500/25 md:border-0 shadow-sm md:shadow-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  Flashcard Mode
                </h3>
                {fcMatchCount !== null && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 animate-in fade-in duration-200">
                    {fcMatchCount.toLocaleString()} {fcMatchCount === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetFlashcardMode}
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white transition shrink-0"
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
              setSearch={fcSetSearch}
              onSetSearchChange={setFcSetSearch}
              types={fcTypes}
              onToggleType={toggleFcType}
              filterData={filterData}
              theme="blue"
            />

            <button
              type="button"
              disabled={fcMatchCount === 0}
              onClick={handleStartFlashcards}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-sm active:scale-[0.99]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {fcMatchCount !== null && fcMatchCount > 0
                  ? `Start Flashcards (${Math.min(fcMatchCount, 100)})`
                  : 'Start Flashcards'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* =========================================================
          GROUP 2 (RIGHT 50% ON DESKTOP): UNIFIED STATS & ACTIVITY GROUP
         ========================================================= */}
      <div className="w-full flex flex-col gap-5 md:gap-0 md:bg-white md:dark:bg-slate-900 md:p-6 md:rounded-2xl md:border md:border-slate-200 md:dark:border-slate-800 md:shadow-sm md:divide-y md:divide-slate-200 md:dark:divide-slate-800 mt-2 md:mt-0">
        {/* Section 1: Overall Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 md:pb-5">
          <div className="bg-white dark:bg-slate-900 md:bg-slate-50/80 md:dark:bg-slate-800/50 p-4 rounded-2xl md:rounded-xl border border-slate-200 dark:border-slate-800 md:border-slate-200/70 md:dark:border-slate-700/60 shadow-sm md:shadow-none flex items-center md:flex-col xl:flex-row md:items-start xl:items-center gap-3.5 md:gap-2 xl:gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl shrink-0">
              <CheckCircle className="text-emerald-500 w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl md:text-xl xl:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                {accuracy}%
              </div>
              <div className="font-semibold text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Overall Accuracy
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 md:bg-slate-50/80 md:dark:bg-slate-800/50 p-4 rounded-2xl md:rounded-xl border border-slate-200 dark:border-slate-800 md:border-slate-200/70 md:dark:border-slate-700/60 shadow-sm md:shadow-none flex items-center md:flex-col xl:flex-row md:items-start xl:items-center gap-3.5 md:gap-2 xl:gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl shrink-0">
              <Clock className="text-amber-500 w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl md:text-xl xl:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                {formatTime(avgTime)}
              </div>
              <div className="font-semibold text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Avg Time
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 md:bg-slate-50/80 md:dark:bg-slate-800/50 p-4 rounded-2xl md:rounded-xl border border-slate-200 dark:border-slate-800 md:border-slate-200/70 md:dark:border-slate-700/60 shadow-sm md:shadow-none flex items-center md:flex-col xl:flex-row md:items-start xl:items-center gap-3.5 md:gap-2 xl:gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl shrink-0">
              <BookOpen className="text-blue-500 w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl md:text-xl xl:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                {stats.totalQuestions}
              </div>
              <div className="font-semibold text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Items Done
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Subject Performance (Adapts cleanly to 1, 2, or 3 active subjects) */}
        {activeSubjects.length > 0 && (
          <div
            className={`grid grid-cols-1 gap-3.5 md:py-5 ${
              activeSubjects.length === 1
                ? 'sm:grid-cols-1'
                : activeSubjects.length === 2
                ? 'sm:grid-cols-2'
                : 'sm:grid-cols-3'
            }`}
          >
            {activeSubjects.map(renderSubjectCard)}
          </div>
        )}

        {/* Section 3: Activity Tracker */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="bg-white dark:bg-slate-900 md:bg-transparent md:dark:bg-transparent p-5 md:p-0 md:pt-5 rounded-2xl md:rounded-none border border-slate-200 dark:border-slate-800 md:border-0 shadow-sm md:shadow-none select-none"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">
                Activity Tracker
              </h3>
              <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="lg:hidden">{currentMonthData.label}</span>
                <span className="hidden lg:inline">
                  {prevMonthData.label} – {currentMonthData.label}
                </span>
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

          <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center lg:justify-evenly gap-6 py-1">
            <div className="hidden lg:block">
              <CompactMonthHeatmap
                monthData={prevMonthData}
                onSelectCell={setSelectedDayInfo}
                showMonthSubheader={true}
              />
            </div>

            <div>
              <div className="hidden lg:block">
                <CompactMonthHeatmap
                  monthData={currentMonthData}
                  onSelectCell={setSelectedDayInfo}
                  showMonthSubheader={true}
                />
              </div>
              <div className="lg:hidden">
                <CompactMonthHeatmap
                  monthData={currentMonthData}
                  onSelectCell={setSelectedDayInfo}
                  showMonthSubheader={false}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-400">
            <span>
              {selectedDayInfo
                ? `${selectedDayInfo.dateStr}: ${selectedDayInfo.count} items`
                : 'Tap or hover a square for details'}
            </span>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-[10px]">Less</span>
              {GITHUB_LEVEL_CLASSES.map((cls, idx) => (
                <span key={idx} className={`w-3 h-3 rounded-[2px] ${cls}`} />
              ))}
              <span className="ml-1 text-[10px]">More</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}