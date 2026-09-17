/** Lists of ids kept in state, such as the items an action is pending on. */
export const withId = (ids: string[], id: string) => [...ids, id];

export const withoutId = (ids: string[], id: string) =>
  ids.filter((currentId) => currentId !== id);

export const toggleId = (ids: string[], id: string) =>
  ids.includes(id) ? withoutId(ids, id) : withId(ids, id);
