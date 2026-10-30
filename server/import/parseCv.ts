import type { Experience, Realisation, UserData } from '../../shared/cv.ts'
import { bulletPattern, type PdfLine } from './pdfLines.ts'

export type ParsedCv = { cv: UserData; warnings: string[] }

export const missingValue = 'À compléter'
const leftColumnEnd = 180
const periodPattern = /\(\s*([^()]*\d{4}[^()]*?)\s*\)/
const yearPattern = /\d{4}(?:\s*[-–]\s*\d{4})?/

const position = (line: PdfLine) => line.page * 10_000 + line.y
const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
const clean = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim()
const stripColon = (text: string) => text.replace(/\s*:$/, '')
const isSeparator = (line: PdfLine) => /^_+$/.test(line.text)

function bulletOf(text: string) {
  const [first, ...rest] = text.split(' ')
  return first && rest.length && bulletPattern.test(first) ? rest.join(' ') : undefined
}

function paragraphGap(previous: PdfLine, line: PdfLine) {
  return previous.page !== line.page || line.y - previous.y > 2 * line.size
}

function mostCommon(values: number[]) {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
}

function splitTopLevel(text: string, separator: string) {
  const parts = ['']
  let depth = 0
  for (const char of text) {
    if (char === '(') depth++
    if (char === ')') depth = Math.max(0, depth - 1)
    if (char === separator && !depth) parts.push('')
    else parts[parts.length - 1] += char
  }
  return parts.map(clean).filter(Boolean)
}

const capitalize = (word: string) =>
  word
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, start, letter) => start + letter.toUpperCase())

function parseName(text: string, warnings: string[]) {
  const words = text.split(' ')
  const lastnameIndex = words.findIndex(
    (word, index) => index > 0 && /\p{L}/u.test(word) && word === word.toUpperCase(),
  )
  if (lastnameIndex > 0)
    return {
      firstname: words.slice(0, lastnameIndex).join(' '),
      name: words.slice(lastnameIndex).map(capitalize).join(' '),
    }
  if (words.length > 1) return { firstname: words[0]!, name: words.slice(1).join(' ') }
  warnings.push(`Le nom « ${text} » n'a pas pu être séparé du prénom.`)
  return { firstname: text || missingValue, name: missingValue }
}

const sectionKinds = {
  experiences: /^(dernieres)?\s*experiences?$|^dernieres$/,
  education: /^formations?$/,
  languages: /^langues$/,
}
type SectionKind = keyof typeof sectionKinds

function sectionOf(line: PdfLine, bodySize: number) {
  if (line.size <= bodySize) return undefined
  const text = normalize(line.text)
  return (Object.keys(sectionKinds) as SectionKind[]).find((kind) => sectionKinds[kind].test(text))
}

const skillKinds = [
  [/^expertises?$/, 'expertise'],
  [/^certifications?$/, 'certifications'],
  [/^methodolog(ie|y|ies)s?$/, 'methodologies'],
  [/^(formateur|formations?|speaker|trainer)\b/, 'trainer'],
] as const
type SkillKind = (typeof skillKinds)[number][1]

const skillKindOf = (text: string) =>
  skillKinds.find(([pattern]) => pattern.test(normalize(text)))?.[1]

