import { describe, expect, it } from 'vitest'
import { cvSchema } from '../../shared/cv.ts'
import { parseCv } from '../import/parseCv.ts'
import type { PdfLine } from '../import/pdfLines.ts'

const line = (page: number, x: number, y: number, size: number, text: string, width?: number) =>
  ({ page, x, y, size, text, width: width ?? text.length * size * 0.5 }) satisfies PdfLine

const header = [
  line(1, 23, 45, 24, 'Marie-Anne LE GALL'),
  line(1, 23, 70, 16, 'Consultante DevOps'),
  line(1, 26, 110, 11, 'Passionnée par'),
  line(1, 26, 124, 11, "l'automatisation."),
  line(1, 314, 110, 11, 'Elle accompagne les équipes.'),
  line(1, 26, 200, 11, 'Expertises'),
  line(1, 230, 200, 11, 'Certifications'),
  line(1, 398, 200, 11, 'Formateur & Speaker'),
  line(1, 26, 230, 11, 'CI/CD: Expert'),
  line(1, 230, 230, 11, 'Certified Kubernetes', 115),
  line(1, 398, 230, 11, 'Formatrice Docker'),
  line(1, 26, 245, 11, 'Jenkins: :Avancé'),
  line(1, 230, 245, 11, 'Administrator', 70),
  line(1, 398, 245, 11, 'Speaker Devoxx 2025'),
  line(1, 26, 260, 11, 'Confluence :'),
  line(1, 230, 260, 11, 'AWS Associate', 75),
  line(1, 26, 275, 11, 'Intermédiaire'),
  line(1, 230, 275, 11, '(expirée)', 50),
]

const experiences = [
  line(1, 57, 400, 22, 'DERNIÈRES'),
  line(1, 194, 405, 12, '________________'),
  line(1, 32, 425, 22, 'EXPÉRIENCES'),
  line(1, 194, 460, 11, 'Tech lead'),
  line(1, 120, 478, 14, 'Société A'),
  line(1, 194, 477, 11, 'En régie pour Zenika Lyon (depuis'),
  line(1, 194, 494, 11, 'Mars 2024)'),
  line(1, 30, 497, 14, '(via Partenaire)'),
  line(1, 194, 530, 11, 'Refonte du système de facturation.'),
  line(1, 194, 545, 11, 'Missions :'),
  line(1, 203, 562, 11, '- Migration vers Kubernetes'),
  line(1, 203, 579, 11, '- Revue de code et accompagnement des'),
  line(1, 221, 596, 11, 'développeurs'),
  line(1, 194, 630, 11, 'Environnement technique : Kubernetes, Helm,'),
  line(1, 194, 647, 11, 'Terraform'),
  line(1, 120, 700, 14, 'Société B'),
  line(1, 194, 698, 12, 'Développeuse (2020 - 2022)'),
  line(2, 203, 40, 11, '● Création d’une bibliothèque'),
  line(2, 239, 57, 11, '○ Conception dans Figma'),
  line(2, 275, 74, 11, '■ Atelier avec les designers'),
  line(2, 239, 91, 11, '○ Documentation'),
  line(2, 203, 108, 11, '● Revue de code'),
  line(2, 194, 140, 11, 'Produit “Alpha” : outil de planification.'),
  line(2, 203, 157, 11, '● Tests via Cypress'),
  line(2, 194, 190, 11, 'Environnement technique : Vue.js, Cypress'),
  line(2, 194, 225, 11, 'Produit “Beta” : portail client.'),
  line(2, 194, 260, 11, 'Environnement technique : Java'),
  line(2, 194, 300, 12, 'Responsable d’application (2015-2020)'),
  line(2, 194, 335, 11, 'Suivi des incidents.'),
]

const footer = [
  line(2, 48, 400, 22, 'FORMATION'),
  line(2, 194, 420, 11, '2016–2018 Master Informatique (Génie Logiciel), Université de'),
  line(2, 194, 437, 11, 'Nantes.'),
  line(2, 194, 454, 11, '2014 IUT de Nantes - DUT Informatique'),
  line(2, 194, 471, 11, 'Diplôme d’ingénieur - 2012'),
  line(2, 74, 500, 22, 'LANGUES'),
  line(2, 194, 520, 11, 'Français (langue maternelle), Anglais (C1 - professionnel)'),
  line(2, 194, 537, 11, 'Espagnol'),
]

const { cv, warnings } = parseCv([...header, ...experiences, ...footer])

