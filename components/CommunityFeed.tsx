'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/LoadingSpinner';

type Author = { display_name: string; is_admin: boolean } | null;
type Question = { id: string; body: string; image_url: string | null; created_at: string; student_id: string; profiles: Author };
type Reply = { id: string; body: string; created_at: string; question_id: string; student_id: string; profiles: Author };

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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CommunityFeed({
  currentUserId,
  currentUserDisplayName,
  currentUserIsAdmin,
  initialQuestions,
  initialReplies,
}: {
  currentUserId: string;
  currentUserDisplayName: string;
  currentUserIsAdmin: boolean;
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
  const [replyPostingId, setReplyPostingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!highlightedId) return;
    setJustArrivedId(highlightedId);
    setExpandedIds((prev) => new Set(prev).add(highlightedId));
    const el = questionRefs.current[highlightedId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeout = setTimeout(() => setJustArrivedId(null), 3000);
    return () => clearTimeout(timeout);
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
    if (!newQuestion.trim() || posting) return;
    setPosting(true);

    const { data, error } = await supabase
      .from('questions')
      .insert({ body: newQuestion.trim(), student_id: currentUserId })
      .select('id, body, image_url, created_at, student_id')
      .single();

    setPosting(false);

    if (!error && data) {
      setQuestions([{ ...data, profiles: { display_name: currentUserDisplayName, is_admin: currentUserIsAdmin } }, ...questions]);
      setNewQuestion('');
    }
  }

  async function submitReply(questionId: string) {
    const body = replyDrafts[questionId];
    if (!body?.trim() || replyPostingId === questionId) return;
    setReplyPostingId(questionId);

    const { data, error } = await supabase
      .from('replies')
      .insert({ body: body.trim(), question_id: questionId, student_id: currentUserId })
      .select('id, body, created_at, question_id, student_id')
      .single();

    setReplyPostingId(null);

    if (!error && data) {
      setReplies([...replies, { ...data, profiles: { display_name: currentUserDisplayName, is_admin: currentUserIsAdmin } }]);
      setReplyDrafts({ ...replyDrafts, [questionId]: '' });
    }
  }

  function startEditingQuestion(question: Question) {
    setOpenMenuId(null);
    setEditingQuestionId(question.id);
    setEditDraft(question.body);
    setActionError((current) => ({ ...current, [question.id]: '' }));
  }

  function cancelEditingQuestion() {
    setEditingQuestionId(null);
    setEditDraft('');
  }

  async function saveQuestionEdit(questionId: string) {
    const body = editDraft.trim();
    if (!body || savingEdit) return;

    setSavingEdit(true);
    const res = await fetch('/api/community/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: questionId, body }),
    });
    const data = await res.json();
    setSavingEdit(false);

    if (!res.ok) {
      setActionError((current) => ({ ...current, [questionId]: data.error ?? 'تعذر تعديل المنشور' }));
      return;
    }

    setQuestions((current) => current.map((q) => (q.id === questionId ? { ...q, body: data.post.body } : q)));
    setEditingQuestionId(null);
    setEditDraft('');
  }

  async function deleteQuestion(questionId: string) {
    setOpenMenuId(null);
    if (!window.confirm('هل أنت متأكد من حذف هذا المنشور؟ سيتم حذف الردود التابعة له أيضًا.')) return;
    if (deletingQuestionId) return;

    setDeletingQuestionId(questionId);
    const res = await fetch('/api/community/posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: questionId }),
    });
    const data = await res.json();
    setDeletingQuestionId(null);

    if (!res.ok) {
      setActionError((current) => ({ ...current, [questionId]: data.error ?? 'تعذر حذف المنشور' }));
      return;
    }

    setQuestions((current) => current.filter((q) => q.id !== questionId));
    setReplies((current) => current.filter((r) => r.question_id !== questionId));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-white/[0.07] bg-[#111925] p-4 sm:p-5 shadow-[0_16px_34px_-28px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/profile/${currentUserId}`}
            className={`avatar-ring ${currentUserIsAdmin ? 'admin' : ''}`}
            style={{ width: 40, height: 40, fontSize: 14 }}
            aria-label="ملفي الشخصي"
          >
            {currentUserIsAdmin ? 'DK' : initial(currentUserDisplayName)}
          </Link>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-text">شارك سؤالًا أو فكرة</div>
            <div className="text-[11.5px] text-muted2 mt-0.5">اكتب بوضوح حتى تحصل على إجابات أفضل.</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.075] bg-black/[0.08] transition-all duration-200 focus-within:border-gold/40 focus-within:bg-white/[0.018] focus-within:shadow-[0_0_0_3px_rgba(212,177,94,0.045)]">
          <textarea
            value={newQuestion}
            onChange={(e) => {
              setNewQuestion(e.target.value);
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 220)}px`;
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !posting) {
                e.preventDefault();
                submitQuestion();
              }
            }}
            rows={2}
            placeholder="اكتب سؤالك أو شارك تجربتك..."
            className="block w-full min-h-[74px] max-h-[220px] resize-none overflow-y-auto bg-transparent px-4 pt-4 pb-2 text-[14px] sm:text-[14.5px] leading-7 text-text placeholder:text-muted2 outline-none text-right"
          />

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.055] px-3 py-2.5">
            <span className="hidden sm:block text-[10.5px] text-muted2">Ctrl + Enter للنشر</span>
            <div className="sm:hidden" />
            <button
              type="button"
              onClick={submitQuestion}
              disabled={posting || !newQuestion.trim()}
              aria-busy={posting}
              className="inline-flex min-w-[86px] items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold to-goldSoft px-4 py-2.5 text-[13px] font-bold text-[#100C02] shadow-[0_8px_20px_-12px_rgba(212,177,94,0.72)] transition hover:brightness-105 disabled:opacity-45 disabled:shadow-none"
            >
              {posting ? <LoadingSpinner size={14} className="text-[#100C02]" /> : <SendIcon />}
              <span>{posting ? 'جارٍ النشر...' : 'نشر'}</span>
            </button>
          </div>
        </div>
      </div>

      {questions.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.018] px-5 py-10 text-center">
          <div className="text-[15px] font-bold mb-1">لا توجد منشورات بعد</div>
          <p className="text-muted text-[13px]">ابدأ أول نقاش في المجتمع.</p>
        </div>
      )}

      {questions.map((q) => {
        const qReplies = replies.filter((r) => r.question_id === q.id);
        const isAdminAuthor = q.profiles?.is_admin;
        const expanded = expandedIds.has(q.id);
        const isOwner = q.student_id === currentUserId;
        const isEditing = editingQuestionId === q.id;
        const canOpenMenu = isOwner || currentUserIsAdmin;

        return (
          <div
            key={q.id}
            ref={(el) => {
              questionRefs.current[q.id] = el;
            }}
            dir="rtl"
            className={`rounded-[22px] border bg-[#111925] px-4 sm:px-6 py-5 sm:py-6 text-right shadow-[0_18px_42px_-30px_rgba(0,0,0,0.9)] transition-all duration-500 ${
              justArrivedId === q.id
                ? 'border-gold/60 shadow-[0_0_0_1px_rgba(212,177,94,0.16),0_18px_42px_-28px_rgba(212,177,94,0.28)]'
                : 'border-white/[0.07] hover:border-white/[0.11]'
            }`}
          >
            <div className="relative flex items-start gap-3.5 mb-4" dir="ltr">
              <Link
                href={`/profile/${q.student_id}`}
                className={`avatar-ring ${isAdminAuthor ? 'admin' : ''} flex-shrink-0 hover:border-gold transition`}
                aria-label={`ملف ${q.profiles?.display_name ?? ''}`}
                title="عرض الملف الشخصي"
              >
                {isAdminAuthor ? 'DK' : initial(q.profiles?.display_name ?? '')}
              </Link>

              <div className="min-w-0 flex-1 text-left pt-0.5" dir="ltr">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`/profile/${q.student_id}`} className="font-heading font-bold text-[15px] whitespace-nowrap hover:text-gold transition">
                    {q.profiles?.display_name || 'مستخدم'}
                  </Link>
                  {isAdminAuthor && <span className="coach-badge">✓ المدرب</span>}
                  {isOwner && !isAdminAuthor && (
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[10px] font-semibold text-muted2">أنت</span>
                  )}
                </div>
                <span className="text-xs text-muted2 whitespace-nowrap block mt-1">{timeAgo(q.created_at)}</span>
              </div>

              {canOpenMenu && (
                <div className="relative flex-shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(openMenuId === q.id ? null : q.id)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-text hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition"
                    aria-label="خيارات المنشور"
                    aria-expanded={openMenuId === q.id}
                  >
                    <MoreIcon />
                  </button>

                  {openMenuId === q.id && (
                    <div className="absolute right-0 top-11 z-20 min-w-[150px] rounded-xl border border-border bg-[#151E2C] shadow-2xl p-1.5">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => startEditingQuestion(q)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-text hover:bg-white/[0.06] transition text-sm"
                        >
                          <PencilIcon />
                          <span>تعديل المنشور</span>
                        </button>
                      )}
                      {(isOwner || currentUserIsAdmin) && (
                        <button
                          type="button"
                          onClick={() => deleteQuestion(q.id)}
                          disabled={deletingQuestionId === q.id}
                          aria-busy={deletingQuestionId === q.id}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#E4756A] hover:bg-[#E4756A]/10 transition disabled:opacity-70 text-sm"
                        >
                          {deletingQuestionId === q.id ? <LoadingSpinner size={16} /> : <TrashIcon />}
                          <span>{deletingQuestionId === q.id ? 'جارٍ الحذف...' : 'حذف المنشور'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="mb-4 space-y-3">
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={4}
                  className="w-full bg-white/[0.02] border border-border rounded-xl px-4 py-3 text-[15px] leading-7 focus:outline-none focus:border-gold resize-y text-right"
                />
                <div className="flex flex-wrap gap-2 justify-start">
                  <button type="button" onClick={cancelEditingQuestion} disabled={savingEdit} className="px-4 py-2 rounded-lg border border-border text-muted text-sm hover:text-text hover:border-white/[0.12] transition">
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => saveQuestionEdit(q.id)}
                    disabled={savingEdit || !editDraft.trim()}
                    aria-busy={savingEdit}
                    className="inline-flex min-w-[118px] items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] text-[#100C02] font-bold text-sm disabled:opacity-60"
                  >
                    {savingEdit && <LoadingSpinner size={14} />}
                    {savingEdit ? 'جارٍ الحفظ...' : 'حفظ التعديل'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="leading-8 mb-5 text-[14.5px] sm:text-[15px] text-right whitespace-pre-wrap break-words">{q.body}</p>
            )}

            {q.image_url && (
              <div className="mb-4 rounded-xl overflow-hidden border border-border bg-black/10">
                <img src={q.image_url} alt="صورة المنشور" className="block w-full max-h-[560px] object-contain" loading="lazy" />
              </div>
            )}

            <div className="pt-3 border-t border-white/[0.055] flex items-center justify-between gap-3">
              <button onClick={() => toggleExpanded(q.id)} className="reply-toggle">
                <ChatIcon />
                {qReplies.length > 0 ? `${qReplies.length} ${qReplies.length === 1 ? 'رد' : 'ردود'}` : 'أضف ردًا'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <Link href={`/profile/${q.student_id}`} className="hidden sm:inline text-[11.5px] text-muted2 hover:text-gold transition">
                عرض الملف الشخصي
              </Link>
            </div>

            {actionError[q.id] && <p className="text-[#E4756A] text-[12px] mt-3 text-right">{actionError[q.id]}</p>}

            <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
              <div className="overflow-hidden">
                <div className="pt-4">
                  {qReplies.length > 0 && (
                    <div className="mb-3 text-[11.5px] font-semibold text-muted2">الردود</div>
                  )}

                  <div className="space-y-2.5">
                    {qReplies.map((r) => {
                      const rIsAdmin = r.profiles?.is_admin;
                      const rIsCurrentUser = r.student_id === currentUserId;

                      return (
                        <div key={r.id} className={`reply-card ${rIsAdmin ? 'admin' : ''}`}>
                          <div className="flex items-center gap-2.5 mb-2.5" dir="ltr">
                            <Link
                              href={`/profile/${r.student_id}`}
                              className={`avatar-ring ${rIsAdmin ? 'admin' : ''} hover:border-gold transition`}
                              style={{ width: 34, height: 34, fontSize: 13 }}
                              aria-label={`ملف ${r.profiles?.display_name ?? ''}`}
                            >
                              {rIsAdmin ? 'DK' : initial(r.profiles?.display_name ?? '')}
                            </Link>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Link href={`/profile/${r.student_id}`} className="font-heading font-bold text-[13.5px] whitespace-nowrap hover:text-gold transition">
                                  {r.profiles?.display_name || 'مستخدم'}
                                </Link>
                                {rIsAdmin && <span className="coach-badge">✓ المدرب</span>}
                                {rIsCurrentUser && !rIsAdmin && <span className="text-[10px] text-muted2">أنت</span>}
                              </div>
                              <span className="text-[11px] text-muted2 whitespace-nowrap block mt-1">{timeAgo(r.created_at)}</span>
                            </div>
                          </div>
                          <p className="leading-7 text-[14px] sm:text-[14.5px] text-right whitespace-pre-wrap break-words" dir="rtl">{r.body}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="compose-bar mt-4">
                    <input
                      value={replyDrafts[q.id] ?? ''}
                      onChange={(e) => setReplyDrafts({ ...replyDrafts, [q.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && replyPostingId !== q.id && submitReply(q.id)}
                      placeholder="اكتب ردًا..."
                      className="compose-input"
                    />
                    <button
                      className="compose-send"
                      onClick={() => submitReply(q.id)}
                      disabled={replyPostingId === q.id || !(replyDrafts[q.id] ?? '').trim()}
                      aria-busy={replyPostingId === q.id}
                      aria-label="إرسال الرد"
                    >
                      {replyPostingId === q.id ? <LoadingSpinner size={17} className="text-[#100C02]" /> : <SendIcon />}
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
