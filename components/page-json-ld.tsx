// Escape "<" so a "</script>" (or any tag) inside a string value can never
// terminate the block early or inject markup.
export const safeJsonLd = (block: object) =>
  JSON.stringify(block).replace(/</g, "\\u003c");

export function PageJsonLd({ data }: { data: object | object[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(block) }}
        />
      ))}
    </>
  );
}
