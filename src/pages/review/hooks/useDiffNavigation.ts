import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { SetURLSearchParams } from "react-router-dom";
import type {
  ReviewComment,
  ReviewCommentSide,
  ReviewItem,
} from "../../../types/api";
import { commentAnchorId, diffAnchorId } from "../comment-threads";
import type { CommentTarget, ReviewTab } from "../review-utils";

const highlightClass = "diff-anchor-highlight";

const diffLocationSignature = (
  commit: string,
  file: string | null,
  line: string | null,
  side: ReviewCommentSide,
) => `${commit}:${file ?? ""}:${line ?? ""}:${side}`;

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
 * The commit shown in the Files tab, kept in the URL as `?commit=…`, the
 * diff locations that URLs such as `?tab=files&commit=…&file=…&line=…` point
 * to, and the comment threads that `?comment=<number>` points to.
 */
export function useDiffNavigation({
  review,
  reviewComments,
  activeReviewTab,
  searchParams,
  setSearchParams,
  setExpandedFileKeys,
}: {
  review: ReviewItem | null;
  reviewComments: ReviewComment[];
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
  const handledCommentRef = useRef<number | null>(null);
  // Hash of a commit shown before its `?commit=` reached the URL: router
  // navigation is async, so until then the URL still names the old commit.
  const pendingCommitHashRef = useRef<string | null>(null);

  /** Shows a commit right away, and ignores the stale URL until it updates. */
  const showCommit = (commit: { id: string; hash: string }) => {
    handledDiffLocationRef.current = diffLocationSignature(
      commit.hash,
      null,
      null,
      "AFTER",
    );
    pendingCommitHashRef.current =
      searchParams.get("commit") === commit.hash ? null : commit.hash;
    setActiveCommitId(commit.id);
  };

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
    if (!pendingDiffAnchor || activeReviewTab === "overview") {
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
      // Puts the shown commit in the URL, so it can be shared and so
      // back/forward return to it.
      const activeCommit = review.commits.find(
        (commit) => commit.id === activeCommitId,
      );
      if (activeCommit) {
        handledDiffLocationRef.current = diffLocationSignature(
          activeCommit.hash,
          null,
          null,
          "AFTER",
        );
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.set("commit", activeCommit.hash);
            return next;
          },
          { replace: true },
        );
      }
      return;
    }

    if (pendingCommitHashRef.current) {
      if (pendingCommitHashRef.current !== commitParam) {
        return;
      }
      pendingCommitHashRef.current = null;
    }

    const fileParam = searchParams.get("file");
    const lineParam = searchParams.get("line");
    const sideParam: ReviewCommentSide =
      searchParams.get("side") === "BEFORE" ? "BEFORE" : "AFTER";
    const signature = diffLocationSignature(
      commitParam,
      fileParam,
      lineParam,
      sideParam,
    );
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
  }, [review, searchParams, activeReviewTab, activeCommitId]);

  useEffect(() => {
    const commentNumber = Number(searchParams.get("comment"));
    if (
      !review ||
      !Number.isInteger(commentNumber) ||
      handledCommentRef.current === commentNumber
    ) {
      return;
    }

    const comment = reviewComments.find(
      (current) => current.commentNumber === commentNumber,
    );
    if (!comment) {
      return;
    }

    handledCommentRef.current = commentNumber;
    const commit = review.commits.find(
      (current) => current.hash === comment.commitHash,
    );
    if (commit) {
      // Diff comment: show its commit and open its file in the Files tab.
      showCommit(commit);
      if (comment.filePath) {
        setExpandedFileKeys((current) => ({
          ...current,
          [`${commit.id}:${comment.filePath}`]: true,
        }));
      }
      setSearchParams(
        { tab: "files", commit: commit.hash, comment: String(commentNumber) },
        { replace: true },
      );
    } else {
      setSearchParams(
        { tab: "comments", comment: String(commentNumber) },
        { replace: true },
      );
    }
    setPendingDiffAnchor(commentAnchorId(commentNumber));
  }, [review, reviewComments, searchParams]);

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
    pendingCommitHashRef.current = null;
    setSearchParams(params);
  };

  /** Shows a commit as a new history entry, without scrolling to it. */
  const selectCommit = (commitId: string) => {
    const commit = review?.commits.find((current) => current.id === commitId);
    if (!commit) {
      return;
    }
    showCommit(commit);
    setSearchParams({ tab: "files", commit: commit.hash });
  };

  return { activeCommitId, selectCommit, openDiffLocation };
}
