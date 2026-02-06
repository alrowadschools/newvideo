// Main PDF Extractor Application Script

// ============================================
// GLOBAL STATE AND CONFIGURATION
// ============================================

// State
let extractedContent = [];
let extractedHeadings = {};
let isLoading = false;
let currentPDF = null;
let currentPage = 1;
let totalPages = 1;
let scale = 1.0;
let pdfDocument = null;
let canvasContainer = null;
let canvases = [];
let isExtracting = false;
let pdfFileName = 'Extracted PDF';
let currentIframePage = 1;

// Modal State
let modalCurrentPage = 1;
let modalTotalPages = 0;
let modalPagesContainer = null;

// Week tracking
let currentWeek = null;
let isCustomFileUploaded = false;

// Week file paths
const weekFiles = {
    1: 'APCSP PDF WEEK FILES/WEEK 1.pdf',
    2: "APCSP PDF WEEK FILES/WEEK 2.pdf",
    3: "APCSP PDF WEEK FILES/WEEK 3.pdf",
    4: "APCSP PDF WEEK FILES/WEEK 4.pdf"
};

// DOM Elements
let dropZone, fileInput, statsBar, contentContainer, pdfViewerContainer;
let currentPageInput, totalPagesSpan, zoomLevelSpan, extractionStatus;
let statusText, statusBar, modal, modalPagesContainerElem;
let modalPrevBtn, modalNextBtn, modalPageInfo;

// ============================================
// INITIALIZATION FUNCTION
// ============================================

function initializeApp() {
    // Set worker source for PDF.js
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';
    }

    // Get DOM elements
    dropZone = document.getElementById('drop-zone');
    fileInput = document.getElementById('file-input');
    statsBar = document.getElementById('stats-bar');
    contentContainer = document.getElementById('content-container');
    pdfViewerContainer = document.getElementById('pdf-viewer-container');
    currentPageInput = document.getElementById('current-page');
    totalPagesSpan = document.getElementById('total-pages');
    zoomLevelSpan = document.getElementById('zoom-level');
    extractionStatus = document.getElementById('extraction-status');
    statusText = document.getElementById('status-text');
    statusBar = document.getElementById('status-bar');
    modal = document.getElementById('extracted-content-modal');
    modalPagesContainerElem = document.getElementById('modal-pages-container');
    modalPrevBtn = document.getElementById('modal-prev-btn');
    modalNextBtn = document.getElementById('modal-next-btn');
    modalPageInfo = document.getElementById('modal-page-info');
    
    // Initialize canvas container
    canvasContainer = document.getElementById('pdf-canvas-container');

    // Setup event listeners
    setupEventListeners();
    
    // Auto-load the week for this page
    const weekNumber = getCurrentWeekFromPage();
    if (weekNumber) {
        // Auto-load the week PDF for this page
        setTimeout(() => {
            loadWeekPDF(weekNumber);
        }, 500);
    }
}

// ============================================
// DETECT CURRENT WEEK FROM PAGE
// ============================================

function getCurrentWeekFromPage() {
    // Try to detect which week page this is from URL
    const url = window.location.href.toLowerCase();
    if (url.includes('week1') || url.includes('week-1')) return 1;
    if (url.includes('week2') || url.includes('week-2')) return 2;
    if (url.includes('week3') || url.includes('week-3')) return 3;
    if (url.includes('week4') || url.includes('week-4')) return 4;
    
    // Or check for specific buttons on the page
    const week1Btn = document.querySelector('[onclick*="loadWeekPDF(1)"]');
    const week2Btn = document.querySelector('[onclick*="loadWeekPDF(2)"]');
    const week3Btn = document.querySelector('[onclick*="loadWeekPDF(3)"]');
    const week4Btn = document.querySelector('[onclick*="loadWeekPDF(4)"]');
    
    if (week1Btn) return 1;
    if (week2Btn) return 2;
    if (week3Btn) return 3;
    if (week4Btn) return 4;
    
    return null;
}

// ============================================
// EVENT LISTENERS SETUP
// ============================================

function setupEventListeners() {
    // File upload listeners
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                handleFileUpload(file);
            } else {
                alert('Please drop a valid PDF file');
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });
    }

    // Keyboard shortcuts for modal
    document.addEventListener('keydown', (e) => {
        if (modal && modal.classList.contains('active')) {
            if (e.key === 'ArrowLeft') {
                prevModalPage();
            } else if (e.key === 'ArrowRight') {
                nextModalPage();
            } else if (e.key === 'Escape') {
                closeModal();
            }
        }
    });

    // Week input buttons
    const weekInput = document.getElementById('WeekNoInput');
    if (weekInput) {
        document.querySelectorAll('.btn-drive').forEach(btn => {
            btn.addEventListener('click', function() {
                weekInput.value = this.textContent.trim();
            });
        });
    }
}

// ============================================
// FILE UPLOAD HANDLER
// ============================================

function handleFileUpload(file) {
    pdfFileName = file.name.replace('.pdf', '');
    currentWeek = null;
    isCustomFileUploaded = true;
    
    // Update modal extract button
    updateModalExtractButton();
    
    // Disable week extract buttons when custom file is uploaded
    disableWeekExtractButtons();
    
    loadAndProcessFile(file);
}

// ============================================
// MODAL BUTTON MANAGEMENT
// ============================================

function updateModalExtractButton() {
    // Update modal extract button on all pages
    const modalExtractBtns = document.querySelectorAll('#modal-general-extract-btn');
    modalExtractBtns.forEach(btn => {
        btn.disabled = !isCustomFileUploaded;
        btn.style.opacity = isCustomFileUploaded ? '1' : '0.6';
        btn.style.cursor = isCustomFileUploaded ? 'pointer' : 'not-allowed';
    });
}

// ============================================
// LOADER FUNCTIONS
// ============================================

function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.remove('hidden');
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }
}

function hideLoaderOnModalOpen() {
    setTimeout(() => {
        hideLoader();
    }, 300);
}

// ============================================
// PDF LOADING FUNCTIONS
// ============================================

