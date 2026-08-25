import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("go", go);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

const languageByExtension: Record<string, string> = {
  c: "c",
  cc: "cpp",
  conf: "ini",
  cpp: "cpp",
  css: "css",
  go: "go",
  hpp: "cpp",
  html: "xml",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  patch: "diff",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

const languageAliases: Record<string, string> = {
  docker: "dockerfile",
  htm: "xml",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  patch: "diff",
  py: "python",
  shell: "bash",
  sh: "bash",
  ts: "typescript",
  yml: "yaml",
  zsh: "bash",
};

export const normalizeLanguage = (language: string | null | undefined) => {
  if (!language) {
    return null;
  }

  return languageAliases[language] ?? language;
};

export const languageForPath = (path: string) => {
  const extension = path.split(".").pop();

  return extension ? languageByExtension[extension.toLowerCase()] : null;
};

export const languageFromClassName = (className: string | undefined) => {
  const match = /(?:^|\s)language-([^\s]+)/.exec(className ?? "");

  return normalizeLanguage(match?.[1]);
};

export const highlightCacheLimit = 50000;
export const highlightCache = new Map<string, string>();

export { hljs };
