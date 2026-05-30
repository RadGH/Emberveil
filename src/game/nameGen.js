/**
 * nameGen.js (M253 hotfix)
 *
 * Gendered name registry + helpers. Pulled out of CharacterBuilderScreen
 * to break a circular import:
 *   CharacterBuilderScreen imports TownScreen (for _confirm flow)
 *   TownScreen imports CharacterBuilderScreen (for namesForGender)
 *
 * Both screens now import from this dependency-less module instead.
 */

import { getAppearance } from './appearances.js';

export const NAMES = [
  { name: 'Borin',  gender: 'male' },   { name: 'Rekk',   gender: 'male' },
  { name: 'Dren',   gender: 'male' },   { name: 'Garrik', gender: 'male' },
  { name: 'Hask',   gender: 'male' },   { name: 'Korv',   gender: 'male' },
  { name: 'Ulric',  gender: 'male' },   { name: 'Jarek',  gender: 'male' },
  { name: 'Vern',   gender: 'male' },   { name: 'Tobas',  gender: 'male' },
  { name: 'Eron',   gender: 'male' },   { name: 'Ralf',   gender: 'male' },
  { name: 'Merek',  gender: 'male' },   { name: 'Sten',   gender: 'male' },
  { name: 'Branic', gender: 'male' },   { name: 'Aldric', gender: 'male' },
  { name: 'Corvin', gender: 'male' },   { name: 'Darian', gender: 'male' },
  { name: 'Elric',  gender: 'male' },   { name: 'Fenric', gender: 'male' },
  { name: 'Galven', gender: 'male' },   { name: 'Hadrik', gender: 'male' },
  { name: 'Ivar',   gender: 'male' },   { name: 'Kaelin', gender: 'male' },
  { name: 'Lorik',  gender: 'male' },   { name: 'Maric',  gender: 'male' },
  { name: 'Nord',   gender: 'male' },   { name: 'Osric',  gender: 'male' },
  { name: 'Perrin', gender: 'male' },   { name: 'Quintus',gender: 'male' },
  { name: 'Aela',   gender: 'female' }, { name: 'Lysa',   gender: 'female' },
  { name: 'Kira',   gender: 'female' }, { name: 'Sera',   gender: 'female' },
  { name: 'Vana',   gender: 'female' }, { name: 'Ryna',   gender: 'female' },
  { name: 'Nessa',  gender: 'female' }, { name: 'Thessa', gender: 'female' },
  { name: 'Mira',   gender: 'female' }, { name: 'Dara',   gender: 'female' },
  { name: 'Ylva',   gender: 'female' }, { name: 'Orin',   gender: 'female' },
  { name: 'Selka',  gender: 'female' }, { name: 'Pryla',  gender: 'female' },
  { name: 'Malia',  gender: 'female' }, { name: 'Brynn',  gender: 'female' },
  { name: 'Cyra',   gender: 'female' }, { name: 'Delia',  gender: 'female' },
  { name: 'Elara',  gender: 'female' }, { name: 'Faeya',  gender: 'female' },
  { name: 'Gwen',   gender: 'female' }, { name: 'Hilda',  gender: 'female' },
  { name: 'Isla',   gender: 'female' }, { name: 'Jaela',  gender: 'female' },
  { name: 'Kora',   gender: 'female' }, { name: 'Liora',  gender: 'female' },
  { name: 'Maeve',  gender: 'female' }, { name: 'Nyra',   gender: 'female' },
  { name: 'Odelia', gender: 'female' }, { name: 'Priya',  gender: 'female' },
  { name: 'Rowan',  gender: 'either' }, { name: 'Alex',   gender: 'either' },
  { name: 'Sam',    gender: 'either' }, { name: 'Morgan', gender: 'either' },
  { name: 'Avery',  gender: 'either' }, { name: 'Taylor', gender: 'either' },
];

export function namesForGender(gender) {
  return NAMES.filter(n => n.gender === gender || n.gender === 'either').map(n => n.name);
}

export function rollRandomHeroName(appearanceId) {
  const ap = appearanceId ? getAppearance(appearanceId) : null;
  const gender = ap?.gender || (Math.random() < 0.5 ? 'male' : 'female');
  const pool = namesForGender(gender);
  return pool[Math.floor(Math.random() * pool.length)];
}
