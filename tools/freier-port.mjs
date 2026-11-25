// Freien TCP-Port finden (das Betriebssystem vergibt ihn) – damit parallele Bild-/Smoke-Läufe (mehrere Agents) nicht
// denselben Port nehmen und Bilder aus einem fremden Ordner bekommen.
import net from 'node:net';

export function freierPort() {
  return new Promise((ok, fehler) => {
    const s = net.createServer();
    s.unref();
    s.on('error', fehler);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
  });
}
