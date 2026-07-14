import { describe, expect, it, vi } from 'vitest';
import { buildAttachmentInstruction, buildMailtoUrl } from '../js/services/email-service.js';
import { canSharePdf, sharePdf } from '../js/services/share-service.js';

const file = { name: 'quote.pdf', type: 'application/pdf' };

describe('PDF sharing', () => {
  it('detects missing and rejected file sharing', () => {
    expect(canSharePdf({}, file)).toBe(false);
    expect(canSharePdf({ share() {}, canShare: () => false }, file)).toBe(false);
    expect(canSharePdf({ share() {}, canShare: () => { throw new Error('no'); } }, file)).toBe(false);
  });

  it('shares the PDF file when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await expect(sharePdf({ canShare: () => true, share }, file, 'Acme')).resolves.toEqual({ status: 'shared' });
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [file] }));
  });

  it('distinguishes cancellation from failure', async () => {
    const navigatorObject = (error) => ({ canShare: () => true, share: vi.fn().mockRejectedValue(error) });
    await expect(sharePdf(navigatorObject({ name: 'AbortError' }), file)).resolves.toEqual({ status: 'cancelled' });
    await expect(sharePdf(navigatorObject(new Error('failed')), file)).resolves.toEqual({ status: 'failed' });
  });
});

describe('email fallback', () => {
  it('encodes recipient, subject, and customer-safe body', () => {
    const url = buildMailtoUrl({ recipient: 'buyer@example.test', subject: 'Your Quote', body: 'Attach quote.pdf' });
    expect(url).toBe('mailto:buyer%40example.test?subject=Your%20Quote&body=Attach%20quote.pdf');
  });

  it('names the exact downloaded attachment', () => {
    expect(buildAttachmentInstruction('2026-acme-quotation.pdf')).toContain('2026-acme-quotation.pdf');
  });
});
