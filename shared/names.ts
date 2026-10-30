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

export function matchesSearch(query: string, cv: { firstname: string; name: string }) {
  const name = nameWords(`${cv.firstname} ${cv.name}`)
  return nameWords(query)
    .split(' ')
    .every((word) => name.includes(word))
}
