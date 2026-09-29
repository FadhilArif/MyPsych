/* MyPsych shared application configuration */
(() => {
  'use strict';

  window.MyPsychConfig = Object.freeze({
    CONFIG: Object.freeze({
      API_URL: '/api/gateway',
      SESSION_KEY: 'psychotest_session_v2',
      TEST_KEY: 'psychotest_active_v2',
      PDF_TIMEOUT: 10000,
      KRAEPELIN_COLUMNS: 50,
      KRAEPELIN_QUESTIONS: 26,
      KRAEPELIN_SECONDS: 15,
      MCQ_QUESTIONS: 20,
      MCQ_SECONDS: 30,
    }),

    SKD_COMPLETE_CONFIG: Object.freeze({
      waitingSeconds: 180,
      sections: Object.freeze({
        twk: Object.freeze({ name: 'TWK', minutes: 20, questions: 20 }),
        tiu: Object.freeze({ name: 'TIU', minutes: 20, questions: 20 }),
        tkp: Object.freeze({ name: 'TKP', minutes: 20, questions: 20 }),
      }),
    }),

    TESTS: Object.freeze({
      kraepelin: Object.freeze({
        name: 'Kraepelin',
        description: 'Latihan ritme kerja, kecepatan, ketelitian, konsistensi, dan ketahanan.',
        kind: 'kraepelin',
        logo: './assets/logos/logo_kreaplin.png',
      }),
      kuantitatif: Object.freeze({
        name: 'Kuantitatif',
        description: 'Latihan hitungan dasar, persentase, rasio, dan operasi numerik.',
        kind: 'mcq',
        logo: './assets/logos/logo_kuantitatif.png',
      }),
      numerical: Object.freeze({
        name: 'Numerical',
        description: 'Latihan pola angka, deret, perbandingan, dan penalaran numerik.',
        kind: 'mcq',
        logo: './assets/logos/logo_numerical.png',
      }),
      sinonim: Object.freeze({
        name: 'Sinonim Verbal',
        description: 'Latihan memahami persamaan makna kata dalam konteks psikotes.',
        kind: 'mcq',
        logo: './assets/logos/logo_mypsych.png',
      }),
      silogisme: Object.freeze({
        name: 'Silogisme',
        description: 'Latihan menarik kesimpulan logis dari beberapa premis.',
        kind: 'mcq',
        logo: './assets/logos/logo_silogisme.png',
      }),
      analogi: Object.freeze({
        name: 'Analogi',
        description: 'Latihan hubungan kata dan konsep secara analogis.',
        kind: 'mcq',
        logo: './assets/logos/logo_analogi.png',
      }),
      kognitif: Object.freeze({
        name: 'Tes Kognitif',
        description: 'Latihan gabungan perhatian, logika, memori, dan pemecahan masalah.',
        kind: 'mcq',
        group: 'psikotes',
        logo: './assets/logos/logo_kognitif.png',
      }),
      twk: Object.freeze({
        name: 'TWK',
        fullName: 'Tes Wawasan Kebangsaan',
        description: 'Latihan wawasan kebangsaan untuk materi TWK SKD.',
        kind: 'mcq',
        group: 'skd',
        logo: './assets/logos/logo_twk.png',
      }),
      tiu: Object.freeze({
        name: 'TIU',
        fullName: 'Tes Intelegensi Umum',
        description: 'Latihan verbal, numerik, dan figural untuk TIU SKD.',
        kind: 'mcq',
        group: 'skd',
        logo: './assets/logos/logo_tiu.png',
      }),
      tkp: Object.freeze({
        name: 'TKP',
        fullName: 'Tes Karakteristik Pribadi',
        description: 'Latihan situasi kerja dan pengambilan keputusan untuk TKP SKD.',
        kind: 'mcq',
        group: 'skd',
        logo: './assets/logos/logo_tkp.png',
      }),
      skd_lengkap: Object.freeze({
        name: 'SKD Paket Lengkap',
        fullName: 'TWK + TIU + TKP',
        description: 'Simulasi lengkap SKD dengan timer terpisah per bagian dan navigasi bebas.',
        kind: 'skd_complete',
        group: 'skd',
        logo: './assets/logos/logo_mypsych.png',
      }),
    }),
  });
})();
