/**
 * tagging/sdg-metadata.js
 *
 * Canonical reference for all 17 UN Sustainable Development Goals.
 *
 * Each entry contains:
 *   number        {number}   1–17
 *   name          {string}   Official UN name
 *   slug          {string}   Lowercase, no spaces/punctuation — used for
 *                            hashtag variant generation
 *   abbreviations {string[]} Common shorthand slugs (also used for hashtag
 *                            variant generation). All lowercase, no separators.
 *
 * NOTE: Do not change slugs or abbreviations without updating engine.js tests —
 * they feed the programmatic hashtag variant builder in engine.js.
 */

export const SDG_METADATA = [
  {
    number: 1,
    name: 'No Poverty',
    slug: 'nopoverty',
    abbreviations: ['nopoverty', 'endpoverty'],
  },
  {
    number: 2,
    name: 'Zero Hunger',
    slug: 'zerohunger',
    abbreviations: ['zerohunger', 'endhunger'],
  },
  {
    number: 3,
    name: 'Good Health and Well-Being',
    slug: 'goodhealthandwellbeing',
    abbreviations: ['goodhealth', 'goodhealthwellbeing', 'healthforall'],
  },
  {
    number: 4,
    name: 'Quality Education',
    slug: 'qualityeducation',
    abbreviations: ['qualityeducation', 'educationforall'],
  },
  {
    number: 5,
    name: 'Gender Equality',
    slug: 'genderequality',
    abbreviations: ['genderequality', 'womenempowerment', 'empowerwomen', 'heforshe'],
  },
  {
    number: 6,
    name: 'Clean Water and Sanitation',
    slug: 'cleanwaterandsanitation',
    abbreviations: ['cleanwater', 'cleanwaterandsanitation', 'waterandsanitation'],
  },
  {
    number: 7,
    name: 'Affordable and Clean Energy',
    slug: 'affordableandcleanenergy',
    abbreviations: ['cleanenergy', 'affordablecleanenergy', 'renewableenergy'],
  },
  {
    number: 8,
    name: 'Decent Work and Economic Growth',
    slug: 'decentworkandeconomicgrowth',
    abbreviations: ['decentwork', 'economicgrowth', 'decentworkandgrowth'],
  },
  {
    number: 9,
    name: 'Industry, Innovation and Infrastructure',
    slug: 'industryinnovationandinfrastructure',
    abbreviations: ['innovation', 'infrastructure', 'industryinnovation'],
  },
  {
    number: 10,
    name: 'Reduced Inequalities',
    slug: 'reducedinequalities',
    abbreviations: ['reducedinequality', 'reducedinequalities', 'inequalityreduction'],
  },
  {
    number: 11,
    name: 'Sustainable Cities and Communities',
    slug: 'sustainablecitiesandcommunities',
    abbreviations: ['sustainablecities', 'sustainablecommunities', 'sustainableurban'],
  },
  {
    number: 12,
    name: 'Responsible Consumption and Production',
    slug: 'responsibleconsumptionandproduction',
    abbreviations: [
      'responsibleconsumption',
      'sustainableproduction',
      'sustainableconsumption',
    ],
  },
  {
    number: 13,
    name: 'Climate Action',
    slug: 'climateaction',
    abbreviations: ['climateaction', 'climatechange', 'actonclimate', 'globalwarming'],
  },
  {
    number: 14,
    name: 'Life Below Water',
    slug: 'lifebelowwater',
    abbreviations: ['lifebelowwater', 'oceanlife', 'saveourocean', 'oceansday', 'worldoceansday'],
  },
  {
    number: 15,
    name: 'Life on Land',
    slug: 'lifeonland',
    abbreviations: ['lifeonland', 'biodiversity', 'forests', 'deforestation', 'protectourplanet'],
  },
  {
    number: 16,
    name: 'Peace, Justice and Strong Institutions',
    slug: 'peacejusticeandstronginstitutions',
    abbreviations: ['peaceandjustice', 'stronginstitutions', 'peacejustice', 'humanrights', 'accesstojustice'],
  },
  {
    number: 17,
    name: 'Partnerships for the Goals',
    slug: 'partnershipsforthegoals',
    abbreviations: [
      'globalpartnerships',
      'partnershipsforthegoals',
      'globalgoals',
    ],
  },
]

export default SDG_METADATA
