'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Author = { display_name: string; is_admin: boolean } | null;
type Question = {
  id: string;
  body: string;
  created_at: string;
  student_id: string;
  profiles: Author;
};
type Reply = {
  id: string;
  body: string;
  created_at: string;
  question_id: string;
  student_id: string;
  profiles: Author;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

function initial(name: string) {
  return name?.trim()?.[0] ?? '؟';
}

export default function CommunityFeed({
  currentUserId,
  currentUserDisplayName,
  initialQuestions,
  initialReplies,
}: {
  currentUserId: string;
  currentUserDisplayName: string;
  initialQuestions: Question[];
  initialReplies: Reply[];
}) {
  const supabase = createClient();
  const [questions, setQuestions] = useState(initialQuestions);
  const [replies, setReplies] = useState(initialReplies);
  const [composing, setComposing] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);

  async function submitQuestion() {
    if (!newQuestion.trim()) return;
    setPosting(true);
    const { data, error } = await supabase
      .from('questions')
      .insert({ body: newQuestion.trim(), student_id: currentUserId })
      .select('id, body, created_at, student_id')
      .single();
    setPosting(false);
    if (!error && data) {
      setQuestions([
        { ...data, profiles: { display_name: currentUserDisplayName, is_admin: false } },
        ...questions,
      ]);
      setNewQuestion('');
      setComposing(false);
    }
  }

  async function submitReply(questionId: string) {
    const body = replyDrafts[questionId];
    if (!body?.trim()) return;
    const { data, error } = await supabase
      .from('replies')
      .insert({ body: body.trim(), question_id: questionId, student_id: currentUserId })
      .select('id, body, created_at, question_id, student_id')
      .single();
    if (!error && data) {
      setReplies([...replies, { ...data, profiles: { display_name: currentUserDisplayName, is_admin: false } }]);
      setReplyDrafts({ ...replyDrafts, [questionId]: '' });
    }
  }

  return (
    <div>
      <div
        className="card px-5 py-5 mb-7 cursor-text hover:border-goldDim transition"
        onClick={() => setComposing(true)}
      >
        {!composing ? (
          <span className="text-muted text-[15px]">✏️ اكتب سؤالك هنا...</span>
        ) : (
          <div>
            <textarea
              autoFocus
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="اكتب سؤالك هنا..."
              rows={3}
              className="w-full bg-transparent text-[15px] focus:outline-none resize-none placeholder:text-muted"
            />
            <div className="flex gap-2 justify-end mt-3">
              <button className="btn-ghost !py-2 !px-4 text-xs" onClick={() => setComposing(false)}>
                إلغاء
              </button>
              <button className="btn-primary !py-2 !px-4 text-xs" onClick={submitQuestion} disabled={posting}>
                نشر السؤال
              </button>
            </div>
          </div>
        )}
      </div>

      {questions.map((q) => {
        const qReplies = replies.filter((r) => r.question_id === q.id);
        const isAdminAuthor = q.profiles?.is_admin;
        return (
          <div key={q.id} className="card p-6 mb-4.5">
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className={`w-10 h-10 rounded-full bg-surface2 border flex items-center justify-center font-cairo font-bold text-sm ${
                  isAdminAuthor ? 'border-gold' : 'border-border'
                }`}
              >
                {isAdminAuthor ? 'DK' : initial(q.profiles?.display_name ?? '')}
              </div>
              <span className="font-cairo font-bold text-[14.5px]">{q.profiles?.display_name}</span>
              {isAdminAuthor && <span className="coach-badge">✓ المدرب</span>}
              <span className="text-xs text-muted2 mr-auto">{timeAgo(q.created_at)}</span>
            </div>
            <p className="leading-relaxed">{q.body}</p>

            {qReplies.map((r) => {
              const rIsAdmin = r.profiles?.is_admin;
              return (
                <div
                  key={r.id}
                  className={`mt-4 pr-5 border-r-2 pt-4 pb-0.5 ${
                    rIsAdmin ? 'border-goldDim bg-gradient-to-l from-[rgba(212,177,94,0.04)] to-transparent rounded-l-lg' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className={`w-8 h-8 rounded-full bg-surface2 border flex items-center justify-center font-cairo font-bold text-[12.5px] ${
                        rIsAdmin ? 'border-gold' : 'border-border'
                      }`}
                    >
                      {rIsAdmin ? 'DK' : initial(r.profiles?.display_name ?? '')}
                    </div>
                    <span className="font-cairo font-bold text-[13.5px]">{r.profiles?.display_name}</span>
                    {rIsAdmin && <span className="coach-badge">✓ المدرب</span>}
                    <span className="text-xs text-muted2 mr-auto">{timeAgo(r.created_at)}</span>
                  </div>
                  <p className="leading-relaxed text-[14.5px]">{r.body}</p>
                </div>
              );
            })}

            <div className="flex gap-2 mt-4">
              <input
                value={replyDrafts[q.id] ?? ''}
                onChange={(e) => setReplyDrafts({ ...replyDrafts, [q.id]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submitReply(q.id)}
                placeholder="اكتب ردًا..."
                className="flex-1 bg-white/[0.02] border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-gold"
              />
              <button className="btn-ghost !py-2 !px-4 text-xs" onClick={() => submitReply(q.id)}>
                رد
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
