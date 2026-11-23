"use client";

import Link from "next/link";
import { useTitle } from "@/lib/useTitle";
import { Card, PageHeader } from "@/components/ui";

/**
 * A screen whose API does not exist yet. The demo data that used to fill
 * these screens has been removed, so what the app shows is only what the
 * backend actually serves.
 */
export default function ComingSoon({ title, what, phase }: {
  title: string;
  /** One or two lines: what this screen will do. */
  what: string;
  /** Where it sits in the delivery plan. */
  phase: string;
}) {
  useTitle(title);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} />
      <Card>
        {/* Badge above the text on phones; beside it from sm, where there is room. */}
        <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:gap-3">
          <span className="inline-flex shrink-0 items-center rounded-md bg-gold-100 px-2 py-1 text-[12px] font-bold uppercase tracking-wide text-gold-600 sm:mt-0.5">
            Not available yet
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-ink">{what}</p>
            <p className="mt-2 text-[13px] text-soot/75">{phase}</p>
          </div>
        </div>
        <p className="mt-4 border-t border-line pt-3 text-[13px] text-soot/75">
          Available now: <Link href="/patients" className="font-medium text-forest-600 hover:underline touch:py-2">patient records</Link>,
          access requests, your profile and — for administrators — users, centres and registrations.
        </p>
      </Card>
    </div>
  );
}
