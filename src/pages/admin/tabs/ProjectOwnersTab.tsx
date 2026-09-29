import { ProjectUsersTab } from "./project-users/ProjectUsersTab";

export function ProjectOwnersTab() {
  return (
    <ProjectUsersTab
      endpoint="/project-owners"
      idPrefix="project-owner"
      labels={{
        title: "projectOwners",
        hint: "projectOwnersHint",
        users: "owners",
        added: "projectOwnersAdded",
        removed: "projectOwnerRemoved",
        remove: "removeOwner",
        edit: "editProjectOwners",
        saved: "projectOwnersSaved",
        loading: "loadingProjectOwners",
        empty: "noProjectOwners",
      }}
    />
  );
}
