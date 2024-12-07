import { getString } from "../utils/locale";

class PdfNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfNotFoundError';
  }
}

export class SciDBManager {
  private static _instance: SciDBManager;
  private _defaultEndpoint = "https://sci-hub.ru/";

  private constructor() {
    // Private constructor to force singleton
  }

  public static getInstance(): SciDBManager {
    if (!SciDBManager._instance) {
      SciDBManager._instance = new SciDBManager();
    }
    return SciDBManager._instance;
  }

  public registerRightClickMenuItem() {
    const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "zotero-itemmenu-scidb-download",
      label: "Download from SciDB",
      commandListener: (ev) => this.downloadSelectedItems(),
      icon: menuIcon,
    });
  }

  private async downloadSelectedItems() {
    const items = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!items.length) {
      this.showProgressWindow("No items selected", "fail");
      return;
    }

    const progressWin = new ztoolkit.ProgressWindow("SciDB Download")
      .createLine({
        text: `Processing ${items.length} items...`,
        type: "default",
      })
      .show();

    // Process items sequentially to avoid rate limiting
    for (const item of items) {
      try {
        const doi = item.getField('DOI') as string;
        if (!doi) {
          progressWin.changeLine({
            text: `No DOI found for "${item.getField('title')}"`,
            type: "fail",
          });
          continue;
        }

        // Get endpoint from preferences
        const endpoint = (Zotero.Prefs.get(this._prefKey) as string) || this._defaultEndpoint;
        const initialUrl = new URL(doi, endpoint).href;

        await this.updateItem(initialUrl, item, progressWin);

      } catch (error: any) {
        if (error instanceof PdfNotFoundError) {
          progressWin.changeLine({
            text: `PDF not available for "${item.getField('title')}". Try again later.`,
            type: "fail",
          });
        } else {
          // Likely a captcha or other error
          const message = `Captcha may be required or PDF is not ready for "${item.getField('title')}". Opening in browser...`;
          progressWin.changeLine({
            text: message,
            type: "fail",
          });
          const currentDoi = item.getField('DOI') as string;
          const currentEndpoint = (Zotero.Prefs.get(this._prefKey) as string) || this._defaultEndpoint;
          Zotero.launchURL(new URL(currentDoi, currentEndpoint).href);
          break; // Stop processing remaining items
        }
      }
    }
  }

  private async updateItem(url: string, item: Zotero.Item, progressWin: any): Promise<void> {
    progressWin.changeLine({
      text: `Fetching PDF for "${item.getField('title')}"...`,
      type: "default",
    });

    // First request to get the HTML page
    const xhr = await Zotero.HTTP.request('GET', url, { 
      responseType: 'document',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1'
      }
    });

    if (xhr.status !== 200) {
      throw new Error(`Failed to fetch page: ${xhr.status}`);
    }

    // Check if we're on annas-archive and need to extract the sci-hub URL
    const iframe = xhr.responseXML?.querySelector('iframe');
    if (iframe) {
      const iframeSrc = iframe.getAttribute('src');
      if (iframeSrc) {
        Zotero.debug(`Found iframe source: ${iframeSrc}`);
        // Make a new request to the sci-hub URL
        return this.updateItem(iframeSrc, item, progressWin);
      }
    }

    // Find PDF URL in the response
    const pdfElement = xhr.responseXML?.querySelector('#pdf');
    let pdfUrl = pdfElement?.getAttribute('src');
    
    // Handle relative URLs
    if (pdfUrl && (!pdfUrl.startsWith('http') && !pdfUrl.startsWith('//'))) {
      const baseUrl = new URL(url).origin;
      pdfUrl = new URL(pdfUrl, baseUrl).href;
    }

    const body = xhr.responseXML?.querySelector('body');
    Zotero.debug("Response body:");
    Zotero.debug(body);

    // Check for empty response or error messages
    if (!pdfUrl || this.isPdfNotAvailable(body)) {
      // Try to find alternative download links
      const links = Array.from(xhr.responseXML?.querySelectorAll('a') || []);
      const downloadLinks = links.filter(link => {
        const href = link.getAttribute('href');
        if (!href) return false;
        
        // Look for PDF-related links or known paper repositories
        return (
          href.endsWith('.pdf') ||
          href.includes('/pdf/') ||
          href.includes('gateway') ||
          href.includes('sci-hub') ||
          href.includes('doi.org') ||
          href.includes('ipfs')
        );
      }).map(link => link.getAttribute('href')).filter(Boolean) as string[];

      if (downloadLinks.length > 0) {
        // Open the first alternative link in browser
        Zotero.launchURL(downloadLinks[0]);
        throw new Error("Opening alternative download link...");
      }

      throw new PdfNotFoundError(`PDF not available at ${url}`);
    }

    // Ensure HTTPS
    if (pdfUrl.startsWith('//')) {
      pdfUrl = 'https:' + pdfUrl;
    } else if (pdfUrl.startsWith('http:')) {
      pdfUrl = pdfUrl.replace('http:', 'https:');
    }

    // Download and attach the PDF
    await this.attachPdfToItem(pdfUrl, item);

    progressWin.changeLine({
      text: `Downloaded PDF for "${item.getField('title')}"`,
      type: "success",
    });
  }

  private isPdfNotAvailable(body: Element | null | undefined): boolean {
    if (!body) return true;
    
    const innerHTML = body.innerHTML;
    if (!innerHTML || innerHTML.trim() === '') return true;

    // Check for various error messages
    const errorPatterns = [
      /Please try to search again using DOI/im,
      /статья не найдена в базе/im,
      /article not found/i,
      /sci-hub has no access to this paper/i,
      /no paper with this doi/i,
      /not found in database/i
    ];

    return errorPatterns.some(pattern => pattern.test(innerHTML));
  }

  private async attachPdfToItem(pdfUrl: string, item: Zotero.Item): Promise<void> {
    const tmpDir = await Zotero.getTempDirectory();
    const tmpFileName = `scidb_${Date.now()}.pdf`;
    const tmpFile = tmpDir.path + '/' + tmpFileName;

    // Download PDF
    const response = await Zotero.HTTP.request('GET', pdfUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1'
      }
    });

    if (response.status !== 200) {
      throw new Error(`Failed to download PDF: ${response.status}`);
    }

    // Save PDF to temp file
    const buffer = new Uint8Array(response.response);
    await IOUtils.write(tmpFile, buffer);

    // Attach PDF to item
    await Zotero.Attachments.importFromFile({
      file: tmpFile,
      parentItemID: item.id,
      contentType: 'application/pdf',
      title: item.getField('title') + '.pdf'
    });
  }

  private showProgressWindow(message: string, type: "success" | "fail" | "default" = "default") {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: message,
        type: type,
      })
      .show();
  }

  private _prefKey = `extensions.zotero.${addon.data.config.addonRef}.endpoint`;

  public registerPrefs() {
    // Initialize the endpoint preference
    if (!Zotero.Prefs.get(this._prefKey)) {
      Zotero.Prefs.set(this._prefKey, this._defaultEndpoint);
    }
  }
}
