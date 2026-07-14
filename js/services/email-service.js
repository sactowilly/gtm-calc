export function buildMailtoUrl({ recipient = '', subject, body }) {
  return `mailto:${recipient ? encodeURIComponent(recipient) : ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildAttachmentInstruction(filename) {
  return `Please attach the downloaded PDF: ${filename}`;
}
