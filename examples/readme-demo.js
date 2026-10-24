// A small JavaScript exercise for modal editing practice.
const lessons = [
  { name: "Motions", minutes: 10, done: true },
  { name: "Text objects", minutes: 15, done: false },
  { name: "Repeat and undo", minutes: 10, done: false },
];

function summarizeLessons(items) {
  const completed = items.filter((item) => item.done);
  const remaining = items.filter((item) => !item.done);
  const minutes = items.reduce((total, item) => total + item.minutes, 0);

  return {
    completed: completed.length,
    remaining: remaining.length,
    minutes,
  };
}

const summary = summarizeLessons(lessons);

console.table(lessons);
console.log("Practice summary", summary);
console.assert(summary.completed === 1, "One lesson should be complete.");
console.assert(summary.remaining === 2, "Two lessons should remain.");
console.log("Ready to practice: motions, text objects, repeat and undo.");
