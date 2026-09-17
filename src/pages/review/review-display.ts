import type { useI18n } from "../../i18n/I18nProvider";
import type {
  CurrentUser,
  ReviewComment,
  ReviewCommit,
  ReviewField,
  ReviewItem,
  ReviewUserSummary,
} from "../../types/api";

export type Translate = ReturnType<typeof useI18n>["t"];

export const errorText = (error: unknown, t: Translate) =>
  error instanceof Error ? error.message : t("backendError");

export const userLabel = (user: ReviewUserSummary) =>
  user.nickname || user.hostname || user.email;

export const reviewTitle = (review: ReviewItem) =>
  review.title ||
  review.gitwebTitle ||
  review.commits[0]?.title ||
  review.gitwebUrl;

export const reviewDescription = (review: ReviewItem) =>
  review.description ||
  review.gitwebLog ||
  review.commits[0]?.rawMessage ||
  "";

export const fullReviewDescription = (review: ReviewItem) =>
  [
    review.description,
    review.gitwebLog,
    review.commits[0]?.rawMessage,
  ].reduce(
    (longestDescription: string, description) =>
      description && description.length > longestDescription.length
        ? description
        : longestDescription,
    "",
  );

export const shortHash = (value: string | null) => value?.slice(0, 12) ?? null;

export const sourceBranchLabel = (review: ReviewItem) =>
  review.sourceBranch || "master";

/** A single-commit review may keep its diff on the review itself. */
export const commitDiffFiles = (review: ReviewItem, commit: ReviewCommit) =>
  commit.gitDiff.files.length || review.commits.length > 1
    ? commit.gitDiff.files
    : review.gitDiff.files;

export const totalDiffFileCount = (review: ReviewItem) =>
  review.commits.length
    ? review.commits.reduce(
        (sum, commit) => sum + commitDiffFiles(review, commit).length,
        0,
      )
    : review.gitDiff.files.length;

/** Who a mention can be named after without asking the backend. */
export const mentionableUsers = (
  review: ReviewItem,
  comments: ReviewComment[],
) => [
  review.owner,
  ...review.reviewers.map((reviewer) => reviewer.user),
  ...comments.flatMap((comment) => [comment.author, ...comment.mentions]),
];

export const fieldPlaceholder = (type: ReviewField["type"], t: Translate) => {
  switch (type) {
    case "LINK":
      return t("fieldPlaceholderLink");
    case "IMAGE":
      return t("fieldPlaceholderImage");
    case "NUMBER":
      return t("fieldPlaceholderNumber");
    default:
      return t("fieldPlaceholderText");
  }
};

// The composer shows the current user's avatar, which `UserAvatar` only
// knows how to draw from a review participant summary.
export const reviewUserSummaryOf = (
  currentUser: CurrentUser | null,
): ReviewUserSummary | null =>
  currentUser
    ? {
        id: currentUser.id,
        email: currentUser.email,
        hostname: currentUser.hostname,
        nickname: currentUser.settings?.nickname ?? null,
        mailNotificationsEnabled:
          currentUser.settings?.mailNotificationsEnabled ?? false,
        ircNotificationsEnabled:
          currentUser.settings?.ircNotificationsEnabled ?? false,
        webhookNotificationsEnabled:
          currentUser.settings?.webhookNotificationsEnabled ?? false,
        hasProfileImage: !!currentUser.profileImage,
        profileImageUrl: currentUser.settings?.profileImageUrl ?? null,
      }
    : null;

export const commentRoleLabel = (
  review: ReviewItem | null,
  user: ReviewUserSummary,
  t: Translate,
) => {
  if (!review) {
    return null;
  }
  if (user.id === review.ownerId) {
    return t("commentRoleAuthor");
  }
  if (review.reviewers.some((reviewer) => reviewer.userId === user.id)) {
    return t("commentRoleReviewer");
  }
  return null;
};
