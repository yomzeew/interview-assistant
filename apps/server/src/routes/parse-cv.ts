/**
 * POST /api/parse-cv
 * Accepts PDF, DOCX, or TXT and returns extracted plain text.
 *
 * Requires these packages in apps/server:
 *   npm install multer pdf-parse mammoth --workspace=apps/server
 *   npm install -D @types/multer @types/pdf-parse --workspace=apps/server
 */
import { Router, type Request, type Response } from 'express';
import { createRequire } from 'module';
import { logger } from '../utils/logger.js';

export const parseCvRouter = Router();

// Use createRequire so CJS packages (multer, pdf-parse) load correctly from ESM
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let multer: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let upload: any;

try {
  multer = require('multer');
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req: Request, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
      const ok = /\.(pdf|txt|docx?)$/i.test(file.originalname);
      cb(ok ? null : new Error('Only PDF, TXT, DOC, DOCX files are supported'), ok);
    },
  });
} catch {
  logger.warn('multer not installed — CV upload disabled. Run: npm install --workspace=apps/server');
}

parseCvRouter.post('/', (req: Request, res: Response) => {
  if (!upload) {
    res.status(500).json({
      error: 'CV parsing unavailable. Run: npm install --workspace=apps/server  then restart the server.',
    });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  upload.single('cv')(req, res, async (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file: Express.Multer.File | undefined = (req as any).file;
    if (!file) {
      res.status(400).json({ error: 'No file received. Make sure the field name is "cv".' });
      return;
    }

    const { mimetype, originalname, buffer } = file;
    logger.info({ filename: originalname, bytes: buffer.length, mimetype }, 'Parsing CV');

    try {
      let text = '';

      // ── Plain text ────────────────────────────────────────────────────────
      if (/\.txt$/i.test(originalname) || mimetype === 'text/plain') {
        text = buffer.toString('utf-8');
      }

      // ── PDF ───────────────────────────────────────────────────────────────
      else if (/\.pdf$/i.test(originalname) || mimetype === 'application/pdf') {
        // Use createRequire — pdf-parse is CJS and doesn't support ESM import well
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');
        const result = await pdfParse(buffer);
        text = result.text;
      }

      // ── DOCX ──────────────────────────────────────────────────────────────
      else if (/\.docx$/i.test(originalname) ||
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      }

      // ── DOC (legacy binary) — best effort ─────────────────────────────────
      else {
        text = buffer.toString('utf-8')
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Normalise whitespace
      text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

      if (!text) {
        res.status(422).json({
          error: 'No text could be extracted. Try saving as .txt and uploading that instead.',
        });
        return;
      }

      logger.info({ chars: text.length }, 'CV parsed OK');
      res.json({ text, chars: text.length });

    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      logger.error({ err: parseErr, filename: originalname }, 'CV parse error');

      if (msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND')) {
        res.status(500).json({
          error: `Missing package. Run: npm install --workspace=apps/server   (detail: ${msg})`,
        });
      } else {
        res.status(500).json({
          error: `Parse failed: ${msg}. If the PDF is scanned/image-only, save as .txt first.`,
        });
      }
    }
  });
});
