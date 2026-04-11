export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 space-y-3">
        <div className="h-3 w-24 rounded-lg bg-zinc-200" />
        <div className="h-8 w-72 rounded-lg bg-zinc-200" />
        <div className="h-4 w-full max-w-2xl rounded-lg bg-zinc-200" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-56 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="h-10 w-52 rounded-lg bg-zinc-200" />
          <div className="mt-5 h-24 rounded-lg bg-zinc-100" />
        </div>
        <div className="h-56 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-24 rounded-lg bg-zinc-200" />
          <div className="mt-5 space-y-3">
            <div className="h-4 rounded-lg bg-zinc-100" />
            <div className="h-4 rounded-lg bg-zinc-100" />
            <div className="h-4 rounded-lg bg-zinc-100" />
          </div>
        </div>
      </div>
    </div>
  )
}
