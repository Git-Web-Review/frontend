import {
  type ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReviewUserSummary } from "../../types/api";

/**
 * A mention is stored as `@<user id>`, which survives renames; it is shown as
 * `@<name>` both in rendered messages and while typing. The boundaries match
 * the backend's, so both sides agree on what is a mention.
 */
const mentionPattern = () =>
  /(?<![\p{L}\p{N}_@])@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![\p{L}\p{N}_-])/giu;

export const mentionName = (user: ReviewUserSummary) =>
  user.nickname || user.hostname || user.email;

/**
 * The name each user goes by in a draft. Two users sharing a name would make
 * the draft ambiguous, so those fall back to their email.
 */
export function mentionLabels(
  usersById: Map<string, ReviewUserSummary>,
): Map<string, string> {
  const nameCounts = new Map<string, number>();
  for (const user of usersById.values()) {
    const name = mentionName(user);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return new Map(
    [...usersById.values()].map((user) => {
      const name = mentionName(user);
      return [user.id, (nameCounts.get(name) ?? 0) > 1 ? user.email : name];
    }),
  );
}

/** Stored message to draft text: `@<id>` becomes `@<label>`. */
export function mentionsToLabels(
  message: string,
  labelsById: Map<string, string>,
): string {
  return message.replace(mentionPattern(), (mention, userId: string) => {
    const label = labelsById.get(userId.toLowerCase());
    return label ? `@${label}` : mention;
  });
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Draft text back to the stored message. Longest labels go first so that
 * `@Paul B.` is not read as `@Paul` followed by ` B.`; a label running into
 * more text, like `@Paulo`, is left alone.
 */
export function labelsToMentions(
  draft: string,
  labelsById: Map<string, string>,
): string {
  const idsByLabel = new Map(
    [...labelsById].map(([userId, label]) => [label, userId]),
  );
  if (idsByLabel.size === 0) {
    return draft;
  }

  const alternatives = [...idsByLabel.keys()]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  return draft.replace(
    new RegExp(`(?<![\\p{L}\\p{N}_@])@(${alternatives})(?![\\p{L}\\p{N}_-])`, "gu"),
    (mention, label: string) => {
      const userId = idsByLabel.get(label);
      return userId ? `@${userId}` : mention;
    },
  );
}

type MentionUsers = {
  usersById: Map<string, ReviewUserSummary>;
  /** Keeps a user picked in a composer known, for its draft and preview. */
  registerUser: (user: ReviewUserSummary) => void;
};

const MentionUsersContext = createContext<MentionUsers>({
  usersById: new Map(),
  registerUser: () => undefined,
});

export const useMentionUsers = () => useContext(MentionUsersContext);

/** The users mentions can be resolved against: the review's people. */
export function MentionUsersProvider({
  users,
  children,
}: {
  users: ReviewUserSummary[];
  children: ReactNode;
}) {
  const [pickedUsers, setPickedUsers] = useState<ReviewUserSummary[]>([]);
  const value = useMemo<MentionUsers>(() => {
    // The review's people first, in a stable order, with their fresh copies.
    const usersById = new Map<string, ReviewUserSummary>();
    for (const user of users) {
      usersById.set(user.id, user);
    }
    for (const user of pickedUsers) {
      if (!usersById.has(user.id)) {
        usersById.set(user.id, user);
      }
    }

    return {
      usersById,
      registerUser: (user) =>
        setPickedUsers((current) =>
          current.some((knownUser) => knownUser.id === user.id)
            ? current
            : [...current, user],
        ),
    };
  }, [pickedUsers, users]);

  return (
    <MentionUsersContext.Provider value={value}>
      {children}
    </MentionUsersContext.Provider>
  );
}

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: Record<string, unknown>;
};

export const mentionUserIdAttribute = "data-mention-user-id";

/**
 * Remark plugin turning each `@<id>` of the text into a
 * `<span data-mention-user-id>`, for `MarkdownView` to name. Code is left
 * as written, and links keep their own text.
 */
export function remarkMentions() {
  return (tree: MarkdownNode) => {
    splitMentions(tree);
  };
}

function splitMentions(node: MarkdownNode) {
  if (!node.children) {
    return;
  }

  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && child.value) {
      return textWithMentions(child.value);
    }
    if (child.type !== "link" && child.type !== "linkReference") {
      splitMentions(child);
    }
    return [child];
  });
}

function textWithMentions(value: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let textStart = 0;
  for (const match of value.matchAll(mentionPattern())) {
    if (match.index > textStart) {
      nodes.push({ type: "text", value: value.slice(textStart, match.index) });
    }
    nodes.push({
      type: "mention",
      data: {
        hName: "span",
        hProperties: { dataMentionUserId: match[1].toLowerCase() },
        hChildren: [{ type: "text", value: match[0] }],
      },
    });
    textStart = match.index + match[0].length;
  }

  if (textStart === 0) {
    return [{ type: "text", value }];
  }
  if (textStart < value.length) {
    nodes.push({ type: "text", value: value.slice(textStart) });
  }
  return nodes;
}
