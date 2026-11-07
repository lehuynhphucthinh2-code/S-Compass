import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-line bg-surface p-6 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-ink-soft">This address does not exist in the prototype.</p>
      <Link href="/dispatcher" className="mt-4 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white">
        Go to Dispatcher
      </Link>
    </div>
  );
}
