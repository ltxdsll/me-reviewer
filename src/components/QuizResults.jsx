// ==========================================
// RESULTS COMPONENT
// ==========================================

import React from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function QuizResults({ results, score, onBack }) {
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