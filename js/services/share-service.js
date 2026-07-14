export function createPdfFile(blob, filename) {
  return new File([blob], filename, { type: 'application/pdf' });
}

export function canSharePdf(navigatorObject, file) {
  if (typeof navigatorObject?.share !== 'function' || typeof navigatorObject?.canShare !== 'function') {
    return false;
  }

  try {
    return navigatorObject.canShare({ files: [file] });
  } catch (error) {
    return false;
  }
}

export async function sharePdf(navigatorObject, file, customerName) {
  if (!canSharePdf(navigatorObject, file)) {
    return { status: 'unsupported' };
  }

  try {
    await navigatorObject.share({
      files: [file],
      title: 'Vision Packaging Quote',
      text: customerName ? `Quotation for ${customerName}` : 'Vision Packaging quotation'
    });
    return { status: 'shared' };
  } catch (error) {
    return { status: error?.name === 'AbortError' ? 'cancelled' : 'failed' };
  }
}
