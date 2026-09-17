import {
  type CSSProperties,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { UserAvatar } from "../../components/UserAvatar";
import type {
  ReviewerCandidatePage,
  ReviewUserSummary,
} from "../../types/api";
import {
  labelsToMentions,
  mentionLabels,
  mentionName,
  mentionsToLabels,
  useMentionUsers,
} from "./mentions";

type MentionTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  /** The stored message, mentions written `@<user id>`. */
  value: string;
  onChange: (value: string) => void;
};

type ActiveMention = { start: number; query: string };

const suggestionLimit = 6;

/** The `@query` the caret sits right after, if any. */
function activeMentionAt(text: string, caret: number): ActiveMention | null {
  const match = /(?:^|[^\p{L}\p{N}_@])@([^\s@]{0,50})$/u.exec(
    text.slice(0, caret),
  );
  return match ? { start: caret - match[1].length - 1, query: match[1] } : null;
}

const userMatches = (user: ReviewUserSummary, query: string) =>
  [user.nickname, user.hostname, user.email].some((value) =>
    value?.toLowerCase().includes(query.toLowerCase()),
  );

/**
 * Textarea offering users to mention after `@`. It shows mentions by name
 * while the message it hands back keeps them as ids.
 */
export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  onBlur,
  ...textareaProps
}: MentionTextareaProps) {
  const { currentUser, idToken } = useAuth();
  const { usersById, registerUser } = useMentionUsers();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<ReviewUserSummary[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const labelsById = mentionLabels(usersById);
  const draft = mentionsToLabels(value, labelsById);
  const candidate = caret === null ? null : activeMentionAt(draft, caret);
  const candidateStart = candidate?.start ?? null;
  const activeMention =
    candidate && candidate.start !== dismissedStart ? candidate : null;
  const query = activeMention?.query ?? null;

  // Escape closes the suggestions for one mention, not for good.
  useEffect(() => {
    if (candidateStart !== dismissedStart) {
      setDismissedStart(null);
    }
  }, [candidateStart]);

  useEffect(() => {
    if (query === null || !idToken) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams({
        q: query,
        limit: suggestionLimit.toString(),
      });
      apiRequest<ReviewerCandidatePage>(
        `/me/reviewer-candidates?${params.toString()}`,
        idToken,
      )
        .then((page) => {
          if (!cancelled) {
            setRemoteUsers(page.items);
          }
        })
        .catch(() => undefined);
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [idToken, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useLayoutEffect(() => {
    const pendingCaret = pendingCaretRef.current;
    if (pendingCaret === null || !textareaRef.current) {
      return;
    }

    pendingCaretRef.current = null;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pendingCaret, pendingCaret);
    setCaret(pendingCaret);
  });

  // The review's people first, then whoever else the search finds.
  const suggestions =
    query === null
      ? []
      : [
          ...[...usersById.values()].filter(
            (user) => user.id !== currentUser?.id && userMatches(user, query),
          ),
          // Results for a shorter query stay until the new ones land.
          ...remoteUsers.filter((user) => userMatches(user, query)),
        ]
          .filter(
            (user, index, users) =>
              users.findIndex((other) => other.id === user.id) === index,
          )
          .slice(0, suggestionLimit);

  const suggestionsOpen = suggestions.length > 0;

  // Fixed to the viewport: the diff lines scroll sideways, which would clip
  // a menu positioned inside them. It flips above when room runs out below.
  useLayoutEffect(() => {
    if (!suggestionsOpen) {
      setMenuStyle(null);
      return;
    }

    const place = () => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      const rect = textarea.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      setMenuStyle(
        spaceBelow >= 180 || spaceBelow >= spaceAbove
          ? { left: rect.left, top: rect.bottom + 2, maxHeight: spaceBelow }
          : {
              left: rect.left,
              bottom: window.innerHeight - rect.top + 2,
              maxHeight: spaceAbove,
            },
      );
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [suggestionsOpen]);

  const pickUser = (user: ReviewUserSummary) => {
    if (!activeMention || caret === null) {
      return;
    }

    registerUser(user);
    const nextLabelsById = mentionLabels(
      new Map(usersById).set(user.id, user),
    );
    // A newcomer sharing a name turns labels into emails: relabel both sides.
    const relabel = (text: string) =>
      mentionsToLabels(labelsToMentions(text, labelsById), nextLabelsById);
    // The rest of the word under the caret goes with the query.
    const wordRest = /^[^\s@]*/u.exec(draft.slice(caret))?.[0] ?? "";
    const end = caret + wordRest.length;
    const before = `${relabel(draft.slice(0, activeMention.start))}@${
      nextLabelsById.get(user.id)
    } `;
    onChange(
      labelsToMentions(before + relabel(draft.slice(end)), nextLabelsById),
    );
    pendingCaretRef.current = before.length;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while composing (IME) confirms the composition, not a user.
    if (suggestions.length && !event.nativeEvent.isComposing) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlightedIndex(
          (current) =>
            (current + step + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pickUser(suggestions[highlightedIndex] ?? suggestions[0]);
        return;
      }
      if (event.key === "Escape" && activeMention) {
        event.preventDefault();
        event.stopPropagation();
        setDismissedStart(activeMention.start);
        return;
      }
    }

    onKeyDown?.(event);
  };

  const readCaret = (textarea: HTMLTextAreaElement) =>
    setCaret(
      textarea.selectionStart === textarea.selectionEnd
        ? textarea.selectionStart
        : null,
    );

  return (
    <div className="mention-textarea">
      <textarea
        {...textareaProps}
        ref={textareaRef}
        value={draft}
        onBlur={(event) => {
          setCaret(null);
          onBlur?.(event);
        }}
        onChange={(event) => {
          readCaret(event.target);
          onChange(labelsToMentions(event.target.value, labelsById));
        }}
        onKeyDown={handleKeyDown}
        onSelect={(event) => readCaret(event.currentTarget)}
      />
      {suggestionsOpen && menuStyle ? (
        <div
          className="dropdown-menu mention-suggestions show"
          role="listbox"
          style={menuStyle}
        >
          {suggestions.map((user, index) => (
            <button
              aria-selected={index === highlightedIndex}
              className={`dropdown-item mention-suggestion${
                index === highlightedIndex ? " active" : ""
              }`}
              key={user.id}
              role="option"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => pickUser(user)}
            >
              <UserAvatar idToken={idToken} user={user} />
              <span className="mention-suggestion-identity">
                <span className="fw-semibold">{mentionName(user)}</span>
                <span className="mention-suggestion-email">{user.email}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
