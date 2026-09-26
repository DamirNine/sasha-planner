export const SHY = '­';

const ALL = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const VOWEL = '[аеёиоуыэюя]';
const CONS = '[бвгджзклмнпрстфхцчшщ]';
const SIGN = '[йъь]';
const ANY = `[${ALL}]`;

const RULES = [
  new RegExp(`(${SIGN})(?=${ANY}${ANY})`, 'giu'),
  new RegExp(`(${VOWEL})(?=${VOWEL}${ANY})`, 'giu'),
  new RegExp(`(${VOWEL}${CONS})(?=${CONS}${VOWEL})`, 'giu'),
  new RegExp(`(${CONS}${VOWEL})(?=${CONS}${VOWEL})`, 'giu'),
  new RegExp(`(${VOWEL}${CONS})(?=${CONS}${CONS}${VOWEL})`, 'giu'),
  new RegExp(`(${VOWEL}${CONS}${CONS})(?=${CONS}${CONS}${VOWEL})`, 'giu'),
];

function hyphenateWord(word) {
  if (word.length < 5) return word;
  let out = word;
  for (const rule of RULES) out = out.replace(rule, `$1${SHY}`);
  const pieces = out.split(SHY);
  if (pieces.length < 2) return word;
  const merged = [];
  for (const piece of pieces) {
    if (merged.length && (piece.length < 2 || merged[merged.length - 1].length < 2)) merged[merged.length - 1] += piece;
    else merged.push(piece);
  }
  return merged.join(SHY);
}

export function hyphenate(text) {
  return String(text).replace(new RegExp(`${ANY}+`, 'giu'), hyphenateWord);
}
