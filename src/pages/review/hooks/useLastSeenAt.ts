import { useEffect, useRef, useState } from "react";

/**
 * When this browser last opened the review, stamped on arrival. Replies
 * posted since then get a banner in their thread. The stamp lives in this
 * browser only; there is no server state for it.
 */
export function useLastSeenAt(reviewId: string) {
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const stampedReviewIdRef = useRef<string | null>(null);

  useEffect(() => {
    // StrictMode runs this twice; stamping twice would erase the previous
    // visit before it is read.
    if (!reviewId || stampedReviewIdRef.current === reviewId) {
      return;
    }
    stampedReviewIdRef.current = reviewId;

    const storageKey = `review-last-seen:${reviewId}`;
    try {
      setLastSeenAt(localStorage.getItem(storageKey));
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      setLastSeenAt(null);
    }
  }, [reviewId]);

  return lastSeenAt;
}
