'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#100C02" strokeWidth="2.2">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
  const searchParams = useSearchParams();
  const highlightedId = searchParams.get('q');
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState(initialQuestions);
  const [replies, setReplies] = useState(initialReplies);
  const [newQuestion, setNewQuestion] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!highlightedId) return;
    setJustArrivedId(highlightedId);
    setExpandedIds((prev) => new Set(prev).add(highlightedId));
    const el = questionRefs.current[highlightedId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const timeout = setTimeout(() => setJustArrivedId(null), 3000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedId, questions]);

  function toggleExpanded(questionId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

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
      <div className="compose-bar mb-8">
        <input
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitQuestion()}
          placeholder="✏️ اكتب سؤالك هنا..."
          className="compose-input"
        />
        <button className="compose-send" onClick={submitQuestion} disabled={posting || !newQuestion.trim()}>
          <SendIcon />
        </button>
      </div>

      {questions.map((q) => {
        const qReplies = replies.filter((r) => r.question_id === q.id);
        const isAdminAuthor = q.profiles?.is_admin;
        const expanded = expandedIds.has(q.id);

        return (
          <div
            key={q.id}
            ref={(el) => { questionRefs.current[q.id] = el; }}
            className={`card p-7 mb-6 transition-shadow duration-700 ${
              justArrivedId === q.id ? 'border-gold shadow-[0_0_0_1px_rgba(212,177,94,0.5),0_0_24px_rgba(212,177,94,0.25)]' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`avatar-ring ${isAdminAuthor ? 'admin' : ''}`}>
                {isAdminAuthor ? 'DK' : initial(q.profiles?.display_name ?? '')}
              </div>
              <div className="flex-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-heading font-bold text-[15px] whitespace-nowrap">{q.profiles?.display_name}</span>
                {isAdminAuthor && <span className="coach-badge">✓ المدرب</span>}
              </div>
              <span className="text-xs text-muted2 whitespace-nowrap">{timeAgo(q.created_at)}</span>
            </div>
            <p className="leading-relaxed mb-4 text-[15px]">{q.body}</p>

            <button onClick={() => toggleExpanded(q.id)} className="reply-toggle">
              <ChatIcon />
              {qReplies.length > 0
                ? `${qReplies.length} ${qReplies.length === 1 ? 'رد' : 'ردود'}`
                : 'أضف ردًا'}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="pt-1">
                  {qReplies.map((r) => {
                    const rIsAdmin = r.profiles?.is_admin;
                    return (
                      <div key={r.id} className={`reply-card ${rIsAdmin ? 'admin' : ''}`}>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className={`avatar-ring ${rIsAdmin ? 'admin' : ''}`} style={{ width: 34, height: 34, fontSize: 13 }}>
                            {rIsAdmin ? 'DK' : initial(r.profiles?.display_name ?? '')}
                          </div>
                          <div className="flex-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="font-heading font-bold text-[13.5px] whitespace-nowrap">{r.profiles?.display_name}</span>
                            {rIsAdmin && <span className="coach-badge">✓ المدرب</span>}
                          </div>
                          <span className="text-xs text-muted2 whitespace-nowrap">{timeAgo(r.created_at)}</span>
                        </div>
                        <p className="leading-relaxed text-[14.5px]">{r.body}</p>
                      </div>
                    );
                  })}

                  <div className="compose-bar mt-4">
                    <input
                      value={replyDrafts[q.id] ?? ''}
                      onChange={(e) => setReplyDrafts({ ...replyDrafts, [q.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && submitReply(q.id)}
                      placeholder="اكتب ردًا..."
                      className="compose-input"
                    />
                    <button
                      className="compose-send"
                      onClick={() => submitReply(q.id)}
                      disabled={!(replyDrafts[q.id] ?? '').trim()}
                    >
                      <SendIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
