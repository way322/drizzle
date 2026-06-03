"use client";

import { useState } from "react";

const PREVIEW_LENGTH = 280;

type Props = {
  content: string;
};

export default function CommentContent({ content }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > PREVIEW_LENGTH;
  const displayText =
    expanded || !isLong
      ? content
      : `${content.slice(0, PREVIEW_LENGTH).trimEnd()}…`;

  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-200">
        {displayText}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-purple-300 transition hover:text-white"
        >
          {expanded ? "Свернуть" : "Читать дальше"}
        </button>
      )}
    </div>
  );
}