describe('parseCv', () => {
  it('produces a valid CV', () => {
    expect(cvSchema.safeParse(cv).success).toBe(true)
    expect(warnings).toEqual([])
  })

  it('reads the name, title and bio', () => {
    expect(cv).toMatchObject({
      firstname: 'Marie-Anne',
      name: 'Le Gall',
      title: 'Consultante DevOps',
      bio: "Passionnée par l'automatisation.\n\nElle accompagne les équipes.",
    })
  })

  it('reads the skill columns, joining wrapped entries', () => {
    expect(cv.expertise).toEqual([
      { name: 'CI/CD', level: 'Expert' },
      { name: 'Jenkins', level: 'Avancé' },
      { name: 'Confluence', level: 'Intermédiaire' },
    ])
    expect(cv.certifications).toEqual([
      'Certified Kubernetes Administrator',
      'AWS Associate (expirée)',
    ])
    expect(cv.trainer).toEqual(['Formatrice Docker', 'Speaker Devoxx 2025'])
    expect(cv.methodologies).toEqual([])
  })

  it('splits bulleted skill columns on bullets only', () => {
    const { cv } = parseCv([
      line(1, 23, 45, 24, 'Paul DURAND'),
      line(1, 26, 200, 11, 'Methodologies'),
      line(1, 26, 230, 11, '► Scrum'),
      line(1, 26, 245, 11, '► Behavior Driven'),
      line(1, 26, 260, 11, 'Development'),
    ])
    expect(cv.methodologies).toEqual(['Scrum', 'Behavior Driven Development'])
  })

  it('reads the experience header: company, position, period and mission', () => {
    expect(cv.experiences[0]).toMatchObject({
      name: 'Société A (via Partenaire)',
      position: 'Tech lead',
      period: 'depuis Mars 2024',
      team: 'En régie pour Zenika Lyon',
    })
    expect(cv.experiences[1]).toMatchObject({
      name: 'Société B',
      position: 'Développeuse',
      period: '2020 - 2022',
    })
  })

  it('reads the context, the titled lists and the technical environment', () => {
    expect(cv.experiences[0]).toMatchObject({
      context: 'Refonte du système de facturation.',
      realisations: [
        {
          title: 'Missions',
          type: 'list',
          description: [
            'Migration vers Kubernetes',
            'Revue de code et accompagnement des développeurs',
          ],
        },
      ],
      technicalEnvironment: [
        { name: 'Environnement technique', value: 'Kubernetes, Helm, Terraform' },
      ],
    })
  })

  it('turns nested bullets into titled lists and folds the third level', () => {
    expect(cv.experiences[1]!.realisations).toEqual([
      {
        title: 'Création d’une bibliothèque',
        type: 'list',
        description: ['Conception dans Figma : Atelier avec les designers', 'Documentation'],
      },
      { type: 'list', description: ['Revue de code'] },
      { title: 'Produit “Alpha”', type: 'text', description: 'outil de planification.' },
      { type: 'list', description: ['Tests via Cypress'] },
      { title: 'Produit “Beta”', type: 'text', description: 'portail client.' },
    ])
    expect(cv.experiences[1]!.technicalEnvironment).toEqual([
      { name: 'Environnement technique (Produit “Alpha”)', value: 'Vue.js, Cypress' },
      { name: 'Environnement technique (Produit “Beta”)', value: 'Java' },
    ])
  })

  it('stores an untitled paragraph as a one-item list, like the experience form', () => {
    const { cv } = parseCv([
      line(1, 23, 45, 24, 'Paul DURAND'),
      line(1, 32, 400, 22, 'EXPÉRIENCES'),
      line(1, 120, 440, 14, 'Société C'),
      line(1, 194, 440, 11, 'Architecte (2013 - 2014)'),
      line(1, 194, 480, 11, 'Sous-projets :'),
      line(1, 239, 497, 11, 'o la migration des données'),
      line(1, 194, 530, 11, 'Ces objectifs sont remplis par un ETL.'),
    ])
    expect(cv.experiences[0]!.realisations).toEqual([
      { title: 'Sous-projets', type: 'list', description: ['la migration des données'] },
      { type: 'list', description: ['Ces objectifs sont remplis par un ETL.'] },
    ])
  })

  it('starts a new experience at the same company for another dated position', () => {
    expect(cv.experiences).toHaveLength(3)
    expect(cv.experiences[2]).toEqual({
      name: 'Société B',
      position: 'Responsable d’application',
      period: '2015-2020',
      context: 'Suivi des incidents.',
      realisations: [],
      technicalEnvironment: [],
    })
  })

  it('reads the education and the languages', () => {
    expect(cv.education).toEqual([
      {
        period: '2016–2018',
        title: 'Master Informatique (Génie Logiciel)',
        school: 'Université de Nantes',
      },
      { period: '2014', title: 'DUT Informatique', school: 'IUT de Nantes' },
      { period: '2012', title: 'Diplôme d’ingénieur', school: '' },
    ])
    expect(cv.languages).toEqual([
      { name: 'Français', level: 'langue maternelle' },
      { name: 'Anglais', level: 'C1 - professionnel' },
      { name: 'Espagnol', level: '' },
    ])
  })

  it('warns about what it could not find', () => {
    const { cv, warnings } = parseCv([line(1, 23, 45, 24, 'JD'), line(1, 26, 110, 11, 'Bio.')])
    expect(cv).toMatchObject({ firstname: 'JD', name: 'À compléter', bio: 'Bio.' })
    expect(cvSchema.safeParse(cv).success).toBe(true)
    expect(warnings).toEqual([
      "Le nom « JD » n'a pas pu être séparé du prénom.",
      'Bloc des compétences introuvable.',
      'Section « Expériences » introuvable.',
      'Section « Formation » introuvable.',
      'Section « Langues » introuvable.',
    ])
  })
})
