// Сборка exlib.js — база упражнений для каталога.
// Запуск: node tools/exlib/build.js путь/к/exercises.json exlib.js
// exercises.json — dist/exercises.json из https://github.com/yuhonas/free-exercise-db
// Источник: free-exercise-db (Unlicense). Русские названия, тип движения по
// плоскостной системе и пометки из книги «Фитнес для умных» — свои.
const fs = require('fs');
const E = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const RU = {};
fs.readFileSync(__dirname + '/ru.txt', 'utf8').split('\n').filter(Boolean)
  .forEach(l => { const [a, b] = l.split('\t'); RU[a] = b.trim(); });
const OWN = {};   // id базы → ключ упражнения приложения
fs.readFileSync(__dirname + '/map.txt', 'utf8').split('\n').filter(Boolean)
  .forEach(l => { const [k, id] = l.split('\t'); OWN[id.trim()] = k.trim(); });

const has = (id, re) => re.test(id);
function plane(e) {
  const id = e.id, p = e.primaryMuscles[0], c = e.category;
  if (c === 'stretching') return 'stretch';
  if (c === 'cardio') return 'cardio';
  if (has(id, /Clean|Snatch|External_Rotation|Cuban_Press|Bottoms-Up/)) return 'vpn';
  if (has(id, /Face_Pull|Band_Pull_Apart|Internal_Rotation|Scapular_Pull/)) return 'kpch';
  if (has(id, /Jerk|Push_Press/)) return 'vpush';
  if (c === 'plyometrics') return 'plyo';
  if (has(id, /Shrug/)) return 'shrug';
  if (has(id, /Upright/)) return 'vpush';
  if (p === 'abdominals') return 'core';
  if (p === 'calves') return 'calf';
  if (p === 'forearms') return 'grip';
  if (p === 'neck') return 'neck';
  if (p === 'biceps') return 'arm';
  if (p === 'triceps') return has(id, /Bench_Press|Dip|Push-Up|Pushup|Floor_Press|Board_Press|Pin_Press|JM_Press|Close-Grip_Dumbbell_Press|Close-Grip_EZ-Bar_Press|Body-Up/) ? 'hpush' : 'arm';
  if (p === 'chest') return has(id, /Pullover/) ? 'vpull' : 'hpush';
  if (p === 'shoulders') return has(id, /Rear|Reverse_Fl|Back_Flyes|Rear-Delt|Sled_Reverse/) ? 'hpull' : 'vpush';
  if (p === 'lats') return (has(id, /Row/) && !has(id, /High_Pulley/)) ? 'hpull' : 'vpull';
  if (p === 'middle back') return has(id, /Chin|Pull-Up|Pullup/) ? 'vpull' : 'hpull';
  if (p === 'traps') return 'shrug';
  if (p === 'quadriceps') return has(id, /Deadlift|Tire_Flip|Rickshaw|Keg|Sandbag|Atlas/) ? 'hip' : 'knee';
  if (p === 'hamstrings' || p === 'glutes' || p === 'lower back' || p === 'abductors' || p === 'adductors') return 'hip';
  return 'other';
}

// «Не великолепная семёрка» — что книга считает вредным и чем заменить.
const HARM = [
  [/Sissy/, 'Присед Сизифа перегружает переднюю крестообразную связку. Замена — болгарский сплит-присед.'],
  [/^(Leg_Press|Narrow_Stance_Leg_Press|Smith_Machine_Leg_Press)$/, 'Жим ногами в силовом стиле поднимает давление и перегружает колени и таз. Если делать — одной ногой и не на максимум.'],
  [/Upright/, 'Тяга к подбородку крутит плечо внутрь до предела — путь к хронической травме плеча. Замена — подъём на грудь или рывок.'],
  [/^(Lying_Triceps_Press|EZ-Bar_Skullcrusher|Lying_Dumbbell_Tricep_Extension|Decline_EZ_Bar_Triceps_Extension|Lying_Close-Grip_Barbell_Triceps_Extension_Behind_The_Head|Lying_Close-Grip_Barbell_Triceps_Press_To_Chin|Incline_Barbell_Triceps_Extension|Standing_Overhead_Barbell_Triceps_Extension|Decline_Close-Grip_Bench_To_Skull_Crusher|Band_Skull_Crusher)$/, 'Французский жим бьёт по локтям. Замена — трицепсовый жим с гантелями на полу или отжимания на брусьях.'],
  [/^(Hack_Squat|Narrow_Stance_Hack_Squats)$/, 'Гакк-машина даёт «эффект выдвижного ящика» в колене. Замена — фронтальный присед.'],
  [/Concentration/, 'Концентрированные сгибания почти ничего не дают. Лучше подтягивания обратным хватом или сгибания Зотмана.'],
  [/^(Dumbbell_Flyes|Decline_Dumbbell_Flyes|Incline_Dumbbell_Flyes|Incline_Dumbbell_Flyes_-_With_A_Twist|One-Arm_Flat_Bench_Dumbbell_Flye)$/, 'Разводки лёжа перегружают плечевой сустав и не растят силу. Замена — отжимания или жим гантелей.']
];

