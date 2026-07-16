// Idempotent dev seed: one teacher, one student, one assignment with the
// default scaffolding fade. Runs at server boot.

const { col } = require('./store');

function seed() {
  if (col('users').list().length > 0) return;

  const teacher = col('users').add({
    email: 'teacher@school.dev',
    displayName: 'Dev Teacher',
    role: 'teacher',
    createdAt: new Date().toISOString(),
  });

  col('users').add({
    email: 'student@school.dev',
    displayName: 'Dev Student',
    role: 'student',
    createdAt: new Date().toISOString(),
  });

  col('assignments').add({
    teacherId: teacher.id,
    title: 'Persuasive essay: school start times',
    prompt:
      'Write a persuasive essay (600–900 words) arguing whether your school should move to a later start time. ' +
      'Take a clear position, support it with at least three distinct reasons, address one counterargument, ' +
      'and cite evidence for your claims.',
    dueDate: null,
    draftBudget: 3,
    coachingLevels: ['full', 'questions', 'sounding-board'],
    createdAt: new Date().toISOString(),
  });
}

module.exports = { seed };
