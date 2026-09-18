/**
 * Image Search Feature
 * Allows users to search for products by uploading images
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
                        <!-- Upload Area -->
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
                        
                        <!-- Image Preview -->
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
                            
                            <button class="image-search-btn" id="imageSearchBtn">
                                <i class="fas fa-search"></i>
                                Search for Similar Products
                            </button>
                        </div>
                        
                        <!-- Loading State -->
                        <div class="image-search-loading" id="imageSearchLoading">
                            <div class="loading-spinner"></div>
                            <h3>Analyzing Your Image</h3>
                            <p>Finding similar products...</p>
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

        // Remove preview
        document.getElementById('imagePreviewRemove').addEventListener('click', () => {
            this.resetUpload();
        });

        // Search button
        this.searchBtn.addEventListener('click', () => this.performSearch());
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
        this.previewImage.src = '';
        this.uploadArea.style.display = 'block';
        this.previewContainer.classList.remove('active');
        this.loadingState.classList.remove('active');
        this.resultsContainer.classList.remove('active');
        this.fileInput.value = '';
        this.cameraInput.value = '';
        document.getElementById('searchCategorySelect').value = '';
    }

    async performSearch() {
        if (!this.currentImage) return;

        // Show loading state
        this.previewContainer.style.display = 'none';
        this.loadingState.classList.add('active');

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get selected category
        const category = document.getElementById('searchCategorySelect').value;

        // Perform search (demo implementation)
        const results = await this.searchByImage(this.currentImage, category);

        // Hide loading, show results
        this.loadingState.classList.remove('active');
        this.displayResults(results);
    }

    async searchByImage(imageData, category) {
        // Demo implementation - in production, this would call an AI/ML service
        // For now, we'll return random products with optional category filtering
        
        const demoProducts = this.getDemoProducts();
        let filtered = demoProducts;

        // Filter by category if selected
        if (category) {
            filtered = filtered.filter(p => p.category === category);
        }

        // If no results in category, show all products
        if (filtered.length === 0) {
            filtered = demoProducts;
        }

        // Shuffle and return random subset
        return this.shuffleArray(filtered).slice(0, 8);
    }

    getDemoProducts() {
        return [
            {
                id: 'img1',
                title: 'iPhone 14 Pro Max - 256GB - Deep Purple',
                price: 8500,
                image: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'electronics',
                condition: 'new',
                location: { city: 'Accra' },
                sellerName: 'Sankofa Store',
                isSankofaStore: true
            },
            {
                id: 'img2',
                title: 'Samsung 55" 4K Smart TV - Crystal UHD',
                price: 3200,
                image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'electronics',
                condition: 'like-new',
                location: { city: 'Kumasi' },
                sellerName: 'Kwame Asante'
            },
            {
                id: 'img3',
                title: 'Leather Sofa Set - 3 Pieces - Premium',
                price: 2800,
                image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'home-garden',
                condition: 'good',
                location: { city: 'Tema' },
                sellerName: 'Ama Boateng'
            },
            {
                id: 'img4',
                title: 'Nike Air Jordan Retro - Size 42',
                price: 800,
                image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'fashion',
                condition: 'like-new',
                location: { city: 'Accra' },
                sellerName: 'Kofi Mensah'
            },
            {
                id: 'img5',
                title: 'Canon EOS R6 - Full Frame + Lens Kit',
                price: 14500,
                image: 'https://images.unsplash.com/photo-1606986628253-49e940572d03?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'electronics',
                condition: 'like-new',
                location: { city: 'Kumasi' },
                sellerName: 'Sankofa Store',
                isSankofaStore: true
            },
            {
                id: 'img6',
                title: 'MacBook Pro 2023 - M2 Chip - 16GB RAM',
                price: 12500,
                image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'electronics',
                condition: 'new',
                location: { city: 'Accra' },
                sellerName: 'Sankofa Store',
                isSankofaStore: true
            },
            {
                id: 'img7',
                title: 'African Print Ankara Dress - Handmade',
                price: 250,
                image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'fashion',
                condition: 'new',
                location: { city: 'Kumasi' },
                sellerName: 'Abena Osei'
            },
            {
                id: 'img8',
                title: 'PlayStation 5 - 2 Controllers + 5 Games',
                price: 6500,
                image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'electronics',
                condition: 'new',
                location: { city: 'Accra' },
                sellerName: 'Sankofa Store',
                isSankofaStore: true
            },
            {
                id: 'img9',
                title: 'Solid Wood Dining Table - 6 Chairs Set',
                price: 1800,
                image: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'home-garden',
                condition: 'good',
                location: { city: 'Takoradi' },
                sellerName: 'Yaw Darkwa'
            },
            {
                id: 'img10',
                title: 'Apple Watch Series 8 - GPS + Cellular',
                price: 2200,
                image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=350&h=260&fit=crop&q=75&auto=format',
                category: 'electronics',
                condition: 'new',
                location: { city: 'Accra' },
                sellerName: 'Efua Adjei'
            }
        ];
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    displayResults(results) {
        const resultsGrid = document.getElementById('resultsGrid');
        const resultsCount = document.getElementById('resultsCount');

        resultsCount.textContent = `${results.length} products found`;

        resultsGrid.innerHTML = results.map(product => `
            <a href="product-detail.html?id=${product.id}" class="product-card">
                <div class="product-image-wrapper">
                    <img src="${product.image}" alt="${product.title}" class="product-image" loading="lazy" decoding="async">
                    ${product.isSankofaStore ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : ''}
                </div>
                <div class="product-content">
                    <div class="product-title">${product.title}</div>
                    <div class="product-price">GHS ${product.price.toLocaleString()}</div>
                    <div class="product-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${product.location.city}</span>
                        <span><i class="fas fa-tag"></i> ${product.condition}</span>
                    </div>
                </div>
            </a>
        `).join('');

        this.resultsContainer.classList.add('active');
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

    // Add to header actions if exists
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        const imageSearchHeaderBtn = document.createElement('button');
        imageSearchHeaderBtn.type = 'button';
        imageSearchHeaderBtn.className = 'image-search-trigger';
        imageSearchHeaderBtn.innerHTML = '<i class="fas fa-camera"></i>';
        imageSearchHeaderBtn.title = 'Search by image';
        imageSearchHeaderBtn.addEventListener('click', () => window.imageSearch.open());
        
        // Insert at the beginning
        headerActions.insertBefore(imageSearchHeaderBtn, headerActions.firstChild);
    }
});
