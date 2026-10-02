import { memo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../auth/AuthProvider";
import { hljs, languageFromClassName } from "./diff-highlight";
import {
  mentionName,
  mentionUserIdAttribute,
  remarkMentions,
  useMentionUsers,
} from "./mentions";

/** An id matching no known user stays the text it was written as. */
function Mention({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const { currentUser } = useAuth();
  const { usersById } = useMentionUsers();
  const user = usersById.get(userId);
  if (!user) {
    return <>{children}</>;
  }

  return (
    <span
      className={`mention${userId === currentUser?.id ? " is-me" : ""}`}
      title={user.email}
    >
      @{mentionName(user)}
    </span>
  );
}

const remarkPlugins = [remarkGfm, remarkMentions];

const components: Components = {
  a: ({ children, ...props }) => (
    <a {...props} rel="noreferrer" target="_blank">
      {children}
    </a>
  ),
  span: ({ node: _node, ...props }) => {
    const mentionUserId = (props as Record<string, unknown>)[
      mentionUserIdAttribute
    ];
    return typeof mentionUserId === "string" ? (
      <Mention userId={mentionUserId}>{props.children}</Mention>
    ) : (
      <span {...props} />
    );
  },
  code: ({ className, children, node: _node, ...props }) => {
    const code = String(children).replace(/\n$/, "");
    const language = languageFromClassName(className);

    if (!language) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    const highlighted = hljs.getLanguage(language)
      ? hljs.highlight(code, { language }).value
      : hljs.highlightAuto(code).value;

    return (
      <code
        className={`hljs language-${language}`}
        {...props}
        dangerouslySetInnerHTML={{ __html: highlighted || " " }}
      />
    );
  },
};

/**
 * Memoized on `value`: a page holds many comments, and re-parsing (and
 * re-highlighting) each one on every keystroke of a draft made typing lag.
 */
export const MarkdownView = memo(function MarkdownView({
  value,
}: {
  value: string;
}) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {value}
    </ReactMarkdown>
  );
});
