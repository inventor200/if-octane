export function toSearchTerm(name: string): string {
  const oldName = name.trim().toLowerCase();

  if (oldName.length === 0) return oldName;

  let newName0 = "";

  for (let i = 0; i < oldName.length; i++) {
    const c = oldName[i];
    if (!isAlphaNumeric(c)) newName0 += '_';
    else newName0 += c;
  }

  let pointer = 0;

  // Trim leading underscores in result
  while (newName0[pointer] === '_') {
    pointer++;
  }

  const dstLeadingScores = pointer;

  pointer = 0;

  // Find intentional leading underscores
  while (oldName[pointer] === '_') {
    pointer++;
  }

  const srcLeadingScores = pointer;

  pointer = newName0.length - 1;

  // Find trailing underscores
  while (newName0[pointer] === '_') {
    pointer--;
  }

  const cropEnd = pointer + 1;

  if (cropEnd <= dstLeadingScores) {
    // The whole thing is underscores
    return "";
  }

  let newName1 = "";

  for (let i = 0; i < srcLeadingScores; i++) {
    newName1 += '_';
  }

  let passedUnderscore = false;

  for (let i = dstLeadingScores; i < cropEnd; i++) {
    const c = newName0[i];

    if (c === '_') {
      if (!passedUnderscore) newName1 += c;
      passedUnderscore = true;
    }
    else {
      passedUnderscore = false;
      newName1 += c;
    }
  }

  return newName1;
}

// NOTE: Only works for single characters!
function isAlphaNumeric(c: string): boolean {
  if (c.length === 0) return false;

  const code = c.charCodeAt(0);

  return (
    (code > 47 && code < 58) || // 0-9
      //(code > 64 && code < 91) || // A-Z
      (code > 96 && code < 123) // a-z
  );
}
