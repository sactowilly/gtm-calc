import { toCustomerQuoteDocument } from './customer-quote-document.js';
import { createQuotePrintPages } from './quote-template.js';

const logoUrl = new URL('../../assets/vision-industrial-packaging-logo.png', import.meta.url).href;

function getPdfDependencies() {
  const html2canvas = window.html2canvas;
  const JsPdf = window.jspdf?.jsPDF;

  if (typeof html2canvas !== 'function' || typeof JsPdf !== 'function') {
    throw new Error('The local PDF rendering libraries did not load.');
  }

  return { html2canvas, JsPdf };
}

export async function buildCustomerQuotePdfBlob(quote) {
  const documentData = toCustomerQuoteDocument(quote);
  const { html2canvas, JsPdf } = getPdfDependencies();
  const rendered = await createQuotePrintPages(documentData, logoUrl);

  try {
    const pdf = new JsPdf({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter',
      compress: false,
      putOnlyUsedFonts: true
    });

    for (let index = 0; index < rendered.pages.length; index += 1) {
      const page = rendered.pages[index];
      const canvas = await html2canvas(page, {
        backgroundColor: '#ffffff',
        logging: false,
        scale: 2,
        useCORS: false,
        width: 816,
        height: 1056,
        windowWidth: 816,
        windowHeight: 1056
      });

      if (index > 0) {
        pdf.addPage('letter', 'portrait');
      }

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 612, 792);
    }

    return pdf.output('blob');
  } finally {
    rendered.dispose();
  }
}
