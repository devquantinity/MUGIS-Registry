import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center text-center">
      <p className="text-[15px] font-semibold text-forest-500">404</p>
      <h1 className="mt-1 font-display text-[24px] font-semibold tracking-[-0.01em] text-ink">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-soot/78">
        The link may be outdated, or the record may have been removed.
      </p>
      <div className="mt-5 flex gap-2">
        <Link href="/" className="btn-primary">Back to overview</Link>
        <Link href="/patients" className="btn-secondary">Patients</Link>
      </div>
    </div>
  );
}
