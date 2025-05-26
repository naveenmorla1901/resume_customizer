// frontend/js/components/pdfViewer.js - PDF Viewer Component

export class PDFViewer {
    constructor() {
        this.currentPdfUrl = null;
        this.isLoading = false;
    }

    showPDF(pdfUrlOrBlob, filename = 'resume.pdf') {
        let pdfUrl;

        if (typeof pdfUrlOrBlob === 'string') {
            pdfUrl = pdfUrlOrBlob;
        } else if (pdfUrlOrBlob instanceof Blob) {
            pdfUrl = URL.createObjectURL(pdfUrlOrBlob);
        } else {
            console.error('Invalid PDF data provided');
            return;
        }

        this.currentPdfUrl = pdfUrl;
        this.currentFilename = filename;

        const pdfPreview = document.getElementById('pdfPreview');
        const pdfPlaceholder = document.getElementById('pdfPlaceholder');

        if (pdfPreview && pdfPlaceholder) {
            pdfPreview.src = pdfUrl;
            pdfPreview.classList.remove('hidden');
            pdfPlaceholder.classList.add('hidden');
        }

        this.showPreviewActions();
    }

    showPlaceholder() {
        const pdfPreview = document.getElementById('pdfPreview');
        const pdfPlaceholder = document.getElementById('pdfPlaceholder');

        if (pdfPreview && pdfPlaceholder) {
            pdfPreview.src = 'about:blank';
            pdfPreview.classList.add('hidden');
            pdfPlaceholder.classList.remove('hidden');
        }

        this.hidePreviewActions();
        this.cleanup();
    }

    showLoading(message = 'Loading PDF...') {
        this.isLoading = true;
        
        const pdfPreview = document.getElementById('pdfPreview');
        const pdfPlaceholder = document.getElementById('pdfPlaceholder');

        if (pdfPlaceholder) {
            pdfPlaceholder.innerHTML = `
                <div class="placeholder-content">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `;
            pdfPlaceholder.classList.remove('hidden');
        }

        if (pdfPreview) {
            pdfPreview.classList.add('hidden');
        }
    }

    hideLoading() {
        this.isLoading = false;
        
        if (!this.currentPdfUrl) {
            this.showPlaceholder();
        }
    }

    showPreviewActions() {
        const downloadBtn = document.getElementById('downloadBtn');
        const saveBtn = document.getElementById('saveCustomizedBtn');

        if (downloadBtn) downloadBtn.classList.remove('hidden');
        if (saveBtn) saveBtn.classList.remove('hidden');
    }

    hidePreviewActions() {
        const downloadBtn = document.getElementById('downloadBtn');
        const saveBtn = document.getElementById('saveCustomizedBtn');

        if (downloadBtn) downloadBtn.classList.add('hidden');
        if (saveBtn) saveBtn.classList.add('hidden');
    }

    async downloadCurrentPDF() {
        if (!this.currentPdfUrl) {
            throw new Error('No PDF to download');
        }

        try {
            const response = await fetch(this.currentPdfUrl);
            const blob = await response.blob();
            this.downloadBlob(blob, this.currentFilename);
        } catch (error) {
            console.error('Failed to download PDF:', error);
            throw error;
        }
    }

    downloadBlob(blob, filename = 'resume.pdf') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async loadPDFFromResponse(response, filename = 'resume.pdf') {
        if (!response || !response.ok) {
            throw new Error('Invalid response');
        }

        try {
            const blob = await response.blob();
            this.showPDF(blob, filename);
            return blob;
        } catch (error) {
            console.error('Failed to load PDF from response:', error);
            this.showPlaceholder();
            throw error;
        }
    }

    cleanup() {
        if (this.currentPdfUrl && this.currentPdfUrl.startsWith('blob:')) {
            URL.revokeObjectURL(this.currentPdfUrl);
        }
        this.currentPdfUrl = null;
        this.currentFilename = 'resume.pdf';
    }

    // Reset the placeholder to default state
    resetPlaceholder() {
        const pdfPlaceholder = document.getElementById('pdfPlaceholder');
        if (pdfPlaceholder) {
            pdfPlaceholder.innerHTML = `
                <div class="placeholder-content">
                    <div class="placeholder-icon">📄</div>
                    <p>PDF preview will appear here</p>
                    <small>Select a resume and generate a customized version</small>
                </div>
            `;
        }
    }

    destroy() {
        this.cleanup();
        this.showPlaceholder();
        this.resetPlaceholder();
    }
}

export default PDFViewer;