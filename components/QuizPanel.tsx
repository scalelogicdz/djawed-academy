'use client';

import { useState } from 'react';

type QuizQuestion = { id: string; question: string; options: string[]; correct_index: number };

export default function QuizPanel({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  if (questions.length === 0) return null;

  return (
    <div className="card p-6 mb-5 border-goldDim">
      <h3 className="font-cairo font-bold text-[16px] mb-1">🧠 اختبر فهمك</h3>
      <p className="text-muted text-[13px] mb-5">أجب عن الأسئلة التالية لتتأكد من فهمك لما شاهدته — هذا اختبار ذاتي فقط</p>
      <div className="space-y-6">
        {questions.map((q, qi) => {
          const selected = answers[q.id];
          return (
            <div key={q.id}>
              <p className="font-semibold text-[14.5px] mb-3">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  let stateClass = 'border-border hover:border-goldDim text-text';
                  if (selected !== undefined) {
                    if (i === q.correct_index) stateClass = 'border-success bg-success/10 text-success';
                    else if (i === selected) stateClass = 'border-[#E4756A] bg-[#E4756A]/10 text-[#E4756A]';
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => setAnswers({ ...answers, [q.id]: i })}
                      className={`w-full text-right px-4 py-2.5 rounded-lg border text-sm transition ${stateClass}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