function columnEntries(lines: PdfLine[], right: number | undefined) {
  const bulleted = lines.some((line) => bulletOf(line.text) !== undefined)
  const entries: { text: string; last: PdfLine }[] = []
  for (const line of lines) {
    const bullet = bulletOf(line.text)
    const text = bullet ?? line.text
    const previous = entries.at(-1)
    const firstWord = text.split(' ')[0]!
    const wrapped =
      right !== undefined &&
      previous !== undefined &&
      previous.last.x +
        previous.last.width +
        line.size * 0.3 +
        (line.width * firstWord.length) / text.length >
        right
    const continues =
      previous &&
      (bulleted
        ? bullet === undefined
        : previous.text.endsWith(':') || /^[\p{Ll}(]/u.test(text) || wrapped)
    if (continues) {
      previous.text = clean(`${previous.text} ${text}`)
      previous.last = line
    } else entries.push({ text: clean(text), last: line })
  }
  return entries.map(({ text }) => text)
}

function parseSkills(header: PdfLine[], lines: PdfLine[], cv: UserData, warnings: string[]) {
  const columns = [...header].sort((a, b) => a.x - b.x)
  const columnLines = columns.map(() => [] as PdfLine[])
  for (const line of lines) {
    const index = columns.findLastIndex((column) => column.x <= line.x + 15)
    columnLines[Math.max(0, index)]!.push(line)
  }
  columns.forEach((column, index) => {
    const entries = columnEntries(columnLines[index]!, columns[index + 1]?.x)
    const kind: SkillKind | undefined = skillKindOf(column.text)
    if (!kind) {
      if (entries.length)
        warnings.push(`Colonne « ${column.text} » non reconnue, ignorée : ${entries.join(', ')}.`)
      return
    }
    if (kind !== 'expertise') return cv[kind].push(...entries)
    for (const entry of entries) {
      const [name, ...level] = entry.split(':')
      cv.expertise.push({
        name: clean(name!),
        level: clean(level.join(':').replace(/^[\s:]+/, '')),
      })
    }
  })
}

function parseBio(lines: PdfLine[]) {
  const columns: PdfLine[][] = []
  for (const line of [...lines].sort((a, b) => a.x - b.x || position(a) - position(b))) {
    const column = columns.find((candidate) => Math.abs(candidate[0]!.x - line.x) < 20)
    if (column) column.push(line)
    else columns.push([line])
  }
  return columns
    .map((column) =>
      clean(
        column
          .sort((a, b) => position(a) - position(b))
          .map(({ text }) => text)
          .join(' '),
      ),
    )
    .join('\n\n')
}

type Token =
  | { kind: 'paragraph'; text: string; lines: number; last: PdfLine }
  | { kind: 'bullet'; level: number; text: string; last: PdfLine; x: number }
  | { kind: 'environment'; text: string; last: PdfLine }

function tokenize(lines: PdfLine[], bulletLevels: number[]) {
  const tokens: Token[] = []
  for (const line of lines) {
    const previous = tokens.at(-1)
    const bullet = bulletOf(line.text)
    const environment = /^environnement technique\s*:?\s*/i.exec(line.text)
    const near = previous !== undefined && !paragraphGap(previous.last, line)
    if (environment) {
      tokens.push({ kind: 'environment', text: line.text.slice(environment[0].length), last: line })
    } else if (bullet !== undefined) {
      const level = bulletLevels.findIndex((x) => Math.abs(x - line.x) < 6)
      tokens.push({
        kind: 'bullet',
        level: Math.max(0, level),
        text: bullet,
        last: line,
        x: line.x,
      })
    } else if (previous?.kind === 'bullet' && near && line.x > previous.x + 5) {
      previous.text += ` ${line.text}`
      previous.last = line
    } else if (
      previous?.kind === 'environment' &&
      (near || previous.text.endsWith(',')) &&
      Math.abs(line.x - previous.last.x) < 6
    ) {
      previous.text += ` ${line.text}`
      previous.last = line
    } else if (
      previous?.kind === 'paragraph' &&
      near &&
      !(/[.:!?]$/.test(previous.text) && line.text.endsWith(':'))
    ) {
      previous.text += ` ${line.text}`
      previous.lines++
      previous.last = line
    } else {
      tokens.push({ kind: 'paragraph', text: line.text, lines: 1, last: line })
    }
  }
  for (const token of tokens) token.text = clean(token.text)
  return tokens
}

type BulletNode = { text: string; children: BulletNode[] }

function bulletTree(bullets: Extract<Token, { kind: 'bullet' }>[]) {
  const roots: BulletNode[] = []
  const stack: { level: number; node: BulletNode }[] = []
  for (const { level, text } of bullets) {
    const node = { text: text.replace(/\s*[,;]$/, ''), children: [] }
    while (stack.length && stack.at(-1)!.level >= level) stack.pop()
    ;(stack.at(-1)?.node.children ?? roots).push(node)
    stack.push({ level, node })
  }
  return roots
}

function flatten({ text, children }: BulletNode): string {
  if (!children.length) return text
  const details = children.map(flatten).join(' ; ')
  return text.endsWith(':') ? `${text} ${details}` : `${text} : ${details}`
}

function listRealisations(roots: BulletNode[], title: string | undefined): Realisation[] {
  if (title !== undefined || roots.every(({ children }) => !children.length))
    return [{ ...(title && { title }), type: 'list', description: roots.map(flatten) }]
  const realisations: Realisation[] = []
  for (const root of roots) {
    const previous = realisations.at(-1)
    if (root.children.length)
      realisations.push({
        title: stripColon(root.text),
        type: 'list',
        description: root.children.map(flatten),
      })
    else if (previous && !previous.title && Array.isArray(previous.description))
      previous.description.push(root.text)
    else realisations.push({ type: 'list', description: [root.text] })
  }
  return realisations
}

const titleLike = (token: Token) =>
  token.kind === 'paragraph' && token.text.length <= 100 && !token.text.endsWith('.')

function textRealisation(text: string): Realisation {
  const split = /^(.{1,40}?)\s+:\s+(.+)$/.exec(text)
  return split
    ? { title: split[1], type: 'text', description: split[2]! }
    : { type: 'list', description: [text] }
}

function parseHeader(lines: PdfLine[]) {
  let count = 1
  const headerText = () =>
    lines
      .slice(0, count)
      .map(({ text }) => text)
      .join('\n')
  while (
    !periodPattern.test(headerText()) &&
    count < Math.min(3, lines.length) &&
    !paragraphGap(lines[count - 1]!, lines[count]!)
  )
    count++
  if (!periodPattern.test(headerText())) count = 1
  while (
    count < lines.length &&
    /^[&\p{Ll}]/u.test(lines[count]!.text) &&
    !bulletOf(lines[count]!.text) &&
    !paragraphGap(lines[count - 1]!, lines[count]!)
  )
    count++

  const text = headerText()
  const period = periodPattern.exec(text)
  const [first = '', ...rest] = text
    .replace(periodPattern, '')
    .split('\n')
    .map(clean)
    .filter(Boolean)
  let role = first
  const team: string[] = []
  for (const line of rest) {
    if (/^[&\p{Ll}(]/u.test(line)) role = clean(`${role} ${line}`)
    else team.push(line)
  }
  return {
    position: role,
    period: period ? clean(period[1]!.replace(/\n/g, ' ')) : '',
    team: team.join(', '),
    body: lines.slice(count),
  }
}

function parseExperience(company: string, lines: PdfLine[], bulletLevels: number[]) {
  const header = parseHeader(lines)
  const tokens = tokenize(header.body, bulletLevels)
  const environments = tokens.filter(({ kind }) => kind === 'environment').length
  const context: string[] = []
  const realisations: Realisation[] = []
  const technicalEnvironment: Experience['technicalEnvironment'] = []
  let lastTitle: string | undefined

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!
    const next = tokens[index + 1]
    if (token.kind === 'environment') {
      technicalEnvironment.push({
        name:
          environments > 1 && lastTitle
            ? `Environnement technique (${lastTitle})`
            : 'Environnement technique',
        value: token.text,
      })
    } else if (token.kind === 'bullet') {
      let end = index
      while (tokens[end + 1]?.kind === 'bullet') end++
      const bullets = tokens.slice(index, end + 1) as Extract<Token, { kind: 'bullet' }>[]
      realisations.push(...listRealisations(bulletTree(bullets), undefined))
      index = end
    } else if (next?.kind === 'bullet' && titleLike(token)) {
      let end = index + 1
      while (tokens[end + 1]?.kind === 'bullet') end++
      const bullets = tokens.slice(index + 1, end + 1) as Extract<Token, { kind: 'bullet' }>[]
      lastTitle = stripColon(token.text)
      realisations.push(...listRealisations(bulletTree(bullets), lastTitle))
      index = end
    } else if (!realisations.length && !technicalEnvironment.length) {
      context.push(token.text)
    } else {
      const realisation = textRealisation(token.text)
      lastTitle = realisation.title ?? lastTitle
      realisations.push(realisation)
    }
  }

  return {
    name: company,
    position: header.position,
    period: header.period,
    ...(header.team && { team: header.team }),
    context: context.join('\n'),
    realisations,
    technicalEnvironment,
  } satisfies Experience
}

function parseExperiences(lines: PdfLine[], bodySize: number, warnings: string[]) {
  const left = lines.filter((line) => line.x < leftColumnEnd)
  const right = lines.filter((line) => line.x >= leftColumnEnd)

  const companies: { name: string; start: number }[] = []
  let previous: PdfLine | undefined
  for (const line of left) {
    const company = companies.at(-1)
    if (company && previous && previous.page === line.page && line.y - previous.y < 30)
      company.name = clean(`${company.name} ${line.text}`)
    else {
      const aligned = right.findLast(
        (candidate, index) =>
          candidate.page === line.page &&
          candidate.y < line.y + 2 &&
          line.y - candidate.y < 30 &&
          (!index || paragraphGap(right[index - 1]!, candidate)),
      )
      companies.push({ name: line.text, start: position(aligned ?? line) })
    }
    previous = line
  }

  const roles: { company: string; lines: PdfLine[] }[] = []
  for (const line of right) {
    const company = companies.findLast(({ start }) => start <= position(line))
    if (!company) {
      warnings.push(`Texte ignoré avant la première entreprise : « ${line.text} ».`)
      continue
    }
    const role = roles.at(-1)
    const last = role?.lines.at(-1)
    const newCompany = !role || role.company !== company.name || company.start === position(line)
    const newRole =
      last !== undefined &&
      line.size > bodySize &&
      periodPattern.test(line.text) &&
      !bulletOf(line.text) &&
      paragraphGap(last, line)
    if (newCompany || newRole) roles.push({ company: company.name, lines: [line] })
    else role.lines.push(line)
  }

  const bulletLevels = [
    ...new Set(right.filter((line) => bulletOf(line.text)).map(({ x }) => Math.round(x))),
  ]
    .sort((a, b) => a - b)
    .filter((x, index, all) => !index || x - all[index - 1]! >= 6)

  return roles.map(({ company, lines }) => {
    const experience = parseExperience(company, lines, bulletLevels)
    if (!experience.position) {
      warnings.push(`Poste introuvable pour l'expérience chez ${company}.`)
      experience.position = missingValue
    }
    return experience
  })
}

const leadingYear = new RegExp(`^(${yearPattern.source})\\s+`)
const trailingYear = new RegExp(`\\s*[-–,]\\s*(${yearPattern.source})\\.?$`)

function parseEducation(lines: PdfLine[]) {
  const entries: string[] = []
  for (const { text } of lines) {
    if (!entries.length || leadingYear.test(text) || trailingYear.test(text)) entries.push(text)
    else entries[entries.length - 1] += ` ${text}`
  }
  return entries.map((entry) => {
    let text = clean(entry)
    let period = ''
    const leading = leadingYear.exec(text)
    const trailing = trailingYear.exec(text)
    if (leading) {
      period = leading[1]!
      text = text.slice(leading[0].length)
    } else if (trailing) {
      period = trailing[1]!
      text = text.slice(0, trailing.index)
    }
    text = text.replace(/\.$/, '')
    const dash = text.indexOf(' - ')
    if (dash > 0)
      return { period, title: text.slice(dash + 3).trim(), school: text.slice(0, dash).trim() }
    const [title = text, ...school] = splitTopLevel(text, ',')
    return { period, title, school: school.join(', ') }
  })
}

function parseLanguages(lines: PdfLine[]) {
  return splitTopLevel(lines.map(({ text }) => text).join(', '), ',').map((language) => {
    const match = /^(.*?)\s*\((.*)\)$/.exec(language)
    return match ? { name: match[1]!, level: clean(match[2]!) } : { name: language, level: '' }
  })
}

export function parseCv(allLines: PdfLine[]): ParsedCv {
  const warnings: string[] = []
  const lines = allLines.filter((line) => !isSeparator(line))
  const bodySize = mostCommon(lines.map(({ size }) => size))
  const cv: UserData = {
    firstname: missingValue,
    name: missingValue,
    title: '',
    bio: '',
    expertise: [],
    methodologies: [],
    trainer: [],
    certifications: [],
    experiences: [],
    education: [],
    languages: [],
  }

  const sections: Record<SectionKind | 'intro', PdfLine[]> = {
    intro: [],
    experiences: [],
    education: [],
    languages: [],
  }
  let current: SectionKind | 'intro' = 'intro'
  for (const line of lines) {
    const kind = sectionOf(line, bodySize)
    if (kind) current = kind
    else sections[current].push(line)
  }

  const [nameLine, ...intro] = sections.intro
  if (nameLine) Object.assign(cv, parseName(nameLine.text, warnings))
  const titleEnd = intro.findIndex((line) => line.size <= bodySize)
  const titleLines = titleEnd < 0 ? intro : intro.slice(0, titleEnd)
  cv.title = clean(titleLines.map(({ text }) => text).join(' '))
  const rest = intro.slice(titleLines.length)

  const headerIndex = rest.findIndex((line) => skillKindOf(line.text))
  if (headerIndex < 0) {
    warnings.push('Bloc des compétences introuvable.')
    cv.bio = parseBio(rest)
  } else {
    const headerLine = rest[headerIndex]!
    const header = rest.filter(
      (line) => line.page === headerLine.page && Math.abs(line.y - headerLine.y) < 2,
    )
    cv.bio = parseBio(rest.filter((line) => position(line) < position(headerLine) - 2))
    parseSkills(
      header,
      rest.filter((line) => position(line) > position(headerLine) + 2),
      cv,
      warnings,
    )
  }

  if (!sections.experiences.length) warnings.push('Section « Expériences » introuvable.')
  cv.experiences = parseExperiences(sections.experiences, bodySize, warnings)
  if (!sections.education.length) warnings.push('Section « Formation » introuvable.')
  cv.education = parseEducation(sections.education)
  if (!sections.languages.length) warnings.push('Section « Langues » introuvable.')
  cv.languages = parseLanguages(sections.languages)

  return { cv, warnings }
}
