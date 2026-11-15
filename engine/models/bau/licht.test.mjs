import test from 'node:test';
import { createLaterne, createFackel, createLagerfeuer } from './licht.js';
import { pruefeAsset, pruefeDeterminismus } from './bau-pruefung.mjs';

test('Laterne: leucht + licht-Anker', () => {
  pruefeAsset(createLaterne(), { budget: 120, leucht: true, anker: ['licht'] });
  pruefeDeterminismus(createLaterne);
});
test('Fackel: leucht + licht-Anker', () => {
  pruefeAsset(createFackel(), { budget: 60, leucht: true, anker: ['licht'] });
  pruefeDeterminismus(createFackel);
});
test('Lagerfeuer: Steinring, Flammen leucht', () => {
  pruefeAsset(createLagerfeuer(), { budget: 200, leucht: true, anker: ['licht'] });
  pruefeDeterminismus(createLagerfeuer);
});
