"use client";

import { useEffect, useId, useState } from "react";

type DiagramRendererProps = {
  chart: string;
  className?: string;
};

export default function DiagramRenderer({ chart, className }: DiagramRendererProps) {
  const id = `mermaid-${useId().replace(/:/g, "")}`;
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      if (!chart.trim()) {
        setSvg("");
        setError(null);
        return;
      }
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled) {
          setSvg(svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setSvg("");
          setError(err instanceof Error ? err.message : "Could not render diagram.");
        }
      }
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-red-600">Diagram error: {error}</p>
        <pre className="mt-2 overflow-x-auto rounded bg-neutral-100 p-3 text-xs text-neutral-700">{chart}</pre>
      </div>
    );
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
