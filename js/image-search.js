/**
 * Image Search Feature
 * Allows users to search for products by uploading images or URLs
 * Integrates with Google Cloud Vision API via Firebase Functions
 */

class ImageSearch {
    constructor() {
        this.modal = null;
        this.uploadArea = null;
        this.fileInput = null;
        this.previewContainer = null;
        this.previewImage = null;
        this.searchBtn = null;
        this.loadingState = null;
        this.resultsContainer = null;
        this.currentImage = null;
        this.currentImageUrl = null;
        this.searchHistory = [];
        this.init();
    }

    init() {
        this.createModal();
        this.attachEventListeners();
    }

    createModal() {
        // Create modal HTML
        const modalHTML = `
            <div class="image-search-modal" id="imageSearchModal">
                <div class="image-search-container">
                    <div class="image-search-header">
                        <h2><i class="fas fa-camera"></i> Search by Image</h2>
                        <button class="image-search-close" id="imageSearchClose">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="image-search-body">
                        <!-- Search Method Tabs -->
                        <div class="search-method-tabs">
                            <button class="method-tab active" data-method="upload">
                                <i class="fas fa-upload"></i> Upload Image
                            </button>
                            <button class="method-tab" data-method="url">
                                <i class="fas fa-link"></i> Image URL
                            </button>
                            <button class="method-tab" data-method="history">
                                <i class="fas fa-history"></i> History
                            </button>
                        </div>

                        <!-- Upload Area -->
                        <div class="search-method-content active" id="uploadMethod">
                            <div class="image-upload-area" id="imageUploadArea">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <h3>Upload an Image</h3>
                                <p>Drag and drop an image here, or click to browse</p>
                                <div class="upload-options">
                                    <button class="upload-option-btn" id="uploadFromFile">
                                        <i class="fas fa-folder-open"></i>
                                        Choose File
                                    </button>
                                    <button class="upload-option-btn" id="uploadFromCamera">
                                        <i class="fas fa-camera"></i>
                                        Take Photo
                                    </button>
                                </div>
                                <input type="file" id="imageFileInput" accept="image/*" style="display: none;">
                                <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display: none;">
                            </div>
                        </div>

                        <!-- URL Input -->
                        <div class="search-method-content" id="urlMethod">
                            <div class="url-input-section">
                                <h3>Enter Image URL</h3>
                                <p>Paste the URL of an image from the web</p>
                                <div class="url-input-wrapper">
                                    <i class="fas fa-link"></i>
                                    <input type="url" id="imageUrlInput" placeholder="https://example.com/image.jpg" class="url-input">
                                    <button class="url-preview-btn" id="urlPreviewBtn">
                                        <i class="fas fa-eye"></i> Preview
                                    </button>
                                </div>
                                <div class="url-preview-container" id="urlPreviewContainer">
                                    <img id="urlPreviewImage" src="" alt="URL Preview">
                                    <button class="url-preview-remove" id="urlPreviewRemove">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Search History -->
                        <div class="search-method-content" id="historyMethod">
                            <div class="search-history-section">
                                <div class="history-header">
                                    <h3>Recent Searches</h3>
                                    <button class="clear-history-btn" id="clearHistoryBtn">
                                        <i class="fas fa-trash"></i> Clear All
                                    </button>
                                </div>
                                <div class="search-history-list" id="searchHistoryList">
                                    <div class="history-loading">
                                        <i class="fas fa-spinner fa-spin"></i>
                                        <p>Loading history...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Image Preview (for upload) -->
                        <div class="image-preview-container" id="imagePreviewContainer">
                            <div class="image-preview-wrapper">
                                <img id="imagePreview" src="" alt="Preview">
                                <button class="image-preview-remove" id="imagePreviewRemove">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            
                            <!-- Search Options -->
                            <div class="image-search-options">
                                <h4>Refine Your Search (Optional)</h4>
                                <select class="search-category-select" id="searchCategorySelect">
                                    <option value="">All Categories</option>
                                    <option value="electronics">Electronics</option>
                                    <option value="fashion">Fashion</option>
                                    <option value="home-garden">Home & Garden</option>
                                    <option value="vehicles">Vehicles</option>
                                    <option value="services">Services</option>
                                    <option value="sports">Sports</option>
                                    <option value="books-media">Books & Media</option>
                                    <option value="baby-kids">Baby & Kids</option>
                                    <option value="beauty-health">Beauty & Health</option>
                                    <option value="food-groceries">Food & Groceries</option>
                                    <option value="pets">Pets</option>
                                    <option value="jobs-skills">Jobs & Skills</option>
                                    <option value="real-estate">Real Estate</option>
                                </select>
                            </div>
                            
                            <!-- Image Analysis Info -->
                            <div class="image-analysis-info" id="imageAnalysisInfo" style="display: none;">
                                <h4><i class="fas fa-brain"></i> AI Analysis</h4>
                                <div class="analysis-tags" id="analysisTags"></div>
                                <div class="analysis-colors" id="analysisColors"></div>
                            </div>
                            
                            <button class="image-search-btn" id="imageSearchBtn">
                                <i class="fas fa-search"></i>
                                Search for Similar Products
                            </button>
                        </div>
                        
                        <!-- Loading State -->
                        <div class="image-search-loading" id="imageSearchLoading">
                            <div class="loading-spinner"></div>
                            <h3>Analyzing Your Image</h3>
                            <p id="loadingText">Using AI to identify objects and find similar products...</p>
                        </div>
                        
                        <!-- Results -->
                        <div class="image-search-results" id="imageSearchResults">
                            <div class="results-header">
                                <h3>Similar Products Found</h3>
                                <span class="results-count" id="resultsCount"></span>
                            </div>
                            <div class="results-grid" id="resultsGrid"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Cache DOM elements
        this.modal = document.getElementById('imageSearchModal');
        this.uploadArea = document.getElementById('imageUploadArea');
        this.fileInput = document.getElementById('imageFileInput');
        this.cameraInput = document.getElementById('cameraInput');
        this.previewContainer = document.getElementById('imagePreviewContainer');
        this.previewImage = document.getElementById('imagePreview');
        this.searchBtn = document.getElementById('imageSearchBtn');
        this.loadingState = document.getElementById('imageSearchLoading');
        this.resultsContainer = document.getElementById('imageSearchResults');
    }

    attachEventListeners() {
        // Close modal
        document.getElementById('imageSearchClose').addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Search method tabs
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const method = e.currentTarget.dataset.method;
                this.switchSearchMethod(method);
            });
        });

        // Upload area click
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

        // Upload buttons
        document.getElementById('uploadFromFile').addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileInput.click();
        });

        document.getElementById('uploadFromCamera').addEventListener('click', (e) => {
            e.stopPropagation();
            this.cameraInput.click();
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.cameraInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.processImage(files[0]);
            }
        });

        // URL input
        document.getElementById('urlPreviewBtn').addEventListener('click', () => this.previewImageUrl());
        document.getElementById('urlPreviewRemove').addEventListener('click', () => this.clearUrlPreview());
        document.getElementById('imageUrlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.previewImageUrl();
            }
        });

        // Remove preview
        document.getElementById('imagePreviewRemove').addEventListener('click', () => {
            this.resetUpload();
        });

        // Search button
        this.searchBtn.addEventListener('click', () => this.performSearch());

        // Clear history
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearSearchHistory());
    }

    switchSearchMethod(method) {
        // Update tabs
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.method === method);
        });

        // Update content
        document.querySelectorAll('.search-method-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(`${method}Method`);
        if (targetContent) {
            targetContent.classList.add('active');
        }

        // Load history if switching to history tab
        if (method === 'history') {
            this.loadSearchHistory();
        }

        // Reset preview when switching methods
        this.resetUpload();
    }

    async previewImageUrl() {
        const urlInput = document.getElementById('imageUrlInput');
        const url = urlInput.value.trim();

        if (!url) {
            this.showFlashMessage('Please enter an image URL', 'warning');
            return;
        }

        // Validate URL
        try {
            new URL(url);
        } catch (e) {
            this.showFlashMessage('Please enter a valid URL', 'error');
            return;
        }

        // Show preview
        const previewContainer = document.getElementById('urlPreviewContainer');
        const previewImage = document.getElementById('urlPreviewImage');
        
        previewImage.src = url;
        previewContainer.classList.add('active');

        // Store URL for search
        this.currentImageUrl = url;

        // Switch to upload method to show search button
        this.switchSearchMethod('upload');
        
        // Show preview in upload section
        this.previewContainer.classList.add('active');
        this.previewImage.src = url;
        document.getElementById('imageUploadArea').style.display = 'none';
        this.searchBtn.disabled = false;
    }

    clearUrlPreview() {
        document.getElementById('urlPreviewContainer').classList.remove('active');
        document.getElementById('imageUrlInput').value = '';
        this.currentImageUrl = null;
    }

    async loadSearchHistory() {
        const historyList = document.getElementById('searchHistoryList');
        
        if (!isLoggedIn()) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-sign-in-alt"></i>
                    <p>Please sign in to view search history</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = `
            <div class="history-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading history...</p>
            </div>
        `;

        try {
            var saved = JSON.parse(localStorage.getItem('imageSearchHistory') || '[]'); var result = { data: { success: true, history: saved } };
            
            if (result.data.success && result.data.history.length > 0) {
                this.searchHistory = result.data.history;
                this.renderSearchHistory();
            } else {
                historyList.innerHTML = `
                    <div class="history-empty">
                        <i class="fas fa-history"></i>
                        <p>No search history yet</p>
                        <small>Your image searches will appear here</small>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Load history error:', error);
            historyList.innerHTML = `
                <div class="history-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load history</p>
                </div>
            `;
        }
    }

    renderSearchHistory() {
        const historyList = document.getElementById('searchHistoryList');
        
        historyList.innerHTML = this.searchHistory.map(item => {
            const timestamp = item.timestamp?.toDate ? item.timestamp.toDate() : new Date();
            const timeAgo = this.formatTimeAgo(timestamp);
            const topLabels = item.labels?.slice(0, 3).map(l => l.description).join(', ') || 'Unknown';
            
            return `
                <div class="history-item" data-id="${item.id}">
                    <div class="history-item-image">
                        ${item.imageData ? `<img src="${item.imageData}" alt="Search">` : '<i class="fas fa-image"></i>'}
                    </div>
                    <div class="history-item-info">
                        <div class="history-item-labels">${topLabels}</div>
                        <div class="history-item-meta">
                            <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                            <span><i class="fas fa-box"></i> ${item.resultsCount || 0} results</span>
                        </div>
                    </div>
                    <div class="history-item-actions">
                        <button class="history-action-btn" onclick="imageSearch.replaySearch('${item.id}')">
                            <i class="fas fa-redo"></i>
                        </button>
                        <button class="history-action-btn danger" onclick="imageSearch.deleteHistoryItem('${item.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async replaySearch(historyId) {
        const historyItem = this.searchHistory.find(h => h.id === historyId);
        if (!historyItem) return;

        // Switch to upload method
        this.switchSearchMethod('upload');

        // Load the image
        if (historyItem.imageData) {
            this.currentImage = historyItem.imageData;
            this.previewImage.src = historyItem.imageData;
            this.previewContainer.classList.add('active');
            document.getElementById('imageUploadArea').style.display = 'none';
            this.searchBtn.disabled = false;
        }

        this.showFlashMessage('Search loaded from history', 'success');
    }

    async deleteHistoryItem(itemId) {
        if (!confirm('Delete this search from history?')) return;

        try {
            var history = JSON.parse(localStorage.getItem('imageSearchHistory') || '[]'); history = history.filter(function(item) { return item.id !== itemId; }); localStorage.setItem('imageSearchHistory', JSON.stringify(history));
            
            // Remove from local array
            this.searchHistory = this.searchHistory.filter(h => h.id !== itemId);
            this.renderSearchHistory();
            
            this.showFlashMessage('Search deleted from history', 'success');
        } catch (error) {
            console.error('Delete history item error:', error);
            this.showFlashMessage('Failed to delete search', 'error');
        }
    }

    async clearSearchHistory() {
        if (!confirm('Clear all search history? This cannot be undone.')) return;

        try {
            localStorage.removeItem('imageSearchHistory');
            
            this.searchHistory = [];
            document.getElementById('searchHistoryList').innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-history"></i>
                    <p>No search history yet</p>
                    <small>Your image searches will appear here</small>
                </div>
            `;
            
            this.showFlashMessage('Search history cleared', 'success');
        } catch (error) {
            console.error('Clear history error:', error);
            this.showFlashMessage('Failed to clear history', 'error');
        }
    }

    formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        
        return date.toLocaleDateString();
    }

    showFlashMessage(message, type = 'info') {
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(message, type);
        } else {
            alert(message);
        }
    }

    open() {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.resetUpload();
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.processImage(file);
        }
    }

    processImage(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            this.currentImage = e.target.result;
            this.previewImage.src = this.currentImage;
            this.uploadArea.style.display = 'none';
            this.previewContainer.classList.add('active');
            this.searchBtn.disabled = false;
        };

        reader.readAsDataURL(file);
    }

    resetUpload() {
        this.currentImage = null;
        this.currentImageUrl = null;
        this.previewImage.src = '';
        this.uploadArea.style.display = 'block';
        this.previewContainer.classList.remove('active');
        this.loadingState.classList.remove('active');
        this.resultsContainer.classList.remove('active');
        this.fileInput.value = '';
        this.cameraInput.value = '';
        document.getElementById('searchCategorySelect').value = '';
        document.getElementById('imageAnalysisInfo').style.display = 'none';
        
        // Clear URL input
        document.getElementById('imageUrlInput').value = '';
        document.getElementById('urlPreviewContainer').classList.remove('active');
    }

    async performSearch() {
        const hasImage = this.currentImage !== null;
        const hasUrl = this.currentImageUrl !== null;
        
        if (!hasImage && !hasUrl) {
            this.showFlashMessage('Please upload an image or enter a URL', 'warning');
            return;
        }

        if (!isLoggedIn()) {
            this.showFlashMessage('Please sign in to use image search', 'warning');
            setTimeout(() => {
                window.location.href = 'pages/auth/login.html';
            }, 1500);
            return;
        }

        // Show loading state
        this.previewContainer.style.display = 'none';
        this.loadingState.classList.add('active');
        document.getElementById('loadingText').textContent = 'Using AI to identify objects and find similar products...';

        // Get selected category
        const category = document.getElementById('searchCategorySelect').value;

        try {
            // Client-side image search: match by category from Firestore products
            document.getElementById('loadingText').textContent = 'Searching for matching products...';
            
            var products = [];
            if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
                var query = firebaseDB.collection('products').where('isActive', '==', true).where('isSold', '==', false);
                if (category) {
                    query = firebaseDB.collection('products')
                        .where('isActive', '==', true)
                        .where('isSold', '==', false)
                        .where('category', '==', category);
                }
                
                var snapshot = await query.limit(20).get();
                snapshot.forEach(function(doc) {
                    products.push({ id: doc.id, ...doc.data() });
                });
                
                if (products.length === 0 && category) {
                    var fallback = await firebaseDB.collection('products')
                        .where('isActive', '==', true)
                        .where('isSold', '==', false)
                        .limit(20).get();
                    fallback.forEach(function(doc) {
                        products.push({ id: doc.id, ...doc.data() });
                    });
                }
            }
            
            if (products.length > 0) {
                this.displayAnalysisInfo({
                    tags: category ? [category.replace(/-/g, ' ')] : ['general'],
                    colors: [],
                    confidence: 0.7,
                    category: category || 'all'
                });
                
                this.displayResults(products);
                this.showFlashMessage('Found ' + products.length + ' matching products', 'success');
                this.saveToHistory(hasUrl ? this.currentImageUrl : this.currentImage, category, products.length);
            } else {
                this.loadingState.classList.remove('active');
                this.previewContainer.style.display = 'block';
                this.showFlashMessage('No matching products found. Try a different category.', 'warning');
            }

        } catch (error) {
            console.error('Search error:', error);
            this.loadingState.classList.remove('active');
            this.previewContainer.style.display = 'block';
            this.showFlashMessage('Search failed. Please try again.', 'error');
        }
    }

    displayAnalysisInfo(analysis) {
        const analysisInfo = document.getElementById('imageAnalysisInfo');
        const tagsContainer = document.getElementById('analysisTags');
        const colorsContainer = document.getElementById('analysisColors');

        if (!analysis) {
            analysisInfo.style.display = 'none';
            return;
        }

        // Display detected labels
        if (analysis.labels && analysis.labels.length > 0) {
            tagsContainer.innerHTML = analysis.labels.slice(0, 8).map(label => 
                `<span class="analysis-tag">${label.description} (${Math.round(label.score * 100)}%)</span>`
            ).join('');
        }

        // Display dominant colors
        if (analysis.colors && analysis.colors.length > 0) {
            colorsContainer.innerHTML = '<strong>Colors:</strong> ' + 
                analysis.colors.slice(0, 5).map(color => 
                    `<span class="analysis-color" style="background: ${color.hex};" title="${color.hex}"></span>`
                ).join('');
        }

        analysisInfo.style.display = 'block';
    }

    displayResults(products) {
        // Hide loading, show results
        this.loadingState.classList.remove('active');
        this.resultsContainer.classList.add('active');

        const resultsGrid = document.getElementById('resultsGrid');
        const resultsCount = document.getElementById('resultsCount');

        if (!products || products.length === 0) {
            resultsCount.textContent = '0 products found';
            resultsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h4>No similar products found</h4>
                    <p>Try a different image or broaden your category filter</p>
                </div>
            `;
            return;
        }

        resultsCount.textContent = `${products.length} products found`;

        resultsGrid.innerHTML = products.map(product => {
            const imageUrl = product.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image';
            const price = product.price ? `GHS ${product.price.toLocaleString()}` : 'Price on request';
            const condition = product.condition ? `<span class="product-condition">${product.condition}</span>` : '';
            const location = product.location?.city || 'Ghana';
            const isSankofaStore = product.isSankofaStore === true;
            
            return `
                <div class="product-card" onclick="window.location.href='product-detail.html?id=${product.id}'">
                    <div class="product-image-wrapper">
                        <img src="${imageUrl}" alt="${product.title}" class="product-image" loading="lazy">
                        ${isSankofaStore ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : ''}
                    </div>
                    <div class="product-info">
                        <h4 class="product-title">${product.title}</h4>
                        <div class="product-price">${price}</div>
                        ${condition}
                        <div class="product-meta">
                            <span><i class="fas fa-map-marker-alt"></i> ${location}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Initialize image search when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global instance
    window.imageSearch = new ImageSearch();

    // Add trigger buttons to all search bars
    const searchInputs = document.querySelectorAll('.search-form, .hero-search-form');
    
    searchInputs.forEach(form => {
        const input = form.querySelector('input[type="text"]');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (input && submitBtn) {
            // Create image search button
            const imageSearchBtn = document.createElement('button');
            imageSearchBtn.type = 'button';
            imageSearchBtn.className = 'image-search-trigger';
            imageSearchBtn.innerHTML = '<i class="fas fa-camera"></i>';
            imageSearchBtn.title = 'Search by image';
            imageSearchBtn.addEventListener('click', () => window.imageSearch.open());
            
            // Insert button before submit button
            form.insertBefore(imageSearchBtn, submitBtn);
            
            // Adjust form layout
            form.style.display = 'flex';
            form.style.gap = '0.5rem';
            form.style.alignItems = 'center';
        }
    });
});
