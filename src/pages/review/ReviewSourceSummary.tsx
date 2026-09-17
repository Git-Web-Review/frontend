import { DateTimeText } from "../../components/DateTimeText";
import { GitBranchIcon } from "../../components/GitBranchIcon";
import { useI18n } from "../../i18n/I18nProvider";
import type { ReviewItem } from "../../types/api";
import { gitwebFetchErrorLabel } from "../../utils/gitwebFetchError";
import { projectName } from "../../utils/projectName";
import { gitwebBrowseUrl } from "./gitweb-links";

/** Where the review comes from: project, branch, commit and git-web link. */
export function ReviewSourceSummary({
  review,
  sourceBranchLabelText,
  sourceCommitLabel,
}: {
  review: ReviewItem;
  sourceBranchLabelText: string;
  sourceCommitLabel: string | null;
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="commit-summary-grid mt-3 mb-3">
        <div className="commit-summary-item commit-summary-project">
          <span className="commit-summary-icon">
            <i className="bi bi-box" aria-hidden="true" />
          </span>
          <span className="commit-summary-label">{t("sourceProject")}</span>
          <span className="commit-summary-value text-break">
            {projectName(review.sourceProject) || t("notAvailable")}
          </span>
        </div>
        <div className="commit-summary-item commit-summary-branch">
          <span className="commit-summary-icon">
            <GitBranchIcon />
          </span>
          <span className="commit-summary-label">{t("sourceBranch")}</span>
          <span className="commit-summary-value text-break">
            {sourceBranchLabelText}
          </span>
        </div>
        <div className="commit-summary-item commit-summary-hash">
          <span className="commit-summary-icon">
            <i className="bi bi-git" aria-hidden="true" />
          </span>
          <span className="commit-summary-label">{t("sourceCommit")}</span>
          <span className="commit-summary-value font-monospace text-break">
            {sourceCommitLabel || t("notAvailable")}
          </span>
        </div>
        <div className="commit-summary-item commit-summary-fetch">
          <span className="commit-summary-icon">
            <i className="bi bi-clock-history" aria-hidden="true" />
          </span>
          <span className="commit-summary-label">
            {t("gitwebFetchedAt")}
          </span>
          <span className="commit-summary-value">
            <DateTimeText
              fallback={t("notAvailable")}
              label={t("gitwebFetchedAt")}
              value={review.gitwebFetchedAt}
            />
          </span>
        </div>
      </div>
      <dl className="row mb-0 small">
        <dt className="col-4">{t("gitwebUrl")}</dt>
        <dd className="col-8 text-break">
          <a href={gitwebBrowseUrl(review)} rel="noreferrer" target="_blank">
            {review.gitwebUrl}
          </a>
        </dd>
        {review.gitwebFetchError ? (
          <>
            <dt className="col-4">{t("gitwebFetchError")}</dt>
            <dd className="col-8 text-danger text-break">
              {gitwebFetchErrorLabel(review.gitwebFetchError, t)}
            </dd>
          </>
        ) : null}
        <dt className="col-4">{t("updatedAt")}</dt>
        <dd className="col-8">
          <DateTimeText label={t("updatedAt")} value={review.updatedAt} />
        </dd>
      </dl>
    </>
  );
}
