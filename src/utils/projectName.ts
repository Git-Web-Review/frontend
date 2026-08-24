/** Short project label: strips the "<user>/" namespace and the ".git" suffix. */
export const projectName = (project: string | null | undefined) => {
  const trimmed = project?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  return (
    trimmed
      .split("/")
      .pop()
      ?.replace(/\.git$/, "") ?? trimmed
  );
};
