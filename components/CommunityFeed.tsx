'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Author = { display_name: string; is_admin: boolean } | null;
type Question = { id: string; body: string; created_at: string; student_id: string; profiles: Author };
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

function initial(name: string) { return name?.trim()?.[0] ?? '؟'; }

function ChatIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function SendIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#100C02" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function MoreIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>; }
function PencilIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" strokeLinecap="round" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function TrashIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" strokeLinecap="round" /><path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

export default function CommunityFeed({ currentUserId, currentUserDisplayName, currentUserIsAdmin, initialQuestions, initialReplies }: { currentUserId: string; currentUserDisplayName: string; currentUserIsAdmin: boolean; initialQuestions: Question[]; initialReplies: Reply[] }) {
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
      if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
      return next;
    });
  }

  async function submitQuestion() {
    if (!newQuestion.trim()) return;
    setPosting(true);
    const { data, error } = await supabase.from('questions').insert({ body: newQuestion.trim(), student_id: currentUserId }).select('id, body, created_at, student_id').single();
    setPosting(false);
    if (!error && data) {
      setQuestions([{ ...data, profiles: { display_name: currentUserDisplayName, is_admin: currentUserIsAdmin } }, ...questions]);
      setNewQuestion('');
    }
  }

  async function submitReply(questionId: string) {
    const body = replyDrafts[questionId];
    if (!body?.trim()) return;
    const { data, error } = await supabase.from('replies').insert({ body: body.trim(), question_id: questionId, student_id: currentUserId }).select('id, body, created_at, question_id, student_id').single();
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
  function cancelEditingQuestion() { setEditingQuestionId(null); setEditDraft(''); }

  async function saveQuestionEdit(questionId: string) {
    const body = editDraft.trim(); if (!body) return;
    setSavingEdit(true);
    const res = await fetch('/api/community/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: questionId, body }) });
    const data = await res.json(); setSavingEdit(false);
    if (!res.ok) { setActionError((current) => ({ ...current, [questionId]: data.error ?? 'تعذر تعديل المنشور' })); return; }
    setQuestions((current) => current.map((q) => q.id === questionId ? { ...q, body: data.post.body } : q));
    setEditingQuestionId(null); setEditDraft('');
  }

  async function deleteQuestion(questionId: string) {
    setOpenMenuId(null);
    if (!window.confirm('هل أنت متأكد من حذف هذا المنشور؟ سيتم حذف الردود التابعة له أيضًا.')) return;
    setDeletingQuestionId(questionId);
    const res = await fetch('/api/community/posts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: questionId }) });
    const data = await res.json(); setDeletingQuestionId(null);
    if (!res.ok) { setActionError((current) => ({ ...current, [questionId]: data.error ?? 'تعذر حذف المنشور' })); return; }
    setQuestions((current) => current.filter((q) => q.id !== questionId));
    setReplies((current) => current.filter((r) => r.question_id !== questionId));
  }

  return (
    <div>
      <div className="compose-bar mb-8">
        <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitQuestion()} placeholder="✏️ اكتب سؤالك هنا..." className="compose-input" />
        <button className="compose-send" onClick={submitQuestion} disabled={posting || !newQuestion.trim()}><SendIcon /></button>
      </div>

      {questions.map((q) => {
        const qReplies = replies.filter((r) => r.question_id === q.id);
        const isAdminAuthor = q.profiles?.is_admin;
        const expanded = expandedIds.has(q.id);
        const isOwner = q.student_id === currentUserId;
        const isEditing = editingQuestionId === q.id;
        const canOpenMenu = isOwner || currentUserIsAdmin;

        return (
          <div key={q.id} ref={(el) => { questionRefs.current[q.id] = el; }} dir="rtl" className={`card p-7 mb-6 transition-shadow duration-700 text-right ${justArrivedId === q.id ? 'border-gold shadow-[0_0_0_1px_rgba(212,177,94,0.5),0_0_24px_rgba(212,177,94,0.25)]' : ''}`}>
            <div className="relative flex items-start gap-3 mb-4" dir="ltr">
              <div className={`avatar-ring ${isAdminAuthor ? 'admin' : ''} flex-shrink-0`}>{isAdminAuthor ? 'DK' : initial(q.profiles?.display_name ?? '')}</div>

              <div className="min-w-0 flex-1 text-left pt-0.5" dir="ltr">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-heading font-bold text-[15px] whitespace-nowrap">{q.profiles?.display_name}</span>
                  {isAdminAuthor && <span className="coach-badge">✓ المدرب</span>}
                </div>
                <span className="text-xs text-muted2 whitespace-nowrap block mt-1">{timeAgo(q.created_at)}</span>
              </div>

              {canOpenMenu && (
                <div className="relative flex-shrink-0 ml-auto">
                  <button type="button" onClick={() => setOpenMenuId(openMenuId === q.id ? null : q.id)} className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-white/[0.06] transition" aria-label="خيارات المنشور"><MoreIcon /></button>
                  {openMenuId === q.id && (
                    <div className="absolute right-0 top-10 z-20 min-w-[90px] rounded-xl border border-border bg-[#151E2C] shadow-2xl p-1.5">
                      {isOwner && <button type="button" onClick={() => startEditingQuestion(q)} className="w-full flex items-center justify-center p-2.5 rounded-lg text-text hover:bg-white/[0.06] transition" aria-label="تعديل المنشور" title="تعديل المنشور"><PencilIcon /></button>}
                      {(isOwner || currentUserIsAdmin) && <button type="button" onClick={() => deleteQuestion(q.id)} disabled={deletingQuestionId === q.id} className="w-full flex items-center justify-center p-2.5 rounded-lg text-[#E4756A] hover:bg-[#E4756A]/10 transition disabled:opacity-50" aria-label="حذف المنشور" title="حذف المنشور"><TrashIcon /></button>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="mb-4 space-y-3">
                <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={4} className="w-full bg-white/[0.02] border border-border rounded-xl px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:border-gold resize-y text-right" />
                <div className="flex gap-2 justify-start"><button type="button" onClick={cancelEditingQuestion} className="px-4 py-2 rounded-lg border border-border text-muted text-sm hover:text-text transition">إلغاء</button><button type="button" onClick={() => saveQuestionEdit(q.id)} disabled={savingEdit || !editDraft.trim()} className="px-4 py-2 rounded-lg bg-[#C9A84C] text-[#100C02] font-bold text-sm disabled:opacity-50">{savingEdit ? 'جارٍ الحفظ...' : 'حفظ التعديل'}</button></div>
              </div>
            ) : <p className="leading-relaxed mb-4 text-[15px] text-right">{q.body}</p>}

            <div className="flex items-center justify-start"><button onClick={() => toggleExpanded(q.id)} className="reply-toggle"><ChatIcon />{qReplies.length > 0 ? `${qReplies.length} ${qReplies.length === 1 ? 'رد' : 'ردود'}` : 'أضف ردًا'}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>
            {actionError[q.id] && <p className="text-[#E4756A] text-[12px] mt-2 text-right">{actionError[q.id]}</p>}

            <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
              <div className="overflow-hidden"><div className="pt-1">
                {qReplies.map((r) => {
                  const rIsAdmin = r.profiles?.is_admin;
                  return <div key={r.id} className={`reply-card ${rIsAdmin ? 'admin' : ''}`}>
                    <div className="flex items-center gap-2.5 mb-2" dir="ltr">
                      <div className={`avatar-ring ${rIsAdmin ? 'admin' : ''}`} style={{ width: 34, height: 34, fontSize: 13 }}>{rIsAdmin ? 'DK' : initial(r.profiles?.display_name ?? '')}</div>
                      <div className="flex-1 min-w-0 text-left"><span className="font-heading font-bold text-[13.5px] whitespace-nowrap">{r.profiles?.display_name}</span>{rIsAdmin && <span className="coach-badge ml-2">✓ المدرب</span>}<span className="text-xs text-muted2 whitespace-nowrap block mt-1">{timeAgo(r.created_at)}</span></div>
                    </div>
                    <p className="leading-relaxed text-[14.5px] text-right" dir="rtl">{r.body}</p>
                  </div>;
                })}
                <div className="compose-bar mt-4"><input value={replyDrafts[q.id] ?? ''} onChange={(e) => setReplyDrafts({ ...replyDrafts, [q.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && submitReply(q.id)} placeholder="اكتب ردًا..." className="compose-input" /><button className="compose-send" onClick={() => submitReply(q.id)} disabled={!(replyDrafts[q.id] ?? '').trim()}><SendIcon /></button></div>
              </div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
