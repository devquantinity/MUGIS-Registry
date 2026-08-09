"use client";

import { useEffect } from "react";

/** Sets the browser-tab title for the current page. */
export function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · MUGIS Registry`;
    return () => { document.title = prev; };
  }, [title]);
}
