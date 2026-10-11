export function TerminalConsole({
  cumulativeStdout,
  stderr,
}: {
  cumulativeStdout: string;
  stderr?: string;
}) {
  return (
    <details className="terminal">
      <summary>
        Console{" "}
        <span>
          {cumulativeStdout || stderr ? "Output available" : "No output"}
        </span>
      </summary>
      <div className="terminal-body">
        <pre>{cumulativeStdout || "No standard output at this stop."}</pre>
        {stderr && <pre className="stderr">{stderr}</pre>}
      </div>
    </details>
  );
}
