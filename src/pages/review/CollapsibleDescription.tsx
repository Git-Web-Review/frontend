import { useI18n } from "../../i18n/I18nProvider";
import type { CommitLogLinkRule, ReviewItem } from "../../types/api";
import { linkedCommitLog } from "./gitweb-links";

/** A read-only description, cut at 220 characters until expanded. */
export function CollapsibleDescription({
  review,
  collapsedDescription,
  expandedDescription,
  expanded,
  onToggle,
  commitLogLinkRules,
}: {
  review: ReviewItem;
  collapsedDescription: string;
  expandedDescription: string;
  expanded: boolean;
  onToggle: () => void;
  commitLogLinkRules: CommitLogLinkRule[];
}) {
  const { t } = useI18n();
  const canExpand = expandedDescription.length > 220;
  const visibleDescription = expanded
    ? expandedDescription
    : canExpand
      ? collapsedDescription.slice(0, 220).trimEnd()
      : collapsedDescription;

  return (
    <div
      className={
        expanded ? "review-description is-expanded" : "review-description"
      }
    >
      {visibleDescription
        ? linkedCommitLog(visibleDescription, review, commitLogLinkRules)
        : t("notAvailable")}
      {canExpand ? (
        <button
          className="description-ellipsis-button"
          type="button"
          aria-label={expanded ? t("collapseDescription") : t("expandDescription")}
          title={expanded ? t("collapseDescription") : t("expandDescription")}
          onClick={onToggle}
        >
          <i
            className={expanded ? "bi bi-chevron-up" : "bi bi-chevron-down"}
            aria-hidden="true"
          />
        </button>
      ) : null}
    </div>
  );
}
