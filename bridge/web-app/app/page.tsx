import Link from "next/link";
import DiagramRenderer from "@/components/DiagramRenderer";

const sampleChart = `flowchart LR
  A[Highlight text] --> B[Bridge proxy]
  B --> C[Explain like I'm 5]
  B --> D[Study notes]
  B --> E[Diagram]`;

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Bridge</h1>
      <p className="mt-2 text-neutral-600">
        Notes, diagrams, and quizzes built from what you highlight or hear in lecture.
      </p>

      <section className="mt-10 rounded-lg border border-neutral-200 p-6">
        <h2 className="mb-4 text-lg font-medium">How Bridge works</h2>
        <DiagramRenderer chart={sampleChart} />
      </section>

      <Link
        href="/quiz"
        className="mt-8 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Go to quiz
      </Link>
    </main>
  );
}
