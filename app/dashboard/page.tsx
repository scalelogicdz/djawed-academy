import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import LocalizedText from '@/components/LocalizedText';

function progressMessage(pct: number) {
  if (pct >= 100) return {
    ar: { title: 'أحسنت! أكملت رحلتك التعليمية 🎉', text: 'يمكنك الآن مراجعة أي درس وتثبيت ما تعلمته.' },
    fr: { title: 'Bravo ! Vous avez terminé votre parcours 🎉', text: 'Vous pouvez maintenant revoir les leçons et consolider vos acquis.' },
    en: { title: 'Well done! You completed your learning journey 🎉', text: 'You can now review any lesson and reinforce what you learned.' },
  };
  if (pct >= 75) return {
    ar: { title: 'اقتربت كثيرًا من خط النهاية', text: 'استمر بنفس الوتيرة، لم يتبقَّ سوى القليل.' },
    fr: { title: 'Vous êtes tout près de la ligne d’arrivée', text: 'Gardez le même rythme, il ne reste plus grand-chose.' },
    en: { title: 'You are very close to the finish line', text: 'Keep the same pace; there is only a little left.' },
  };
  if (pct >= 50) return {
    ar: { title: 'تجاوزت نصف الطريق', text: 'تقدم ممتاز. حافظ على الاستمرارية وأنهِ ما بدأت.' },
    fr: { title: 'Vous avez dépassé la moitié du parcours', text: 'Excellent progrès. Restez régulier et terminez ce que vous avez commencé.' },
    en: { title: 'You are past the halfway point', text: 'Excellent progress. Stay consistent and finish what you started.' },
  };
  if (pct >= 25) return {
    ar: { title: 'أنت تبني أساسًا قويًا', text: 'كل درس تكمله يقربك أكثر من إتقان الإعلانات.' },
    fr: { title: 'Vous construisez une base solide', text: 'Chaque leçon terminée vous rapproche davantage de la maîtrise de la publicité.' },
    en: { title: 'You are building a strong foundation', text: 'Every lesson you complete brings you closer to mastering advertising.' },
  };
  if (pct > 0) return {
    ar: { title: 'بداية موفقة', text: 'لا تبحث عن السرعة؛ ركّز على فهم كل خطوة وتطبيقها.' },
    fr: { title: 'Bon début', text: 'Ne cherchez pas la vitesse ; concentrez-vous sur la compréhension et la pratique.' },
    en: { title: 'A good start', text: 'Do not chase speed; focus on understanding and applying each step.' },
  };
  return {
    ar: { title: 'جاهز تبدأ؟', text: 'ابدأ بأول درس وخذ رحلتك خطوة بخطوة.' },
    fr: { title: 'Prêt à commencer ?', text: 'Commencez par la première leçon et avancez étape par étape.' },
    en: { title: 'Ready to start?', text: 'Start with the first lesson and take it one step at a time.' },
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, is_admin')
    .eq('id', user.id)
    .single();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id, courses(id, title, description)')
    .eq('student_id', user.id);

  const { data: progressRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('student_id', user.id);
  const completedIds = new Set((progressRows ?? []).map((p) => p.lesson_id));

  const courseCards = await Promise.all(
    (enrollments ?? []).map(async (enr: any) => {
      const course = enr.courses;

      const { data: modules } = await supabase.from('modules').select('id').eq('course_id', course.id);
      const moduleIds = (modules ?? []).map((m) => m.id);
      const moduleCount = moduleIds.length;

      const { data: lessonsInCourse } = await supabase
        .from('lessons')
        .select('id, title, position')
        .in('module_id', moduleIds.length ? moduleIds : ['00000000-0000-0000-0000-000000000000'])
        .order('position', { ascending: true });

      const lessons = lessonsInCourse ?? [];
      const total = lessons.length;
      const completed = lessons.filter((l) => completedIds.has(l.id)).length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const nextLesson = lessons.find((l) => !completedIds.has(l.id)) ?? lessons[lessons.length - 1] ?? null;
      const isFullyCompleted = total > 0 && completed === total;

      return { course, total, completed, pct, moduleCount, nextLesson, isFullyCompleted };
    })
  );

  const totalLessonsAll = courseCards.reduce((sum, c) => sum + c.total, 0);
  const completedLessonsAll = courseCards.reduce((sum, c) => sum + c.completed, 0);
  const remainingLessonsAll = Math.max(totalLessonsAll - completedLessonsAll, 0);
  const overallPct = totalLessonsAll > 0 ? Math.round((completedLessonsAll / totalLessonsAll) * 100) : 0;
  const motivation = progressMessage(overallPct);

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />

      <main className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-14">
        <section className="relative overflow-hidden rounded-[24px] border border-border bg-surface p-5 sm:p-7 lg:p-9 mb-7 sm:mb-9">
          <div className="pointer-events-none absolute -top-28 -left-20 w-72 h-72 rounded-full bg-gold/[0.06] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-16 w-56 h-56 rounded-full bg-gold/[0.035] blur-3xl" />

          <div className="relative grid lg:grid-cols-[1fr_auto] gap-7 lg:gap-10 items-center">
            <div>
              <div className="eyebrow mb-3"><LocalizedText ar="مساحتك التعليمية" fr="Votre espace d’apprentissage" en="Your learning space" /></div>
              <h1 className="font-heading font-extrabold text-[28px] sm:text-[34px] lg:text-[38px] leading-tight mb-3">
                <LocalizedText
                  ar={`أهلاً، ${profile?.display_name ?? 'بك'}`}
                  fr={`Bienvenue, ${profile?.display_name ?? ''}`}
                  en={`Welcome, ${profile?.display_name ?? ''}`}
                />
              </h1>
              <p className="text-muted text-sm sm:text-[15px] leading-7 max-w-[620px] mb-6">
                <LocalizedText
                  ar="تابع تقدمك، اعرف أين وصلت، وابدأ الدرس التالي من حيث توقفت."
                  fr="Suivez votre progression, voyez où vous en êtes et reprenez la prochaine leçon là où vous vous êtes arrêté."
                  en="Track your progress, see where you are, and continue with the next lesson from where you stopped."
                />
              </p>

              {courseCards.length > 0 && (
                <div className="rounded-2xl border border-gold/15 bg-gold/[0.035] p-4 sm:p-5 max-w-[650px]">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold flex-shrink-0">✦</div>
                    <div>
                      <h2 className="font-cairo font-bold text-[15px] sm:text-base mb-1">
                        <LocalizedText ar={motivation.ar.title} fr={motivation.fr.title} en={motivation.en.title} />
                      </h2>
                      <p className="text-muted text-[12.5px] sm:text-[13.5px] leading-6">
                        <LocalizedText ar={motivation.ar.text} fr={motivation.fr.text} en={motivation.en.text} />
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {courseCards.length > 0 && (
              <div className="flex justify-center lg:justify-end">
                <div
                  className="relative w-[154px] h-[154px] sm:w-[172px] sm:h-[172px] rounded-full p-[9px] shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
                  style={{ background: `conic-gradient(#D4B15E ${overallPct * 3.6}deg, #3A3220 0deg)` }}
                >
                  <div className="w-full h-full rounded-full bg-surface border border-border flex flex-col items-center justify-center text-center">
                    <span className="font-heading font-extrabold text-[34px] sm:text-[39px] text-gold leading-none">{overallPct}%</span>
                    <span className="text-muted text-[11.5px] sm:text-xs mt-2"><LocalizedText ar="التقدم الكلي" fr="Progression globale" en="Overall progress" /></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {courseCards.length > 0 && (
          <section className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-7 sm:mb-9">
            <div className="rounded-2xl border border-border bg-surface p-3.5 sm:p-5 text-center">
              <div className="font-heading font-extrabold text-[22px] sm:text-[29px] text-success">{completedLessonsAll}</div>
              <div className="text-muted text-[10.5px] sm:text-[12.5px] mt-1.5"><LocalizedText ar="دروس مكتملة" fr="Leçons terminées" en="Completed lessons" /></div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-3.5 sm:p-5 text-center">
              <div className="font-heading font-extrabold text-[22px] sm:text-[29px] text-gold">{remainingLessonsAll}</div>
              <div className="text-muted text-[10.5px] sm:text-[12.5px] mt-1.5"><LocalizedText ar="دروس متبقية" fr="Leçons restantes" en="Remaining lessons" /></div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-3.5 sm:p-5 text-center">
              <div className="font-heading font-extrabold text-[22px] sm:text-[29px]">{totalLessonsAll}</div>
              <div className="text-muted text-[10.5px] sm:text-[12.5px] mt-1.5"><LocalizedText ar="إجمالي الدروس" fr="Total des leçons" en="Total lessons" /></div>
            </div>
          </section>
        )}

        {courseCards.length === 0 && (
          <div className="card p-7 sm:p-9 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gold/[0.08] border border-gold/15 flex items-center justify-center mx-auto mb-4 text-gold text-xl">◈</div>
            <h2 className="font-cairo font-bold text-lg mb-2">
              <LocalizedText ar="لا توجد دورة مضافة إلى حسابك بعد" fr="Aucun cours n’a encore été ajouté à votre compte" en="No course has been added to your account yet" />
            </h2>
            <p className="text-muted text-sm leading-7">
              <LocalizedText ar="تواصل مع الدعم إذا كنت قد أتممت عملية التسجيل والدفع." fr="Contactez le support si vous avez déjà terminé l’inscription et le paiement." en="Contact support if you have already completed registration and payment." />
            </p>
          </div>
        )}

        {courseCards.length > 0 && (
          <div className="flex items-end justify-between gap-4 mb-4 sm:mb-5">
            <div>
              <div className="eyebrow mb-2"><LocalizedText ar="دوراتي" fr="Mes cours" en="My courses" /></div>
              <h2 className="font-heading font-extrabold text-[22px] sm:text-[26px]"><LocalizedText ar="واصل من حيث توقفت" fr="Reprenez là où vous vous êtes arrêté" en="Continue where you left off" /></h2>
            </div>
          </div>
        )}

        <section className="space-y-5">
          {courseCards.map(({ course, pct, total, completed, moduleCount, nextLesson, isFullyCompleted }) => {
            const remaining = Math.max(total - completed, 0);

            return (
              <article key={course.id} className="relative overflow-hidden rounded-[22px] border border-border bg-surface p-5 sm:p-7 lg:p-8">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gold/[0.035] blur-3xl rounded-full pointer-events-none" />

                <div className="relative grid lg:grid-cols-[1fr_260px] gap-6 lg:gap-8">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="inline-flex items-center rounded-lg border border-gold/20 bg-gold/[0.055] px-3 py-1.5 text-[11.5px] font-cairo font-bold text-gold">
                        <LocalizedText ar="دورة السبونسور" fr="Cours Meta Ads" en="Meta Ads Course" />
                      </span>
                      {isFullyCompleted && (
                        <span className="inline-flex items-center rounded-lg border border-success/25 bg-success/[0.06] px-3 py-1.5 text-[11.5px] font-semibold text-success">
                          <LocalizedText ar="✓ مكتملة" fr="✓ Terminé" en="✓ Completed" />
                        </span>
                      )}
                    </div>

                    <h3 className="font-heading text-[22px] sm:text-[25px] font-bold mb-2 leading-snug">{course.title}</h3>
                    {course.description && (
                      <p className="text-muted text-[13px] sm:text-[14px] leading-7 max-w-[650px] mb-4">{course.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted text-[12px] sm:text-[13px] mb-6">
                      <span><LocalizedText ar={`${moduleCount} وحدات`} fr={`${moduleCount} modules`} en={`${moduleCount} modules`} /></span>
                      <span className="w-1 h-1 rounded-full bg-muted2" />
                      <span><LocalizedText ar={`${total} درس`} fr={`${total} leçons`} en={`${total} lessons`} /></span>
                      <span className="w-1 h-1 rounded-full bg-muted2" />
                      <span><LocalizedText ar={`${completed} مكتمل`} fr={`${completed} terminées`} en={`${completed} completed`} /></span>
                    </div>

                    <div className="mb-5">
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <span className="text-[12.5px] text-muted"><LocalizedText ar="تقدمك في الدورة" fr="Votre progression" en="Your course progress" /></span>
                        <span className="font-heading font-bold text-gold text-[13.5px]">{pct}%</span>
                      </div>
                      <div className="h-2.5 bg-track rounded-full overflow-hidden border border-white/[0.025]">
                        <div
                          className="h-full bg-gradient-to-l from-goldDim to-gold rounded-full"
                          style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-[11px] text-muted2">
                        <span><LocalizedText ar={`${completed} من ${total} درس`} fr={`${completed} sur ${total} leçons`} en={`${completed} of ${total} lessons`} /></span>
                        {!isFullyCompleted && <span><LocalizedText ar={`متبقي ${remaining}`} fr={`${remaining} restantes`} en={`${remaining} remaining`} /></span>}
                      </div>
                    </div>

                    {!isFullyCompleted && nextLesson && (
                      <div className="rounded-2xl border border-border bg-white/[0.018] p-4 sm:p-5 mb-5">
                        <div className="text-[11px] uppercase tracking-wide text-gold font-semibold mb-1.5"><LocalizedText ar="التالي لك" fr="À suivre" en="Up next" /></div>
                        <div className="font-cairo font-bold text-[14px] sm:text-[15px] leading-6">{nextLesson.title}</div>
                      </div>
                    )}

                    {isFullyCompleted && (
                      <div className="rounded-2xl border border-gold/20 bg-gold/[0.045] p-4 sm:p-5 mb-5">
                        <div className="font-cairo font-bold text-gold text-[14px] mb-1"><LocalizedText ar="🎉 أكملت هذه الدورة بالكامل" fr="🎉 Vous avez terminé ce cours" en="🎉 You completed this course" /></div>
                        <p className="text-muted text-[12.5px] leading-6"><LocalizedText ar="يمكنك العودة إلى أي درس في أي وقت للمراجعة والتثبيت." fr="Vous pouvez revenir à n’importe quelle leçon à tout moment pour réviser." en="You can return to any lesson at any time to review and reinforce what you learned." /></p>
                      </div>
                    )}

                    <Link
                      href={nextLesson ? `/course-content?lesson=${nextLesson.id}` : '/course-content'}
                      className="btn-primary inline-flex items-center justify-center min-w-[190px] text-center font-heading text-[15px] sm:text-[16px]"
                    >
                      {isFullyCompleted ? (
                        <LocalizedText ar="مراجعة الدورة" fr="Revoir le cours" en="Review course" />
                      ) : (
                        <LocalizedText ar="متابعة التعلم" fr="Continuer à apprendre" en="Continue learning" />
                      )}
                    </Link>
                  </div>

                  <aside className="hidden lg:flex rounded-2xl border border-border bg-white/[0.015] p-5 flex-col justify-center">
                    <div className="text-center mb-5">
                      <div className="font-heading font-extrabold text-[34px] text-gold leading-none">{pct}%</div>
                      <div className="text-muted text-xs mt-2"><LocalizedText ar="من الدورة مكتمل" fr="du cours terminé" en="of course completed" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-border bg-surface2/55 p-3 text-center">
                        <div className="font-bold text-lg">{completed}</div>
                        <div className="text-muted2 text-[10.5px] mt-1"><LocalizedText ar="مكتمل" fr="Terminées" en="Completed" /></div>
                      </div>
                      <div className="rounded-xl border border-border bg-surface2/55 p-3 text-center">
                        <div className="font-bold text-lg">{remaining}</div>
                        <div className="text-muted2 text-[10.5px] mt-1"><LocalizedText ar="متبقي" fr="Restantes" en="Remaining" /></div>
                      </div>
                    </div>
                  </aside>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </>
  );
}
