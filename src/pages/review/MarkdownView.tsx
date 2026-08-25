import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { hljs, languageFromClassName } from "./diff-highlight";

export function MarkdownView({ value }: { value: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, ...props }) => (
          <a {...props} rel="noreferrer" target="_blank">
            {children}
          </a>
        ),
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
