"use client";

import { useState } from "react";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
};

// Placeholder questions until the proxy server returns generated quizzes.
const questions: Question[] = [
  {
    id: "q1",
    prompt: "What does the mitochondria do in a cell?",
    options: ["Stores DNA", "Makes energy", "Builds the cell wall", "Moves water"],
    answer: 1,
  },
  {
    id: "q2",
    prompt: "In economics, what is opportunity cost?",
    options: [
      "The price you pay at the store",
      "The value of the next best choice you give up",
      "The tax on a purchase",
      "The profit a company makes",
    ],
    answer: 1,
  },
];

export default function QuizPage() {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = questions.filter((q) => selected[q.id] === q.answer).length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Quiz</h1>
      <p className="mt-1 text-sm text-neutral-500">Pick one answer for each question.</p>

      <ol className="mt-8 space-y-8">
        {questions.map((q, i) => (
          <li key={q.id}>
            <p className="font-medium">
              {i + 1}. {q.prompt}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((option, idx) => {
                const isChosen = selected[q.id] === idx;
                const showResult = submitted && isChosen;
                const correct = idx === q.answer;
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                      showResult
                        ? correct
                          ? "border-green-500 bg-green-50"
                          : "border-red-500 bg-red-50"
                        : isChosen
                          ? "border-blue-500"
                          : "border-neutral-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={isChosen}
                      disabled={submitted}
                      onChange={() => setSelected((s) => ({ ...s, [q.id]: idx }))}
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex items-center gap-4">
        {submitted ? (
          <>
            <p className="text-sm">
              Score: {score} / {questions.length}
            </p>
            <button
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
              onClick={() => {
                setSelected({});
                setSubmitted(false);
              }}
            >
              Try again
            </button>
          </>
        ) : (
          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={Object.keys(selected).length < questions.length}
            onClick={() => setSubmitted(true)}
          >
            Check answers
          </button>
        )}
      </div>
    </main>
  );
}