async function loadWeekPDF(weekNumber) {
    currentWeek = weekNumber;
    isCustomFileUploaded = false;
    
    // Disable modal extract button when loading week PDF
    updateModalExtractButton();
    
    const filePath = weekFiles[weekNumber];
    
    if (!filePath) {
        alert(`Week ${weekNumber} file not configured`);
        return;
    }
    
    try {
        showExtractionStatus(`Loading Week ${weekNumber} PDF...`);
        
        // Clear existing content
        clearCanvases();
        contentContainer.innerHTML = '';
        if (statsBar) statsBar.style.display = 'none';
        
        // Disable all week extract buttons initially
        disableWeekExtractButtons();
        
        // Enable the corresponding extract button for this week
        const extractBtn = document.getElementById(`extract-week-${weekNumber}-btn`);
        if (extractBtn) {
            extractBtn.disabled = false;
        }
        
        console.log(`Loading Week ${weekNumber} from: ${filePath}`);
        const response = await fetch(filePath);
        
        if (!response.ok) {
            throw new Error(`Failed to load Week ${weekNumber} PDF: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        pdfFileName = `APCSP WEEK ${weekNumber}`;
        
        // Update dropzone
        if (dropZone) {
            dropZone.innerHTML = `
                <div class="upload-icon">📄</div>
                <div><strong>${pdfFileName}</strong></div>
                <div class="file-info" style="color: #4CAF50;">Loading PDF...</div>
            `;
            dropZone.classList.add('file-loaded');
        }
        
        await loadAndProcessPDF(arrayBuffer, pdfFileName);
        
    } catch (error) {
        console.error(`Error loading Week ${weekNumber} PDF:`, error);
        
        // Try alternative paths
        const alternativePaths = [
            filePath,
            `./${filePath}`,
            filePath.replace('APCSP PDF WEEK FILES/', ''),
            `pdf/${filePath}`,
            `files/${filePath}`
        ];
        
        let arrayBuffer = null;
        let foundPath = null;
        
        for (const path of alternativePaths) {
            try {
                console.log(`Trying alternative path: ${path}`);
                const response = await fetch(path);
                if (response.ok) {
                    arrayBuffer = await response.arrayBuffer();
                    foundPath = path;
                    console.log(`Successfully loaded from: ${path}`);
                    break;
                }
            } catch (err) {
                console.log(`Failed to load from ${path}:`, err.message);
            }
        }
        
        if (!arrayBuffer) {
            alert(`Week ${weekNumber} PDF not found.\n\nPlease ensure the file "${filePath}" exists in the correct location.`);
            hideExtractionStatus();
            
            if (dropZone) {
                dropZone.innerHTML = `
                    <div class="upload-icon">📁</div>
                    <div>Drag & Drop PDF file here</div>
                    <div class="file-info">or click to browse</div>
                `;
                dropZone.classList.remove('file-loaded');
            }
            return;
        }
        
        pdfFileName = `APCSP WEEK ${weekNumber}`;
        
        if (dropZone) {
            dropZone.innerHTML = `
                <div class="upload-icon">✅</div>
                <div><strong>${pdfFileName}</strong></div>
                <div class="file-info" style="color: #4CAF50;">PDF loaded successfully from ${foundPath}</div>
            `;
            dropZone.classList.add('file-loaded');
        }
        
        await loadAndProcessPDF(arrayBuffer, pdfFileName);
    }
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

function extractWeek(weekNumber) {
    if (currentWeek !== weekNumber) {
        alert(`Please load Week ${weekNumber} PDF first by clicking the "WEEK ${weekNumber}" button.`);
        return;
    }
    
    if (extractedContent.length === 0) {
        alert('No content extracted yet. Please wait for extraction to complete.');
        return;
    }
    
    openModal();
}

function extractGeneralPDF() {
    if (!isCustomFileUploaded) {
        alert('Please upload a PDF file using the UPLOAD button first.');
        return;
    }
    
    if (extractedContent.length === 0) {
        alert('No content extracted yet. Please wait for extraction to complete.');
        return;
    }
    
    openModal();
}

function disableWeekExtractButtons() {
    // Disable all week extract buttons on the page
    const extractButtons = document.querySelectorAll('[id^="extract-week-"]');
    extractButtons.forEach(btn => {
        btn.disabled = true;
    });
}

// ============================================
// PDF PROCESSING FUNCTIONS
// ============================================

async function loadAndProcessFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        currentWeek = null;
        isCustomFileUploaded = true;
        
        // Update modal button
        updateModalExtractButton();
        
        await loadAndProcessPDF(arrayBuffer, file.name);
    } catch (error) {
        console.error('Error loading file:', error);
        alert('Error loading PDF: ' + error.message);
        showEmptyState();
    }
}

function loadPCPDF() {
    if (fileInput) {
        // Trigger file input click
        fileInput.click();
    }
}

async function loadAndProcessPDF(arrayBuffer, pdfName = 'PDF') {
    try {
        // Ensure viewer is visible
        if (pdfViewerContainer) {
            pdfViewerContainer.style.display = 'block';
            pdfViewerContainer.style.opacity = '1';
        }
        
        // Clear previous content
        clearCanvases();
        if (contentContainer) contentContainer.innerHTML = '';
        if (statsBar) statsBar.style.display = 'none';
        
        showExtractionStatus('Loading PDF...');
        
        // Load PDF for viewing
        await displayPDFInViewer(arrayBuffer);
        
        // Start extraction in background
        startExtractionInBackground(arrayBuffer);
        
        // Update dropzone
        if (dropZone) {
            dropZone.innerHTML = `
                <div class="upload-icon">✅</div>
                <div><strong>${pdfFileName}</strong></div>
                <div class="file-info" style="color: #4CAF50;">PDF loaded successfully</div>
            `;
            dropZone.classList.add('file-loaded');
        }
        
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF: ' + error.message);
        hideExtractionStatus();
        showEmptyState();
        
        if (dropZone) {
            dropZone.innerHTML = `
                <div class="upload-icon">📁</div>
                <div>Drag & Drop PDF file here</div>
                <div class="file-info">or click to browse</div>
            `;
            dropZone.classList.remove('file-loaded');
        }
    }
}

async function startExtractionInBackground(arrayBuffer) {
    if (isExtracting) return;
    
    isExtracting = true;
    showExtractionStatus('Extracting text...');
    
    try {
        await extractFromPdf(arrayBuffer);
        
        updateStats(totalPages);
        renderContent();
        
        setTimeout(() => {
            hideExtractionStatus();
            isExtracting = false;
        }, 1000);
        
    } catch (error) {
        console.error('Error during extraction:', error);
        if (statusText) statusText.textContent = 'Extraction failed';
        if (statusBar) statusBar.style.background = '#ef4444';
        
        setTimeout(() => {
            hideExtractionStatus();
            isExtracting = false;
        }, 3000);
    }
}

// ============================================
// PDF VIEWER FUNCTIONS
// ============================================

async function displayPDFInViewer(arrayBuffer) {
    try {
        console.log('Starting PDF display...');
        
        clearCanvases();
        
        if (canvasContainer) {
            canvasContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Loading PDF...</div>';
        }
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfDocument = await loadingTask.promise;
        
        totalPages = pdfDocument.numPages;
        console.log(`PDF loaded. Total pages: ${totalPages}`);
        
        if (totalPagesSpan) totalPagesSpan.textContent = ` / ${totalPages}`;
        if (currentPageInput) {
            currentPageInput.value = 1;
            currentPageInput.max = totalPages;
        }
        
        scale = 1.5;
        updateZoomLevel();
        
        if (pdfViewerContainer) {
            pdfViewerContainer.style.display = 'block';
            pdfViewerContainer.style.visibility = 'visible';
            pdfViewerContainer.style.opacity = '1';
            pdfViewerContainer.style.height = 'auto';
        }
        
        if (canvasContainer) canvasContainer.innerHTML = '';
        
        await renderPDFPage(1);
        
        setTimeout(() => {
            if (pdfViewerContainer) {
                pdfViewerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
        
        renderRemainingPages();
        
        console.log('PDF displayed in viewer successfully');
        
    } catch (error) {
        console.error('Error displaying PDF:', error);
        if (canvasContainer) {
            canvasContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #f44336;">Error loading PDF. Please try again.</div>';
        }
        throw error;
    }
}

function clearCanvases() {
    if (canvasContainer) {
        canvasContainer.innerHTML = '';
    }
    canvases = [];
}

async function renderRemainingPages() {
    if (!pdfDocument || totalPages <= 1) return;
    
    for (let i = 2; i <= totalPages; i++) {
        await renderPDFPage(i);
    }
}

async function renderPDFPage(pageNum) {
    if (!pdfDocument || !canvasContainer) return;
    
    try {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale });
        
        const pageContainer = document.createElement('div');
        pageContainer.className = 'canvas-container';
        pageContainer.style.width = `${viewport.width}px`;
        pageContainer.style.height = `${viewport.height}px`;
        pageContainer.style.margin = '0 auto 30px auto';
        pageContainer.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
        pageContainer.style.border = '1px solid #d1d5db';
        pageContainer.style.borderRadius = '12px';
        pageContainer.style.overflow = 'hidden';
        pageContainer.style.backgroundColor = 'white';
        pageContainer.style.position = 'relative';
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = 'block';
        canvas.style.backgroundColor = 'white';
        
        canvases[pageNum - 1] = { canvas, page, viewport };
        
        pageContainer.appendChild(canvas);
        canvasContainer.appendChild(pageContainer);
        
        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport,
            background: 'white'
        };
        
        await page.render(renderContext).promise;
        
        const pageNumDiv = document.createElement('div');
        pageNumDiv.style.position = 'absolute';
        pageNumDiv.style.bottom = '15px';
        pageNumDiv.style.right = '15px';
        pageNumDiv.style.padding = '8px 15px';
        pageNumDiv.style.background = 'rgba(0, 0, 0, 0.8)';
        pageNumDiv.style.color = 'white';
        pageNumDiv.style.borderRadius = '6px';
        pageNumDiv.style.fontSize = '14px';
        pageNumDiv.style.fontWeight = 'bold';
        pageNumDiv.textContent = `Page ${pageNum}`;
        pageContainer.appendChild(pageNumDiv);
        
        console.log(`Page ${pageNum} rendered at ${viewport.width}x${viewport.height}`);
        
    } catch (error) {
        console.error(`Error rendering page ${pageNum}:`, error);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'canvas-container';
        errorDiv.style.width = '100%';
        errorDiv.style.height = '400px';
        errorDiv.style.margin = '0 auto 30px auto';
        errorDiv.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
        errorDiv.style.border = '2px dashed #ef4444';
        errorDiv.style.borderRadius = '12px';
        errorDiv.style.overflow = 'hidden';
        errorDiv.style.backgroundColor = '#fef2f2';
        errorDiv.style.display = 'flex';
        errorDiv.style.alignItems = 'center';
        errorDiv.style.justifyContent = 'center';
        errorDiv.style.flexDirection = 'column';
        errorDiv.style.padding = '20px';
        
        errorDiv.innerHTML = `
            <div style="font-size: 48px; color: #ef4444; margin-bottom: 16px;">❌</div>
            <div style="font-size: 16px; color: #7f1d1d; font-weight: bold; margin-bottom: 8px;">Error Loading Page ${pageNum}</div>
            <div style="font-size: 14px; color: #991b1b; text-align: center;">${error.message || 'Unknown error'}</div>
        `;
        
        if (canvasContainer) {
            canvasContainer.appendChild(errorDiv);
        }
    }
}

async function rerenderAllPages() {
    if (!pdfDocument) return;
    
    clearCanvases();
    for (let i = 1; i <= totalPages; i++) {
        await renderPDFPage(i);
    }
}

// ============================================
// ZOOM AND NAVIGATION FUNCTIONS
// ============================================

function zoomIn() {
    scale = Math.min(scale + 0.1, 3.0);
    updateZoomLevel();
    rerenderAllPages();
}

function zoomOut() {
    scale = Math.max(scale - 0.1, 0.5);
    updateZoomLevel();
    rerenderAllPages();
}

function updateZoomLevel() {
    const percent = Math.round(scale * 100);
    if (zoomLevelSpan) zoomLevelSpan.textContent = `${percent}%`;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        if (currentPageInput) currentPageInput.value = currentPage;
        scrollToPage(currentPage);
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        if (currentPageInput) currentPageInput.value = currentPage;
        scrollToPage(currentPage);
    }
}

function goToPage(page) {
    const pageNum = parseInt(page);
    if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
        currentPage = pageNum;
        if (currentPageInput) currentPageInput.value = currentPage;
        scrollToPage(currentPage);
    }
}

function scrollToPage(pageNum) {
    if (!canvasContainer) return;
    
    const pageIndex = pageNum - 1;
    const pageContainers = canvasContainer.getElementsByClassName('canvas-container');
    
    if (pageContainers[pageIndex]) {
        pageContainers[pageIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function closeViewer() {
    if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
    if (pdfDocument) {
        pdfDocument.destroy();
        pdfDocument = null;
    }
    clearCanvases();
    hideExtractionStatus();
    isExtracting = false;
    
    if (dropZone) {
        dropZone.innerHTML = `
            <div class="upload-icon">📁</div>
            <div>Drag & Drop PDF file here</div>
            <div class="file-info">or click to browse</div>
        `;
        dropZone.classList.remove('file-loaded');
    }
}

// ============================================
// EXTRACTION STATUS FUNCTIONS
// ============================================

function showExtractionStatus(message) {
    if (extractionStatus) {
        extractionStatus.classList.add('active');
    }
    if (statusText) statusText.textContent = message;
    if (statusBar) statusBar.style.width = '0%';
}

function updateExtractionProgress(progress, message) {
    if (statusText) statusText.textContent = message;
    if (statusBar) statusBar.style.width = `${progress}%`;
}

function hideExtractionStatus() {
    if (extractionStatus) {
        extractionStatus.classList.remove('active');
    }
}

// ============================================
// CONTENT EXTRACTION FUNCTIONS
// ============================================

function extractHeadingsFromText(text) {
    const lines = text.split('\n');
    const headings = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#') && trimmedLine.length > 2) {
            const headingText = trimmedLine.replace(/^#+\s*/, '').trim();
            if (headingText.length > 0) {
                headings.push(headingText);
            }
        }
    }
    
    return headings.length > 0 ? headings[0] : null;
}

async function extractFromPdf(arrayBuffer) {
    const typedArray = new Uint8Array(arrayBuffer);
    
    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
    const totalPages = pdf.numPages;
    
    console.log('PDF loaded, pages:', totalPages);
    
    extractedContent = [];
    extractedHeadings = {};
    let globalOrder = 0;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const progress = Math.round((pageNum / totalPages) * 100);
        updateExtractionProgress(progress, `Processing page ${pageNum} of ${totalPages}...`);
        
        const page = await pdf.getPage(pageNum);
        console.log('Processing page:', pageNum);
        
        // Extract text
        try {
            const textContent = await page.getTextContent();
            const textByLine = {};
            
            console.log('Text items found:', textContent.items.length);
            
            textContent.items.forEach(item => {
                if (item.str && item.str.trim()) {
                    const y = Math.round(item.transform[5]);
                    if (!textByLine[y]) textByLine[y] = [];
                    textByLine[y].push(item.str);
                }
            });

            const sortedYs = Object.keys(textByLine).map(Number).sort((a, b) => b - a);
            const lines = sortedYs.map(y => textByLine[y].join(' ')).filter(line => line.trim());
            
            if (lines.length > 0) {
                const pageText = lines.join('\n');
                
                const heading = extractHeadingsFromText(pageText);
                if (heading) {
                    extractedHeadings[pageNum] = heading;
                }
                
                extractedContent.push({
                    id: `text-${pageNum}-${globalOrder}`,
                    type: 'text',
                    content: pageText,
                    pageNumber: pageNum,
                    globalOrder: globalOrder++,
                    isEditing: false
                });
                console.log('Added text block with', lines.length, 'lines');
                if (heading) {
                    console.log('Extracted heading:', heading);
                }
            }
        } catch (textErr) {
            console.error('Text extraction error:', textErr);
        }

        // Extract images
        try {
            updateExtractionProgress(progress, `Extracting images from page ${pageNum}...`);
            
            const operatorList = await page.getOperatorList();
            
            console.log('Operator list length:', operatorList.fnArray.length);

            for (let i = 0; i < operatorList.fnArray.length; i++) {
                const op = operatorList.fnArray[i];
                
                if (op === 82 || op === 85 || op === 88) {
                    const imageName = operatorList.argsArray[i][0];
                    console.log('Found image:', imageName, 'op:', op);
                    
                    try {
                        const imageData = await new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
                            page.objs.get(imageName, (img) => {
                                clearTimeout(timeout);
                                resolve(img);
                            });
                        });

                        if (imageData) {
                            console.log('Image data:', imageData.width, 'x', imageData.height, 'data length:', imageData.data?.length);
                            
                            if (imageData.data && imageData.width && imageData.height) {
                                const dataUrl = imageToDataUrl(imageData);
                                const qrData = decodeQR(imageData);
                                
                                extractedContent.push({
                                    id: `image-${pageNum}-${globalOrder}`,
                                    type: 'image',
                                    content: dataUrl,
                                    pageNumber: pageNum,
                                    globalOrder: globalOrder++,
                                    width: imageData.width,
                                    height: imageData.height,
                                    qrData: qrData
                                });
                                console.log('Added image block');
                            } else if (imageData.src) {
                                extractedContent.push({
                                    id: `image-${pageNum}-${globalOrder}`,
                                    type: 'image',
                                    content: imageData.src,
                                    pageNumber: pageNum,
                                    globalOrder: globalOrder++,
                                    width: imageData.width || 100,
                                    height: imageData.height || 100,
                                    qrData: null
                                });
                                console.log('Added pre-decoded image');
                            }
                        }
                    } catch (imgErr) {
                        console.warn('Failed to extract image:', imageName, imgErr);
                    }
                }
            }
        } catch (opErr) {
            console.error('Operator list error:', opErr);
        }
    }

    extractedContent.sort((a, b) => a.globalOrder - b.globalOrder);
    
    console.log('Total content items:', extractedContent.length);
    console.log('Extracted headings:', extractedHeadings);
    
    updateExtractionProgress(100, 'Extraction completed!');
}

function imageToDataUrl(imageData) {
    const { data, width, height } = imageData;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    let rgbaData;
    if (data.length === width * height * 3) {
        rgbaData = new Uint8ClampedArray(width * height * 4);
        for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
            rgbaData[j] = data[i];
            rgbaData[j + 1] = data[i + 1];
            rgbaData[j + 2] = data[i + 2];
            rgbaData[j + 3] = 255;
        }
    } else {
        rgbaData = new Uint8ClampedArray(data);
    }

    const imgData = new ImageData(rgbaData, width, height);
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
}

function decodeQR(imageData) {
    try {
        const { data, width, height } = imageData;
        let rgbaData;
        
        if (data.length === width * height * 3) {
            rgbaData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
                rgbaData[j] = data[i];
                rgbaData[j + 1] = data[i + 1];
                rgbaData[j + 2] = data[i + 2];
                rgbaData[j + 3] = 255;
            }
        } else {
            rgbaData = new Uint8ClampedArray(data);
        }

        const result = jsQR(rgbaData, width, height);
        return result ? result.data : null;
    } catch (e) {
        return null;
    }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal() {
    if (extractedContent.length === 0) {
        alert('No content extracted yet. Please wait for extraction to complete.');
        return;
    }
    
    if (!modalPagesContainerElem) return;
    
    const pages = {};
    extractedContent.forEach(item => {
        if (!pages[item.pageNumber]) {
            pages[item.pageNumber] = {
                textBlocks: [],
                images: []
            };
        }
        
        if (item.type === 'text') {
            pages[item.pageNumber].textBlocks.push(item);
        } else if (item.type === 'image') {
            pages[item.pageNumber].images.push(item);
        }
    });
    
    modalPagesContainerElem.innerHTML = '';
    modalTotalPages = Object.keys(pages).length;
    
    Object.keys(pages).sort((a, b) => a - b).forEach(pageNum => {
        const pageData = pages[pageNum];
        const pageDiv = document.createElement('div');
        pageDiv.className = 'modal-page';
        pageDiv.innerHTML = createModalPageHTML(pageNum, pageData);
        modalPagesContainerElem.appendChild(pageDiv);
    });
    
    modalCurrentPage = 1;
    updateModalPosition();
    updateModalNav();
    
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    hideLoaderOnModalOpen();
}

function closeModal() {
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function createModalPageHTML(pageNum, pageData) {
    const pageHeading = extractedHeadings[pageNum] || `Page ${pageNum}`;
    
    let html = `
        <div class="page-container" style="margin: 0;">
            <div class="two-column-layout">
                <!-- Text Column with Extracted Heading -->
                <div class="text-column">
    `;
    
    // Add text blocks
    pageData.textBlocks.forEach((item, index) => {
        html += createModalTextBlockHTML(item, index, pageNum);
    });
    
    html += `
                </div>
                
                <!-- Image Column with Extracted Heading -->
                <div class="image-column">
    `;
    
    // Add images
    pageData.images.forEach((item, index) => {
        html += createModalImageBlockHTML(item, index, pageNum);
    });
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function createModalTextBlockHTML(item, index, pageNum) {
    const isEditing = item.isEditing;
    const pageHeading = extractedHeadings[pageNum] || `Page ${pageNum}`;
    
    if (index === 0) {
        const textContent = item.content;
        const headingPosition = textContent.indexOf(pageHeading);
        
        let textAfterHeading = textContent;
        
        if (headingPosition !== -1) {
            textAfterHeading = textContent.substring(headingPosition + pageHeading.length);
            textAfterHeading = textAfterHeading.replace(/^[#\s]*/, '').trim();
            
            if (textAfterHeading.length < 50) {
                textAfterHeading = textContent;
            }
        }
        
        const sentences = textAfterHeading.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        const firstThreeSentences = sentences
            .filter(sentence => {
                const trimmed = sentence.trim();
                return trimmed.length >= 20 && 
                       !trimmed.startsWith('#') &&
                       !trimmed.toLowerCase().includes(pageHeading.toLowerCase());
            })
            .slice(0, 3);
        
        let displayTextHTML;
        if (firstThreeSentences.length > 0) {
            const escapedSentences = firstThreeSentences.map(sentence => 
                escapeHtml(sentence.trim())
            );
            displayTextHTML = escapedSentences.join('<br><br>');
        } else {
            const firstParagraph = textAfterHeading.split('\n\n')[0] || textAfterHeading.slice(0, 150);
            displayTextHTML = escapeHtml(firstParagraph.trim());
        }
        
        const combinedText = `<div style="margin-bottom:0px; font-weight: bold; color: black;height:500px;overflow-y:auto;">
                                 ${displayTextHTML}
                              </div>
                              <hr style="border: none; height: 2px; background: linear-gradient(90deg, #a855f7, #6366f1); margin: 0px 0;">`;
        
        return `
            <div class="text-block">
                <!-- TOP ROW: Text Badge + UPLOAD/EXTRACT Buttons + Page Heading + Edit Button -->
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom:0px;
                    gap:10px;
                    flex-wrap: wrap;
                    background: rgba(168, 85, 247, 0.18);
                    border-radius: 0px;
                    padding: 10px;
                    border-right:6px solid white;
                ">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <span class="block-badge badge-text" style="
                            background: #a855f7;
                            color: white;
                            padding: 6px 12px;
                            border-radius: 6px;
                            font-weight: bold;
                            font-size: 14px;
                            display:none;
                        ">📝 Text</span>
                        <!-- UPLOAD and EXTRACT buttons moved here -->
                      <button class="btn-drive" onclick="loadPCPDF()" title="Upload PDF" style="
    background: white;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;       /* Makes it a perfect circle */
    font-weight: bold;
    font-size: 22px;          /* Adjust emoji size */
    cursor: pointer;
    border: 1px solid rgba(168, 85, 247, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;               /* Remove extra padding for perfect circle */
">
    📁
</button>

<button class="btn-view-extracted" 
        id="modal-general-extract-btn" 
        onclick="extractGeneralPDF()" 
        disabled 
        title="Extract PDF" 
        style="
            background: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;         /* Makes it a perfect circle */
            font-weight: bold;
            cursor: pointer;
            border: 1px solid rgba(168, 85, 247, 0.18);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;                 /* Remove extra padding for perfect circle */
            font-size: 22px;
        ">
    <span style="color: orange; font-size: 22px; line-height: 1;">📚</span>
</button>


                    </div>
                    <div style="
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 26px;
                        font-weight: bold;
                        color: #2c3e50;
                        text-align: center;
                        flex: 1;
                        min-width: 200px;
                        cursor:pointer;
                    ">
                        ${escapeHtml(pageHeading)}
                    </div>
                    <div class="block-actions" style="white-space: nowrap;">
                        ${isEditing ? `
                            <button class="btn btn-save" onclick="saveTextInModal(${pageNum}, ${index})">💾 Save</button>
                            <button class="btn btn-cancel" onclick="cancelEditInModal(${pageNum}, ${index})">✖ Cancel</button>
                        ` : `
<button class="btn btn-edit"
        onclick="openNotesModal(${pageNum})"
        title="Notes" 
        style="
            background: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            border: 1px solid rgba(168, 85, 247, 0.18);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            font-size: 22px;     /* 🔼 Increase emoji size */
            line-height: 1;      /* Perfect vertical centering */
        ">
    🧮
</button>

                        `}
                    </div>
                </div>
                
                <!-- SINGLE CONTENT AREA with 3 sentences on separate lines + full text -->
                <div class="text-content">
                    ${isEditing ? `
                        <textarea class="text-edit"style="display:none;" id="modal-textarea-${pageNum}-${index}">${escapeHtml(item.content)}</textarea>
                    ` : `
                        <div style="
                            font-family: 'Times New Roman', Times, serif;
                            font-size: 26px;
                            line-height: 1.3;
                            color: black;
                            padding: 5px;
                            background: white;
                            border-radius: 15px;
                            text-align: justify;
                            text-justify: inter-word;
                            overflow-wrap: break-word;
                            hyphens: auto;
                            border-left:0px solid #a855f7;
                            margin: 0px 0;
                            color:black;style="display:none;"">
                            ${combinedText}
                        </div>
                    `}
                </div>
            </div>
        `;
    } else {
        return '';
    }
}

function createModalImageBlockHTML(item, index, pageNum) {
    const pageHeading = extractedHeadings[pageNum] || `Page ${pageNum}`;
    const iframeWrapperId = `iframe-wrapper-${pageNum}`;
    const iframeId = `SlideIframe-${pageNum}`;
    const imageId = `SlideImage-${pageNum}`;
    
    return `
<div class="image-block">
    <!-- TOP ROW: Page Heading + Download Button -->
    <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0px;
        gap: 0px;
        flex-wrap: wrap;
        background: rgba(168, 85, 247, 0.18);
        border-radius: 0px;
        padding:10px;
    ">
        <div style="
            font-family: 'Times New Roman', Times, serif;
            font-size: 26px;
            font-weight: bold;
            color: #2c3e50;
            text-align: left;
            flex: 1;
        ">
            ${escapeHtml(pageHeading)}
        </div>
        <div class="block-actions">
      <button class="btn btn-download"
        onclick="downloadImageInModal(${pageNum}, ${index})"
        style="
            background: rgba(168, 85, 247, 0.18);
            color: grey;
            border: none;
            padding: 10px 16px;
            border-radius: 30px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;  /* ✅ center horizontally */
            gap: 6px;
        ">
    ⬇️ Download .pptx
</button>

        </div>
    </div>
    
    <div class="image-container" style="position: relative;">
        <!-- Hidden iframe with close button -->
<div id="${iframeWrapperId}" 
     style="
        display:none;
        position: relative;
        height:100%;
        width:97%;
        overflow:hidden;
        margin-top:10px;
        margin-left:10px;
     ">

    <button 
        onclick="closeIframe(${pageNum})"
        style="
            position:absolute;
            top:5px;
            right:5px;
            z-index:1000;
            background:red;
            color:white;
            border:none;
            border-radius:50%;
            width:30px;
            height:30px;
            cursor:pointer;
            font-weight:bold;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:16px;
        ">✖</button>

    <iframe id="${iframeId}"
        style="
            width:100%;
            height:90%;
            border:none;
            overflow-y:auto;
            overflow-x:hidden;
        ">
    </iframe>
</div>

        <img id="${imageId}" src="${item.content}" alt="Extracted image from page ${item.pageNumber}" style="width:100%; border-radius: 0px;">

    </div>

    ${item.qrData ? `
        <div class="text-content">
            <div class="qr-result">
                <div class="qr-result-label">🔍 QR Code Detected:</div>
                <div class="qr-result-data">${escapeHtml(item.qrData)}</div>
            </div>
        </div>
    ` : ''}
</div>
    `;
}

function prevModalPage() {
    if (modalCurrentPage > 1) {
        modalCurrentPage--;
        updateModalPosition();
        updateModalNav();
    }
}

function nextModalPage() {
    if (modalCurrentPage < modalTotalPages) {
        modalCurrentPage++;
        updateModalPosition();
        updateModalNav();
    }
}

function updateModalPosition() {
    if (modalPagesContainerElem) {
        const offset = -(modalCurrentPage - 1) * 100;
        modalPagesContainerElem.style.transform = `translateX(${offset}%)`;
    }
}

function updateModalNav() {
    if (modalPageInfo) {
        modalPageInfo.textContent = `Page ${modalCurrentPage} of ${modalTotalPages}`;
    }
    if (modalPrevBtn) {
        modalPrevBtn.disabled = modalCurrentPage === 1;
    }
    if (modalNextBtn) {
        modalNextBtn.disabled = modalCurrentPage === modalTotalPages;
    }
}

// ============================================
// NOTES MODAL FUNCTIONS
// ============================================

function openNotesModal(pageNum) {
    const pageTextBlocks = extractedContent.filter(item => 
        item.pageNumber == pageNum && item.type === 'text'
    );
    
    if (pageTextBlocks.length === 0) {
        alert('No text content found for this page.');
        return;
    }
    
    const textBlock = pageTextBlocks[0];
    const textContent = textBlock.content;
    const pageHeading = extractedHeadings[pageNum] || `Page ${pageNum}`;
    const headingPosition = textContent.indexOf(pageHeading);
    
    let notesContent = textContent;
    
    if (headingPosition !== -1) {
        notesContent = textContent.substring(headingPosition + pageHeading.length);
        notesContent = notesContent.replace(/^[#\s]*/, '').trim();
        
        if (notesContent.length < 50) {
            notesContent = textContent;
        }
    }
    
    let notesModal = document.getElementById('NotesText');
    
    if (!notesModal) {
        notesModal = document.createElement('div');
        notesModal.id = 'NotesText';
        notesModal.style.cssText = `
            display: none;
            position: fixed;
            top: 1%;
            left: 1%;
            width: 48%;
            height: 85%;
            background:transparent;
            z-index: 9999;
            justify-content: center;
            align-items: center;
            border-top-left-radius: 30px;
            overflow-y:hidden;
        `;
        document.body.appendChild(notesModal);
    }
    
    notesModal.innerHTML = `
        <div style="
            background: white;
            width: 100%;
            max-height: 81%;
            margin: auto;
            padding: 20px;
            border-radius: 8px;
            position: relative;
            overflow-y:hidden;
             border-top-left-radius: 30px;
        ">
            <!-- Top-right X close -->
            <span onclick="closeNotesModal()"
                  style="position: absolute; top: 10px; right: 15px; cursor: pointer; font-size: 26px; font-weight: bold; color: red;">
                &times;
            </span>
            
            <!-- Modal Header -->
            <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #a855f7;">
                <h2 style="margin: 0; color: #2c3e50; font-family: 'Times New Roman', Times, serif;">
                    📝 Notes - ${escapeHtml(pageHeading)}
                </h2>
                
            </div>
            
            <!-- Modal Content -->
            <div style="
                font-family: 'Times New Roman', Times, serif;
                font-size: 20px;
                line-height: 1.6;
                color: #333;
                max-height: 500px;
                overflow-y: auto;
                padding: 10px;
                background: white;
                border-radius: 30px;
            ">
                ${escapeHtml(notesContent).replace(/\n/g, '<br>')}
            </div>
            
            <!-- Bottom Close Button -->
            <div style="text-align: right; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                <button onclick="closeNotesModal()"
                        style="padding: 8px 20px; border: none; background: #a855f7; color: white; 
                               cursor: pointer; border-radius: 4px; font-size: 16px; font-weight: bold;">
                    Close
                </button>
            </div>
        </div>
    `;
    
    notesModal.style.display = 'flex';
    notesModal.dataset.pageNum = pageNum;
}

function closeNotesModal() {
    const notesModal = document.getElementById('NotesText');
    if (notesModal) {
        notesModal.style.display = 'none';
    }
}

// ============================================
// IFRAME FUNCTIONS
// ============================================

function showIframe(url) {
    const modal = document.getElementById('extracted-content-modal');
    if (!modal || !modal.classList.contains('active')) {
        alert('Please open the modal first by extracting content.');
        return;
    }
    
    const modalPageInfo = document.getElementById('modal-page-info');
    let currentPage = 1;
    
    if (modalPageInfo) {
        const match = modalPageInfo.textContent.match(/Page (\d+) of/);
        if (match) {
            currentPage = parseInt(match[1]);
        }
    }
    
    currentIframePage = currentPage;
    
    const iframeWrapperId = `iframe-wrapper-${currentPage}`;
    const iframeId = `SlideIframe-${currentPage}`;
    const imageId = `SlideImage-${currentPage}`;
    
    const iframeWrapper = document.getElementById(iframeWrapperId);
    const iframe = document.getElementById(iframeId);
    const image = document.getElementById(imageId);

    if (iframeWrapper && iframe && image) {
        image.style.display = 'none';
        iframeWrapper.style.display = 'block';
        iframe.src = url;
        
        console.log(`Showing iframe on page ${currentPage} with URL: ${url}`);
    } else {
        console.error('Elements not found for page:', currentPage);
        alert('Iframe not available. Please navigate to a different slide and try again.');
    }
}

function closeIframe(pageNum = null) {
    const pageToClose = pageNum || currentIframePage;
    const iframeWrapperId = `iframe-wrapper-${pageToClose}`;
    const imageId = `SlideImage-${pageToClose}`;
    
    const iframeWrapper = document.getElementById(iframeWrapperId);
    const image = document.getElementById(imageId);

    if (iframeWrapper && image) {
        iframeWrapper.style.display = 'none';
        image.style.display = 'block';
        console.log(`Closing iframe for page ${pageToClose}`);
    } else {
        console.error('Elements not found for page:', pageToClose);
    }
}

function updateIframeOnPageChange() {
    closeIframe();
    
    const modalPageInfo = document.getElementById('modal-page-info');
    if (modalPageInfo) {
        const match = modalPageInfo.textContent.match(/Page (\d+) of/);
        if (match) {
            currentIframePage = parseInt(match[1]);
        }
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateStats(pages) {
    if (statsBar) {
        statsBar.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">📄 Pages:</span>
                <span class="stat-value">${pages}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">📝 Text Blocks:</span>
                <span class="stat-value">${extractedContent.filter(item => item.type === 'text').length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">🖼️ Images:</span>
                <span class="stat-value">${extractedContent.filter(item => item.type === 'image').length}</span>
            </div>
        `;
        statsBar.style.display = 'flex';
    }
}

function renderContent() {
    if (!contentContainer) return;
    
    contentContainer.innerHTML = '';
    
    if (extractedContent.length === 0) {
        contentContainer.innerHTML = '<div class="empty-state">No content extracted yet</div>';
        return;
    }
    
    const contentByPage = {};
    extractedContent.forEach(item => {
        if (!contentByPage[item.pageNumber]) {
            contentByPage[item.pageNumber] = [];
        }
        contentByPage[item.pageNumber].push(item);
    });
    
    Object.keys(contentByPage).sort((a, b) => a - b).forEach(pageNum => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page-section';
        
        const heading = extractedHeadings[pageNum] || `Page ${pageNum}`;
        pageDiv.innerHTML = `
            <div class="page-header">
                <h3>${escapeHtml(heading)}</h3>
                <span class="page-number">Page ${pageNum}</span>
            </div>
        `;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'page-content';
        
        contentByPage[pageNum].forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `content-item ${item.type}-item`;
            
            if (item.type === 'text') {
                itemDiv.innerHTML = `
                    <div class="item-header">
                        <span class="item-type">📝 Text</span>
                        <span class="item-actions">
                            <button onclick="editText('${item.id}')">✏️ Edit</button>
                            <button onclick="copyText('${item.id}')">📋 Copy</button>
                        </span>
                    </div>
                    <div class="item-content">${escapeHtml(item.content).replace(/\n/g, '<br>')}</div>
                `;
            } else if (item.type === 'image') {
                itemDiv.innerHTML = `
                    <div class="item-header">
                        <span class="item-type">🖼️ Image</span>
                        <span class="item-actions">
                            <button onclick="downloadImage('${item.id}')">⬇️ Download</button>
                            ${item.qrData ? `<button onclick="copyQR('${item.id}')">📋 Copy QR</button>` : ''}
                        </span>
                    </div>
                    <div class="item-content">
                        <img src="${item.content}" alt="Extracted image" style="max-width: 100%; border-radius: 8px;">
                        ${item.qrData ? `
                            <div class="qr-info">
                                <strong>QR Code Detected:</strong>
                                <div class="qr-data">${escapeHtml(item.qrData)}</div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            contentDiv.appendChild(itemDiv);
        });
        
        pageDiv.appendChild(contentDiv);
        contentContainer.appendChild(pageDiv);
    });
}

function showEmptyState() {
    if (contentContainer) {
        contentContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <h3>No PDF Loaded</h3>
                <p>Upload a PDF file or select a week to get started</p>
            </div>
        `;
    }
}

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
// ============================================
// PPTX GENERATION FUNCTIONS
// ============================================

function ExtractPPT(slidesData) {
    if (typeof PptxGenJS === 'undefined') {
        alert('PptxGenJS library not loaded. Please include the library.');
        return;
    }
    
    const pptx = new PptxGenJS();

    // Set custom slide size: 16 x 6 inches
    pptx.defineLayout({ name: "Custom16x6", width: 16, height: 6 });
    pptx.layout = "Custom16x6";

    const today = new Date();
    const dateStr = today.toLocaleDateString();

    slidesData.forEach((slideItem, index) => {
        const slide = pptx.addSlide();

        // --- Top Heading Shape ---
        if (slideItem.heading) {
            slide.addText(slideItem.heading, {
                x: 0.0, y: 0.0, w: 7.0, h: 0.7,
                fontSize: 28,
                bold: true,
                color: "2c3e50",
                valign: "middle",
                align: "center",
                fill: { color: "DDA0F7" },
                margin: 0.1,
                borderRadius: 4
            });
        }

        // --- Left Column Background Shape ---
        slide.addShape(pptx.shapes.RECTANGLE, {
            x: 0.8, y: 0.7, w: 6.2, h: 5.0,
            fill: { color: "DDA0F7" },
            line: null
        });

        // --- Left Column Text ---
        slide.addText(slideItem.text || "No text available", {
            x: 0.2, y: 0.7, w: 6.5, h: 4.9,
            fontSize: 22,
            color: "363636",
            valign: "top",
            align: "justify",
            margin: 0.1,
            bold: true,
            fill: { color: "FFFFFF" },
            shape: pptx.shapes.ROUNDED_RECTANGLE
        });

        // --- Right Column Image ---
        if (slideItem.image) {
            slide.addImage({
                x: 7, y: 0.0, w: 9, h: 6.0,
                data: slideItem.image
            });
        }

        // --- Bottom Footer Shape with Date & Slide Number ---
        slide.addText(`Date: ${dateStr}   |   Slide: ${index + 1}`, {
            x: 0.0, y: 5.6, w: 7.0, h: 0.4,
            fontSize: 18,
            bold: true,
            color: "2c3e50",
            valign: "middle",
            align: "center",
            fill: { color: "DDA0F7" },
            margin: 0.1,
            borderRadius: 4
        });
    });

    pptx.writeFile("GeneratedSlides.pptx");
}

function downloadImageInModal(pageNum, index) {
    const slidesData = [];
    
    const modal = document.getElementById("extracted-content-modal");
    if (!modal) return;
    
    const textBlocks = modal.querySelectorAll(".text-block");
    const imageBlocks = modal.querySelectorAll(".image-block");
    
    const totalSlides = Math.min(textBlocks.length, imageBlocks.length);
    
    for (let i = 0; i < totalSlides; i++) {
        const textDiv = textBlocks[i];
        const imageDiv = imageBlocks[i];
        
        let heading = "";
        const headingDiv = textDiv?.querySelector("div[style*='flex: 1']") || null;
        if (headingDiv) {
            heading = headingDiv.innerText.trim();
        }
        
        const textContent = textDiv?.querySelector(".text-content")?.innerText || "";
        const imageSrc = imageDiv?.querySelector("img")?.src || null;
        
        if (heading) {
            slidesData.push({
                heading: heading,
                text: textContent,
                image: imageSrc
            });
        }
    }

    if (slidesData.length > 0) {
        ExtractPPT(slidesData);
    } else {
        alert("No slides to download!");
    }
}

// ============================================
// EDIT AND UPDATE FUNCTIONS
// ============================================

function startEditInModal(pageNum, index) {
    const item = findItemByPageAndIndex(pageNum, index, 'text');
    if (item) {
        item.isEditing = true;
        updateModalContent(pageNum);
    }
}

function saveTextInModal(pageNum, index) {
    const item = findItemByPageAndIndex(pageNum, index, 'text');
    if (item) {
        const textarea = document.getElementById(`modal-textarea-${pageNum}-${index}`);
        if (textarea) {
            item.content = textarea.value;
            item.isEditing = false;
            updateModalContent(pageNum);
        }
    }
}

function cancelEditInModal(pageNum, index) {
    const item = findItemByPageAndIndex(pageNum, index, 'text');
    if (item) {
        item.isEditing = false;
        updateModalContent(pageNum);
    }
}

function downloadImageInModal(pageNum, index) {
    const item = findItemByPageAndIndex(pageNum, index, 'image');
    if (item) {
        const link = document.createElement('a');
        link.href = item.content;
        link.download = `image-page${item.pageNumber}-${Date.now()}.png`;
        link.click();
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function findItemByPageAndIndex(pageNum, index, type) {
    const pageItems = extractedContent.filter(item => 
        item.pageNumber == pageNum && item.type === type
    );
    return pageItems[index];
}

function updateStats(pages) {
    const textCount = extractedContent.filter(c => c.type === 'text').length;
    const imageCount = extractedContent.filter(c => c.type === 'image').length;
    
    const statPages = document.getElementById('stat-pages');
    const statText = document.getElementById('stat-text');
    const statImages = document.getElementById('stat-images');
    
    if (statPages) statPages.textContent = pages;
    if (statText) statText.textContent = textCount;
    if (statImages) statImages.textContent = imageCount;
    if (statsBar) statsBar.style.display = 'flex';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showEmptyState() {
    if (contentContainer) {
        contentContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <div>No content extracted. Upload a PDF to get started.</div>
            </div>
        `;
    }
}

function autoLoadWeek1() {
    const btn1 = document.querySelector('.btn-drive');
    const btn2 = document.querySelector('#extract-week-1-btn');

    function clickButton2WhenReady() {
        if (!btn2.disabled) {
            btn2.click();
        } else {
            setTimeout(clickButton2WhenReady, 1000);
        }
    }

    if (btn1) btn1.click();
    setTimeout(clickButton2WhenReady, 2000);
}

// ============================================
// INITIALIZE APP ON DOM LOAD
// ============================================

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('PDF Extractor is ready. Use the buttons above to load PDFs.');
    showLoader();
    
    // Initialize app after a short delay to ensure all elements are available
    setTimeout(initializeApp, 1000);
});

// Fallback: hide loader after 10 seconds
setTimeout(() => {
    hideLoader();
}, 2000);




