export default function Loading() {
  return (
    <div className="min-h-screen bg-[#080b12] text-text" dir="rtl">
      <div className="sticky top-0 z-50 border-b border-white/[0.06] bg-bg/95 backdrop-blur-xl shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="h-10 w-[138px] sm:h-11 sm:w-[150px] rounded-xl bg-white/[0.04] animate-pulse" />

          <div className="hidden md:flex flex-1 items-center justify-center gap-2 px-4">
            <div className="h-10 w-24 rounded-xl bg-white/[0.035] animate-pulse" />
            <div className="h-10 w-24 rounded-xl bg-white/[0.035] animate-pulse" />
            <div className="h-10 w-24 rounded-xl bg-white/[0.035] animate-pulse" />
            <div className="h-10 w-28 rounded-xl bg-white/[0.035] animate-pulse" />
          </div>

          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full border border-white/[0.07] bg-white/[0.025] animate-pulse" />
            <div className="h-9 w-9 rounded-full border border-white/[0.07] bg-white/[0.025] animate-pulse" />
            <div className="hidden md:block h-9 w-24 rounded-xl border border-white/[0.07] bg-white/[0.025] animate-pulse" />
          </div>
        </div>

        <div className="h-[2px] w-full overflow-hidden bg-white/[0.025]">
          <div className="h-full w-1/3 bg-gradient-to-l from-gold/20 via-gold to-gold/20 animate-[pulse_1s_ease-in-out_infinite]" />
        </div>
      </div>

      <main className="mx-auto max-w-[1140px] px-5 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 max-w-[620px]">
          <div className="mb-3 h-3 w-24 rounded-full bg-gold/[0.10] animate-pulse" />
          <div className="mb-3 h-9 w-3/4 rounded-xl bg-white/[0.055] animate-pulse" />
          <div className="h-4 w-1/2 rounded-lg bg-white/[0.035] animate-pulse" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-7">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/[0.06] bg-[#111925] p-5 shadow-[0_16px_34px_-26px_rgba(0,0,0,0.9)]"
            >
              <div className="mb-4 h-3 w-20 rounded-full bg-white/[0.035] animate-pulse" />
              <div className="h-8 w-16 rounded-lg bg-white/[0.06] animate-pulse" />
            </div>
          ))}
        </div>

        <div className="rounded-[22px] border border-white/[0.07] bg-[#111925] p-5 sm:p-7 shadow-[0_22px_50px_-32px_rgba(0,0,0,0.9)]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="h-6 w-2/5 rounded-lg bg-white/[0.055] animate-pulse" />
              <div className="h-4 w-1/4 rounded-lg bg-white/[0.035] animate-pulse" />
            </div>
            <div className="h-11 w-28 rounded-xl bg-gold/[0.08] animate-pulse" />
          </div>

          <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
            <div className="h-full w-2/5 rounded-full bg-gold/[0.16] animate-pulse" />
          </div>

          <div className="space-y-3">
            <div className="h-14 rounded-xl border border-white/[0.05] bg-white/[0.025] animate-pulse" />
            <div className="h-14 rounded-xl border border-white/[0.05] bg-white/[0.025] animate-pulse" />
            <div className="h-14 rounded-xl border border-white/[0.05] bg-white/[0.025] animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}
