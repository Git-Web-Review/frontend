import { ProjectUsersTab } from "./project-users/ProjectUsersTab";

export function ProjectDefaultReviewersTab() {
  return (
    <ProjectUsersTab
      endpoint="/project-default-reviewers"
      idPrefix="project-default-reviewer"
      labels={{
        title: "projectDefaultReviewers",
        hint: "projectDefaultReviewersHint",
        users: "reviewers",
        added: "projectDefaultReviewersAdded",
        removed: "projectDefaultReviewerRemoved",
        remove: "removeReviewer",
        loading: "loadingProjectDefaultReviewers",
        empty: "noProjectDefaultReviewers",
      }}
    />
  );
}
