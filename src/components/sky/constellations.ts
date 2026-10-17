// Fifteen constellations, one featured per night in rotation. Stars sit in a unit
// box in their real relative positions (north up), with their real brightness as
// magnitude (smaller is brighter). Lines join star indexes into the usual figure.

export type Constellation = {
  name: string;
  stars: [x: number, y: number, mag: number][];
  lines: [number, number][];
};

export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'Orion',
    stars: [
      [0.26, 0.2, 0.5], // Betelgeuse
      [0.68, 0.25, 1.6], // Bellatrix
      [0.4, 0.52, 1.7], // Alnitak
      [0.5, 0.5, 1.7], // Alnilam
      [0.6, 0.47, 2.2], // Mintaka
      [0.34, 0.86, 2.1], // Saiph
      [0.76, 0.82, 0.1], // Rigel
      [0.48, 0.08, 3.4], // Meissa
    ],
    lines: [[7, 0], [7, 1], [0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
  },
  {
    name: 'Big Dipper',
    stars: [
      [0.84, 0.3, 1.8], // Dubhe
      [0.82, 0.56, 2.4], // Merak
      [0.6, 0.63, 2.4], // Phecda
      [0.56, 0.42, 3.3], // Megrez
      [0.4, 0.4, 1.8], // Alioth
      [0.25, 0.38, 2.2], // Mizar
      [0.06, 0.5, 1.9], // Alkaid
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  {
    name: 'Little Dipper',
    stars: [
      [0.1, 0.18, 2.0], // Polaris
      [0.25, 0.27, 4.4], // Yildun
      [0.38, 0.4, 4.2], // Epsilon
      [0.5, 0.55, 4.3], // Zeta
      [0.7, 0.6, 4.9], // Eta
      [0.76, 0.82, 3.0], // Pherkad
      [0.55, 0.84, 2.1], // Kochab
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    name: 'Cassiopeia',
    stars: [
      [0.05, 0.38, 2.3], // Caph
      [0.28, 0.7, 2.2], // Schedar
      [0.48, 0.44, 2.4], // Gamma
      [0.7, 0.68, 2.7], // Ruchbah
      [0.94, 0.4, 3.4], // Segin
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    name: 'Cygnus',
    stars: [
      [0.5, 0.06, 1.3], // Deneb
      [0.5, 0.42, 2.2], // Sadr
      [0.5, 0.68, 3.9], // Eta
      [0.5, 0.96, 3.1], // Albireo
      [0.16, 0.5, 2.5], // Gienah
      [0.84, 0.36, 2.9], // Delta
    ],
    lines: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]],
  },
  {
    name: 'Lyra',
    stars: [
      [0.3, 0.14, 0.0], // Vega
      [0.12, 0.26, 4.7], // Epsilon
      [0.45, 0.4, 4.4], // Zeta
      [0.7, 0.5, 4.3], // Delta
      [0.76, 0.86, 3.2], // Sulafat
      [0.44, 0.8, 3.5], // Sheliak
    ],
    lines: [[0, 1], [0, 2], [2, 3], [3, 4], [4, 5], [5, 2]],
  },
  {
    name: 'Aquila',
    stars: [
      [0.5, 0.46, 0.8], // Altair
      [0.4, 0.33, 2.7], // Tarazed
      [0.6, 0.58, 3.7], // Alshain
      [0.2, 0.18, 3.0], // Zeta
      [0.34, 0.66, 3.4], // Delta
      [0.72, 0.82, 3.2], // Theta
      [0.14, 0.86, 3.4], // Lambda
    ],
    lines: [[3, 1], [1, 0], [0, 2], [0, 4], [4, 6], [2, 5]],
  },
  {
    name: 'Scorpius',
    stars: [
      [0.16, 0.1, 2.6], // Acrab
      [0.2, 0.22, 2.3], // Dschubba
      [0.22, 0.34, 2.9], // Pi
      [0.32, 0.33, 2.9], // Sigma
      [0.38, 0.38, 1.0], // Antares
      [0.44, 0.46, 2.8], // Tau
      [0.5, 0.58, 2.3], // Epsilon
      [0.55, 0.7, 3.0], // Mu
      [0.58, 0.82, 3.6], // Zeta
      [0.64, 0.92, 3.3], // Eta
      [0.76, 0.96, 1.9], // Theta
      [0.86, 0.9, 3.0], // Iota
      [0.9, 0.8, 2.4], // Kappa
      [0.82, 0.74, 1.6], // Shaula
    ],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]],
  },
  {
    name: 'Sagittarius',
    stars: [
      [0.4, 0.76, 1.8], // Kaus Australis
      [0.38, 0.56, 2.7], // Kaus Media
      [0.42, 0.38, 2.8], // Kaus Borealis
      [0.7, 0.44, 2.0], // Nunki
      [0.66, 0.7, 2.6], // Ascella
      [0.84, 0.58, 3.3], // Tau
      [0.58, 0.52, 3.2], // Phi
      [0.16, 0.64, 3.0], // Alnasl
    ],
    lines: [[7, 1], [1, 0], [0, 7], [1, 2], [2, 6], [6, 3], [3, 5], [5, 4], [4, 0], [6, 4], [6, 1]],
  },
  {
    name: 'Leo',
    stars: [
      [0.76, 0.82, 1.4], // Regulus
      [0.73, 0.62, 3.5], // Eta
      [0.68, 0.46, 2.0], // Algieba
      [0.72, 0.32, 3.4], // Adhafera
      [0.8, 0.2, 3.9], // Rasalas
      [0.92, 0.27, 3.0], // Epsilon
      [0.08, 0.66, 2.1], // Denebola
      [0.36, 0.48, 2.6], // Zosma
      [0.36, 0.66, 3.3], // Chertan
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 7], [7, 6], [6, 8], [8, 0], [7, 8]],
  },
  {
    name: 'Gemini',
    stars: [
      [0.22, 0.12, 1.6], // Castor
      [0.42, 0.1, 1.1], // Pollux
      [0.3, 0.44, 3.0], // Mebsuta
      [0.36, 0.78, 2.9], // Tejat
      [0.24, 0.86, 3.3], // Propus
      [0.56, 0.44, 3.5], // Wasat
      [0.62, 0.62, 3.8], // Mekbuda
      [0.72, 0.86, 1.9], // Alhena
    ],
    lines: [[0, 1], [0, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7]],
  },
  {
    name: 'Taurus',
    stars: [
      [0.44, 0.46, 0.9], // Aldebaran
      [0.38, 0.36, 3.5], // Ain
      [0.52, 0.5, 3.6], // Gamma
      [0.1, 0.1, 1.7], // Elnath
      [0.16, 0.56, 3.0], // Zeta
      [0.8, 0.18, 2.9], // Pleiades
      [0.83, 0.2, 3.7],
      [0.78, 0.22, 3.9],
      [0.82, 0.15, 4.2],
      [0.85, 0.23, 4.3],
    ],
    lines: [[3, 1], [1, 2], [2, 0], [0, 4]],
  },
  {
    name: 'Canis Major',
    stars: [
      [0.4, 0.2, -1.5], // Sirius
      [0.18, 0.24, 2.0], // Mirzam
      [0.52, 0.1, 4.1], // Muliphein
      [0.56, 0.6, 1.8], // Wezen
      [0.44, 0.86, 1.5], // Adhara
      [0.82, 0.7, 2.4], // Aludra
      [0.28, 0.76, 3.0], // Furud
    ],
    lines: [[1, 0], [0, 2], [0, 3], [3, 4], [3, 5], [4, 6]],
  },
  {
    name: 'Pegasus',
    stars: [
      [0.7, 0.64, 2.5], // Markab
      [0.7, 0.26, 2.4], // Scheat
      [0.3, 0.26, 2.1], // Alpheratz
      [0.3, 0.64, 2.8], // Algenib
      [0.96, 0.86, 2.4], // Enif
      [0.84, 0.76, 3.4], // Homam
      [0.86, 0.1, 2.9], // Matar
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 5], [5, 4], [1, 6]],
  },
  {
    name: 'Andromeda',
    stars: [
      [0.86, 0.76, 2.1], // Alpheratz
      [0.66, 0.62, 3.3], // Delta
      [0.46, 0.5, 2.1], // Mirach
      [0.1, 0.3, 2.1], // Almach
      [0.48, 0.32, 3.9], // Mu
      [0.5, 0.18, 4.5], // Nu
      [0.53, 0.09, 4.6], // the Andromeda galaxy
    ],
    lines: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5]],
  },
];
