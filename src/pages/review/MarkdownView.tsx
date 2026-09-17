import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
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

export function MarkdownView({ value }: { value: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMentions]}
      components={{
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
      }}
    >
      {value}
    </ReactMarkdown>
  );
}
