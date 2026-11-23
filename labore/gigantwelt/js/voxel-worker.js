// Gigant-Welt: Worker für Voxel-Erzeugung und Meshing (Aufträge siehe runJob in voxel-kern.js).
import { heightAt, forestAt, ss, gn } from './welt.js';
import { createKern, runJob } from './voxel-kern.js';
const kern = createKern({ heightAt, forestAt, ss, gn });
self.onmessage = e => { const { res, tr } = runJob(kern, e.data); self.postMessage(res, tr); };
