import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { SetURLSearchParams } from "react-router-dom";
import type { ReviewCommentSide, ReviewItem } from "../../../types/api";
import { diffAnchorId } from "../comment-threads";
import type { CommentTarget, ReviewTab } from "../review-utils";

const highlightClass = "diff-anchor-highlight";

/** Scrolls an element to the middle of the screen and flashes it. */
export const highlightElement = (element: HTMLElement) => {
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.classList.add(highlightClass);
  window.setTimeout(() => {
    element.classList.remove(highlightClass);
  }, 2000);
};

/** The inline comment below the middle of the screen, or the first one. */
export const scrollToNextComment = () => {
  const elements = [
    ...document.querySelectorAll<HTMLElement>(".diff-inline-comment"),
  ];
  if (!elements.length) {
    return;
  }

  const next =
    elements.find(
      (element) =>
        element.getBoundingClientRect().top > window.innerHeight / 2 + 24,
    ) ?? elements[0];
  highlightElement(next);
};

/**
 * The commit shown in the Files tab, and the diff locations that URLs such
 * as `?tab=files&commit=…&file=…&line=…` point to.
 */
export function useDiffNavigation({
  review,
  activeReviewTab,
  searchParams,
  setSearchParams,
  setExpandedFileKeys,
}: {
  review: ReviewItem | null;
  activeReviewTab: ReviewTab;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  setExpandedFileKeys: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const [activeCommitId, setActiveCommitId] = useState<string | null>(null);
  const [pendingDiffAnchor, setPendingDiffAnchor] = useState<string | null>(
    null,
  );
  const handledDiffLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!review) {
      return;
    }

    setActiveCommitId((current) => {
      if (current && review.commits.some((commit) => commit.id === current)) {
        return current;
      }
      const firstOpenCommit = review.commits.find(
        (commit) => commit.status !== "ACKED",
      );
      return (firstOpenCommit ?? review.commits[0])?.id ?? null;
    });
  }, [review]);

  useEffect(() => {
    if (!pendingDiffAnchor || activeReviewTab !== "files") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(pendingDiffAnchor);
      if (!element) {
        return;
      }

      highlightElement(element);
      setPendingDiffAnchor(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [pendingDiffAnchor, activeReviewTab, activeCommitId]);

  useEffect(() => {
    if (!review || activeReviewTab !== "files") {
      return;
    }

    const commitParam = searchParams.get("commit");
    if (!commitParam) {
      return;
    }

    const fileParam = searchParams.get("file");
    const lineParam = searchParams.get("line");
    const sideParam: ReviewCommentSide =
      searchParams.get("side") === "BEFORE" ? "BEFORE" : "AFTER";
    const signature = `${commitParam}:${fileParam ?? ""}:${lineParam ?? ""}:${sideParam}`;
    if (handledDiffLocationRef.current === signature) {
      return;
    }

    const commit = review.commits.find(
      (currentCommit) =>
        currentCommit.hash === commitParam ||
        currentCommit.hash.startsWith(commitParam),
    );
    if (!commit) {
      return;
    }

    handledDiffLocationRef.current = signature;
    setActiveCommitId(commit.id);
    if (fileParam) {
      setExpandedFileKeys((current) => ({
        ...current,
        [`${commit.id}:${fileParam}`]: true,
      }));
    }
    const parsedLine = lineParam ? Number(lineParam) : Number.NaN;
    setPendingDiffAnchor(
      diffAnchorId({
        commitHash: commit.hash,
        filePath: fileParam,
        lineNumber: Number.isInteger(parsedLine) ? parsedLine : null,
        side: sideParam,
      }),
    );
  }, [review, searchParams, activeReviewTab]);

  const openDiffLocation = (target: CommentTarget) => {
    const params: Record<string, string> = { tab: "files" };
    if (target.commitHash) {
      params.commit = target.commitHash;
    }
    if (target.filePath) {
      params.file = target.filePath;
    }
    if (target.lineNumber !== null) {
      params.line = String(target.lineNumber);
    }
    if (target.side === "BEFORE") {
      params.side = "BEFORE";
    }

    handledDiffLocationRef.current = null;
    setSearchParams(params);
  };

  return { activeCommitId, setActiveCommitId, openDiffLocation };
}
