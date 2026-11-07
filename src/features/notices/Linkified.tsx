/**
 * お知らせの本文を表示する。HTML として解釈せず文字のまま出し、http:// と https:// で始まる URL だけをリンクにする
 * (AC-005-16、ADR-0017)。javascript: などはリンクにしない。
 */
const URL_PATTERN = /(https?:\/\/[^\s<>"'「」、。]+)/g

export function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN)
  return (
    <p className="notice-body">
      {parts.map((part, i) =>
        // split with a capture group puts the URLs at odd positions
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  )
}
