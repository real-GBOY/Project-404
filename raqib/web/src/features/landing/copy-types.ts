/** One table row of copy: a fixed-order list of strings (the section that renders it names each position). */
export type Row = readonly string[];

export interface ChainStep {
  step: string;
  title: string;
  ref: string;
  /** [text, meta, tone] */
  lines: readonly Row[];
}

/** Every string on the landing page, in one language. Arabic and English share this shape, so neither can fall behind. */
export interface Copy {
  brand: string;
  brandSub: string;
  menu: string;
  nav: readonly string[];
  tryDemo: string;
  signIn: string;
  explore: string;
  eyebrow: string;
  h1: string;
  heroSub: string;
  heroMeta: string;
  m: {
    inProgress: string;
    site: string;
    section: string;
    score: string;
    item: string;
    weight: string;
    c: string;
    nc: string;
    na: string;
    note: string;
    capture: string;
    after: string;
    stages: readonly string[];
    caption: string;
  };
  probEyebrow: string;
  probTitle: string;
  probBody: string;
  problems: readonly Row[];
  howEyebrow: string;
  howTitle: string;
  /** [title, description] */
  steps: readonly Row[];
  assigned: string;
  stepSample: Row;
  s3x: string;
  s4a: string;
  s4b: string;
  tourEyebrow: string;
  tourTitle: string;
  tourNote: string;
  /** [shot, tab label, phone|desk, title, body, who, url] */
  tour: readonly Row[];
  capEyebrow: string;
  capTitle: string;
  aT: string;
  aD: string;
  aPoints: readonly string[];
  aForm: string;
  aNewV: string;
  aLock: string;
  /** [version, note, uses, status, tone] */
  versions: readonly Row[];
  bT: string;
  bD: string;
  /** [day, month, site, ref, shift, status, tone] */
  visits: readonly Row[];
  cT: string;
  cD: string;
  cItem: string;
  cMeta: string;
  /** [kind, file, status, tone] */
  evidence: readonly Row[];
  dT: string;
  dD: string;
  dDoc: string;
  clientLogo: string;
  reportKv: readonly Row[];
  /** [no, text, result, tone] */
  reportRows: readonly Row[];
  /** [role, name] */
  signs: readonly Row[];
  eT: string;
  eD: string;
  eRole: string;
  permCols: readonly string[];
  /** [role, bits] */
  permRows: readonly Row[];
  eNote: string;
  rolesEyebrow: string;
  rolesTitle: string;
  rolesBody: string;
  /** [role, does, devices] */
  roles: readonly Row[];
  recEyebrow: string;
  recTitle: string;
  recBody: string;
  chain: readonly ChainStep[];
  caT: string;
  caSub: string;
  caSteps: readonly string[];
  langEyebrow: string;
  langTitle: string;
  langBody: string;
  langPoints: readonly string[];
  ctaTitle: string;
  ctaBody: string;
  ctaMeta: string;
  footDesc: string;
  footNav: string;
  byAuric: string;
}
