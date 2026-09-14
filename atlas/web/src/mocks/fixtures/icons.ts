// Extracted verbatim from the design prototype's `ICONS` class field.
// Each value is an SVG path `d` attribute drawn on a 16x16 viewBox.

export interface IconFixtureMap {
  check: string;
  clock: string;
  alert: string;
  lead: string;
  spark: string;
  unit: string;
  customer: string;
  project: string;
  doc: string;
  payment: string;
}

export const ICONS: IconFixtureMap = {
  check: 'M3.5 8.4l3 3 6-6.6',
  clock: 'M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z M8 5.3v3l2.2 1.3',
  alert: 'M8 3.2v5.4 M8 11.5h.01',
  lead: 'M8 2.6 13.4 8 8 13.4 2.6 8Z',
  spark: 'M8 2.2 9.3 6 13 7.3 9.3 8.6 8 12.3 6.7 8.6 3 7.3 6.7 6Z',
  unit: 'M3.4 3.4h9.2v9.2H3.4Z M8 3.4v9.2 M3.4 8h9.2',
  customer: 'M8 3.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z M3.6 13c0-2.2 2-3.4 4.4-3.4S12.4 10.8 12.4 13',
  project: 'M3.4 13V3.4h5V13 M8.4 13V6.6h4.2V13 M5.4 6h1 M5.4 9h1 M10 9h1',
  doc: 'M4.2 2.6h4.6l3 3v7.8H4.2Z M8.8 2.6v3h3',
  payment: 'M2.4 4.6h11.2v6.8H2.4Z M2.4 7.2h11.2',
};
