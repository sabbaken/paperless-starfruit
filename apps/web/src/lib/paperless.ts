/** Deep link to a document's detail page in the connected paperless-ngx UI. */
export function paperlessDocumentUrl(baseUrl: string, documentId: number): string {
  return `${baseUrl.replace(/\/+$/, '')}/documents/${documentId}`;
}
