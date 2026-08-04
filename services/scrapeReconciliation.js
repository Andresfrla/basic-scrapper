import { scrapeCep } from "../proxy-server/scraper/client.js";
import { createRow, listRows, updateRow } from "./sheetRowsRepo.js";

const GROUP_DELAY_MS = 2000;
const STALE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2h, igual que el cron de border-flow

function groupKey(row) {
  const pedimento = row.values.pedimento?.trim() ?? "";
  const aduana = row.values.aduana?.trim() ?? "";
  const anio = row.values.anio?.trim() ?? "";
  const patente = row.values.patente?.trim() ?? "";
  if (!pedimento || !aduana || !anio || !patente) return null;
  return `${pedimento}|${aduana}|${anio}|${patente}`;
}

function toScrapePatch(resultado) {
  return {
    values: {
      status: resultado.estado,
      fechaCruce: resultado.fecha,
      patente: resultado.detalle.patente,
      aduana: resultado.detalle.aduana,
      anio: resultado.detalle.anio,
    },
    detalle: resultado.detalle,
    markScraped: true,
  };
}

function statusChangeFor(row, newStatus) {
  const previousStatus = row.values.status ?? "";
  return newStatus && newStatus !== previousStatus ? { previousStatus, newStatus } : undefined;
}

function isGroupResolvedAndFresh(groupRows) {
  return groupRows.every((row) => {
    if (!row.detalle) return false;
    if (!row.lastScrapedAt) return false;
    return Date.now() - row.lastScrapedAt < STALE_WINDOW_MS;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Agrupa las filas por Pedimento+Aduana+Año+Patente, consulta el SAT una vez
 * por grupo, hace match de cada resultado contra la Secuencia que puso el
 * usuario, y crea filas nuevas para las secuencias que el SAT trae de más.
 * Usado tanto por el cron (onlyStaleOrOpen=true) como por "Actualizar todo"
 * (onlyStaleOrOpen=false, fuerza refresco de todo).
 */
export async function runScrapeAll({ onlyStaleOrOpen = false } = {}) {
  const rows = await listRows();
  const groups = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let processed = 0;
  let scraped = 0;
  let skipped = 0;
  const errors = [];
  const updatedRows = [];
  const createdRows = [];

  let isFirstGroup = true;
  for (const groupRows of groups.values()) {
    if (onlyStaleOrOpen && isGroupResolvedAndFresh(groupRows)) {
      skipped += 1;
      continue;
    }

    if (!isFirstGroup) await sleep(GROUP_DELAY_MS);
    isFirstGroup = false;
    processed += 1;

    const first = groupRows[0];
    try {
      const results = await scrapeCep({
        metodo: "pedimento",
        valor: first.values.pedimento.trim(),
        aduana: first.values.aduana.trim(),
        anio: first.values.anio.trim(),
        patente: first.values.patente.trim(),
      });

      if (results.length === 0) {
        for (const row of groupRows) {
          const updated = await updateRow(row.id, {
            scrapeError: "No encontrado",
            markScraped: true,
          });
          updatedRows.push(updated);
        }
        continue;
      }

      const remaining = [...results];
      const rowsWithoutSecuencia = [];

      for (const row of groupRows) {
        const secuencia = row.values.secuencia?.trim() ?? "";
        if (!secuencia) {
          rowsWithoutSecuencia.push(row);
          continue;
        }
        const matchIndex = remaining.findIndex((r) => r.secuencia === secuencia);
        if (matchIndex === -1) {
          const updated = await updateRow(row.id, {
            scrapeError: `La secuencia "${secuencia}" no existe en el SAT para este pedimento`,
          });
          updatedRows.push(updated);
          continue;
        }
        const [match] = remaining.splice(matchIndex, 1);
        const updated = await updateRow(row.id, {
          ...toScrapePatch(match),
          scrapeError: null,
        }, { statusChange: statusChangeFor(row, match.estado) });
        updatedRows.push(updated);
        scraped += 1;
      }

      for (const row of rowsWithoutSecuencia) {
        const match = remaining.shift();
        if (!match) {
          const updated = await updateRow(row.id, {
            scrapeError: "No hay más secuencias disponibles en el SAT para esta fila",
          });
          updatedRows.push(updated);
          continue;
        }
        const patch = toScrapePatch(match);
        const updated = await updateRow(row.id, {
          ...patch,
          values: { ...patch.values, secuencia: match.secuencia },
          scrapeError: null,
        }, { statusChange: statusChangeFor(row, match.estado) });
        updatedRows.push(updated);
        scraped += 1;
      }

      for (const match of remaining) {
        const patch = toScrapePatch(match);
        const created = await createRow({
          values: {
            ...first.values,
            referencia: "",
            caja: "",
            secuencia: match.secuencia,
            ...patch.values,
          },
          detalle: match.detalle,
          addedFromScrape: true,
        });
        createdRows.push(created);
        scraped += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      errors.push({ pedimento: first.values.pedimento, message });
      for (const row of groupRows) {
        const updated = await updateRow(row.id, { scrapeError: message });
        updatedRows.push(updated);
      }
    }
  }

  return { processed, scraped, skipped, errors, updatedRows, createdRows };
}