// Лесенки книги: от простого к тяжёлому, последнее — одностороннее.
const LADDER = {
  hpush: ['Machine_Bench_Press', 'Pushups', 'Dumbbell_Bench_Press', 'Parallel_Bar_Dip', 'Barbell_Bench_Press_-_Medium_Grip', 'Standing_Cable_Chest_Press'],
  vpush: ['Side_Lateral_Raise', 'Handstand_Push-Ups', 'Seated_Dumbbell_Press', 'Kettlebell_Sumo_High_Pull', 'Push_Press', 'One-Arm_Kettlebell_Push_Press'],
  hpull: ['Leverage_Iso_Row', 'Inverted_Row', 'Dumbbell_Incline_Row', 'Seated_Cable_Rows', 'Bent_Over_Barbell_Row', 'One-Arm_Dumbbell_Row'],
  vpull: ['Wide-Grip_Lat_Pulldown', 'Band_Assisted_Pull-Up', 'Pullups', 'Chin-Up', 'One_Arm_Lat_Pulldown'],
  knee: ['Leg_Extensions', 'Split_Squat_with_Dumbbells', 'Zercher_Squats', 'Front_Barbell_Squat', 'Barbell_Squat', 'Single-Leg_High_Box_Squat'],
  hip: ['Seated_Leg_Curl', 'Single_Leg_Glute_Bridge', 'Hyperextensions_Back_Extensions', 'Romanian_Deadlift', 'Barbell_Deadlift', 'Kettlebell_One-Legged_Deadlift'],
  vpn: ['External_Rotation_with_Cable', 'Dumbbell_Clean', 'One-Arm_Kettlebell_Clean', 'Power_Clean', 'Snatch', 'One-Arm_Kettlebell_Snatch']
};
const LV = {};
Object.entries(LADDER).forEach(([k, a]) => a.forEach((id, i) => {
  if (!E.find(e => e.id === id)) throw new Error('нет в базе: ' + id);
  LV[id] = i + 1;
}));

const EQ = { bands: 'r', barbell: 'b', 'body only': 'w', cable: 'c', dumbbell: 'd', 'e-z curl bar': 'z',
  'exercise ball': 'f', 'foam roll': 'o', kettlebells: 'k', machine: 'm', 'medicine ball': 'n', other: 'x' };
const MU = { abdominals: 'ab', abductors: 'abd', adductors: 'add', biceps: 'bi', calves: 'ca', chest: 'ch',
  forearms: 'fo', glutes: 'gl', hamstrings: 'ha', lats: 'la', 'lower back': 'lb', 'middle back': 'mb',
  neck: 'ne', quadriceps: 'qu', shoulders: 'sh', traps: 'tr', triceps: 'tri' };
const CAT = { strength: 's', cardio: 'c', stretching: 't', plyometrics: 'p', powerlifting: 'l',
  'olympic weightlifting': 'o', strongman: 'g' };

const rows = E.map(e => {
  const harm = HARM.find(h => h[0].test(e.id));
  return [
    e.id, RU[e.id], e.name, CAT[e.category], EQ[e.equipment] || '', ({ beginner: 1, intermediate: 2, expert: 3 })[e.level] || 1,
    e.mechanic === 'isolation' ? 1 : 0,
    e.primaryMuscles.map(m => MU[m]).join(' '), e.secondaryMuscles.map(m => MU[m]).join(' '),
    plane(e), LV[e.id] || 0, harm ? harm[1] : '', OWN[e.id] || '',
    e.instructions, e.images.length ? 1 : 0
  ];
});
const out = '/* База упражнений для каталога. Упражнения, описания и фото — free-exercise-db\n' +
  '   (https://github.com/yuhonas/free-exercise-db, Unlicense — общественное достояние).\n' +
  '   Русские названия, тип движения по плоскостной системе и пометки по книге\n' +
  '   Д. Смирнова «Фитнес для умных» — свои. Собрано скриптом, руками не править.\n' +
  '   Поля: id, название, англ. название, категория, инвентарь, уровень 1–3, односуставное,\n' +
  '   основные мышцы, вспомогательные, тип движения, ступень лесенки, вред, ключ фото приложения,\n' +
  '   шаги техники (англ.), есть ли фото. */\n' +
  'window.EXLIB=' + JSON.stringify(rows) + ';\n';
fs.writeFileSync(process.argv[3], out);
const cnt = {}; rows.forEach(r => { cnt[r[9]] = (cnt[r[9]] || 0) + 1; });
console.log('rows', rows.length, 'bytes', out.length, cnt, 'own', rows.filter(r => r[12]).length, 'harm', rows.filter(r => r[11]).length);
