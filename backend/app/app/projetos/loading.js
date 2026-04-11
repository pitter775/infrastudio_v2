export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 space-y-3">
        <div className="h-3 w-24 rounded-lg bg-zinc-200" />
        <div className="h-8 w-64 rounded-lg bg-zinc-200" />
        <div className="h-4 w-full max-w-xl rounded-lg bg-zinc-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-zinc-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded-lg bg-zinc-200" />
                <div className="h-3 w-20 rounded-lg bg-zinc-200" />
              </div>
            </div>
            <div className="mt-5 h-10 rounded-lg bg-zinc-100" />
            <div className="mt-5 h-6 w-24 rounded-lg bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
