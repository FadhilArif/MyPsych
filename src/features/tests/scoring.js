'use strict';

// ============================================================
  // SCORE
  // ============================================================

  function clamp(value) {
    return Math.max(0, Math.min(100, value));
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function level(score) {
    if (score >= 90) return 'Sangat baik';
    if (score >= 80) return 'Baik';
    if (score >= 65) return 'Cukup';
    if (score >= 50) return 'Perlu latihan';
    return 'Perlu ditingkatkan';
  }

    function calculateKraepelin() {
    let answered = 0;
    let correct = 0;
    const counts = [];
    const correctPerColumn = []; // <-- BARU

    state.answers.forEach((columnAnswers, columnIndex) => {
      let columnCount = 0;
      let columnCorrect = 0; // <-- BARU

      columnAnswers.forEach((answer, questionIndex) => {
        if (answer === null) return;
        answered += 1;
        columnCount += 1;

        const expected = (
          state.columns[columnIndex][26 - questionIndex] +
          state.columns[columnIndex][25 - questionIndex]
        ) % 10;

        if (Number(answer) === expected) {
          correct += 1;
          columnCorrect += 1; // <-- BARU
        }
      });

            counts.push(columnCount);
      correctPerColumn.push(columnCorrect);
    });

    const total = CONFIG.KRAEPELIN_COLUMNS * CONFIG.KRAEPELIN_QUESTIONS;
    const average = mean(counts);
    const standardDeviation = Math.sqrt(
      mean(counts.map((count) => (count - average) ** 2)),
    );

    const consistency = Math.round(
      clamp(100 - (average ? standardDeviation / average : 1) * 100),
    );

    const first = mean(counts.slice(0, 10));
    const middle = mean(counts.slice(20, 30));
    const last = mean(counts.slice(40, 50));
    const baseline = Math.max(1, mean([first, middle]));
    const endurance = Math.round(
      clamp(100 - Math.max(0, (baseline - last) / baseline) * 100),
    );

    return {
      type: 'kraepelin',
      package: state.package,
      answered, correct, wrong: answered - correct, total,
      score: Math.round((correct / total) * 100),
      speed: Math.round((answered / total) * 100),
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      consistency,
      endurance,
      average,
      chart: counts,
      correctPerColumn,
    };
  }

  function calculateMCQ() {
    const total = state.questions.length;

    const answered = state.answers.filter((a) => a !== null).length;
    const correct = state.answers.reduce(
      (sum, answer, index) =>
        sum + (answer === state.questions[index].correct ? 1 : 0),
      0
    );

    const wrong = answered - correct;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
    const speed = total ? Math.round((answered / total) * 100) : 0;
    const consistency = Math.round(clamp(100 - Math.abs(speed - accuracy)));
    const endurance = Math.round(clamp(total ? (answered / total) * 100 : 0));

    const chart = state.questions.map((_, index) => {
      const answer = state.answers[index];
      const time = state.questionTimes[index];

      if (answer === null) {
        return { time: CONFIG.MCQ_SECONDS, correct: false, answered: false };
      }
      return {
        time: Number(time || 0),
        correct: answer === state.questions[index].correct,
        answered: true,
      };
    });

     // ---- Kumpulkan detail soal yang salah ----
    const wrongNumbers = [];
    const wrongDetails = [];

    chart.forEach((item, idx) => {
      if (item.correct) return;
      const q = state.questions[idx];
      wrongNumbers.push(idx + 1);
      wrongDetails.push({
        no: idx + 1,
        text: String(q?.text || ''),
        userAnswer: state.answers[idx],
        correctAnswer: q?.correct,
        options: Array.isArray(q?.options) ? q.options : [],
      });
    });

    return {
      type: state.test,
      package: state.package,
      answered, correct, wrong, total,
      score: accuracy, speed, accuracy, consistency, endurance,
      average: mean(state.answers.map((a) => (a === null ? 0 : 1))),
      chart,
      wrongNumbers,
      wrongDetails,
    };
  }
