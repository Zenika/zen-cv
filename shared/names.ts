const nameWords = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
    .sort()
    .join(' ')

export function isSameName(fullName: string, cv: { firstname: string; name: string }) {
  return nameWords(fullName) === nameWords(`${cv.firstname} ${cv.name}`)
}
