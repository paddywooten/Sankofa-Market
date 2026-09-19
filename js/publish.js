/**
 * Sankofa Market - Publish Page JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    initPhotoUpload();
    initCharCounters();
    initDeliveryOptions();
    initFormSubmission();
});

// ============================================================================
// PHOTO UPLOAD
// ============================================================================

function initPhotoUpload() {
    const photoInput = document.getElementById('photoInput');
    const photoGrid = document.getElementById('photoGrid');
    const uploadBtn = document.getElementById('photoUploadBtn');
    let photos = [];
    
    photoInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        
        if (photos.length + files.length > 8) {
            showFlashMessage('Maximum 8 photos allowed', 'warning');
            return;
        }
        
        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                photos.push(event.target.result);
                renderPhotos();
            };
            reader.readAsDataURL(file);
        });
        
        // Reset input so same file can be selected again
        this.value = '';
    });
    
    function renderPhotos() {
        // Clear existing previews (keep upload button)
        const previews = photoGrid.querySelectorAll('.photo-preview');
        previews.forEach(p => p.remove());
        
        photos.forEach((photo, index) => {
            const preview = document.createElement('div');
            preview.className = 'photo-preview';
            preview.innerHTML = `
                <img src="${photo}" alt="Photo ${index + 1}" loading="lazy">
                <button type="button" class="remove-photo" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
                ${index === 0 ? '<span class="cover-badge">Cover</span>' : ''}
            `;
            photoGrid.insertBefore(preview, uploadBtn);
        });
        
        // Hide upload button if max reached
        uploadBtn.style.display = photos.length >= 8 ? 'none' : 'flex';
        
        // Add remove handlers
        photoGrid.querySelectorAll('.remove-photo').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                photos.splice(index, 1);
                renderPhotos();
            });
        });
    }
    
    // Expose photos for form submission
    window.uploadedPhotos = photos;
}

// ============================================================================
// CHARACTER COUNTERS
// ============================================================================

function initCharCounters() {
    const titleInput = document.getElementById('title');
    const descInput = document.getElementById('description');
    const titleCount = document.getElementById('titleCount');
    const descCount = document.getElementById('descCount');
    
    titleInput.addEventListener('input', () => {
        titleCount.textContent = titleInput.value.length;
    });
    
    descInput.addEventListener('input', () => {
        descCount.textContent = descInput.value.length;
    });
}

// ============================================================================
// DELIVERY OPTIONS
// ============================================================================

function initDeliveryOptions() {
    const paidDeliveryCheckbox = document.getElementById('paidDelivery');
    const deliveryFeeSection = document.getElementById('deliveryFeeSection');
    const deliveryFeeInput = document.getElementById('deliveryFee');

    if (!paidDeliveryCheckbox || !deliveryFeeSection) return;

    paidDeliveryCheckbox.addEventListener('change', function() {
        if (this.checked) {
            deliveryFeeSection.style.display = 'block';
            deliveryFeeInput.setAttribute('required', 'required');
        } else {
            deliveryFeeSection.style.display = 'none';
            deliveryFeeInput.removeAttribute('required');
            deliveryFeeInput.value = '';
            document.getElementById('deliveryAreas').value = '';
        }
    });

    // Initialize on page load
    if (paidDeliveryCheckbox.checked) {
        deliveryFeeSection.style.display = 'block';
    }
}

// ============================================================================
// FORM SUBMISSION
// ============================================================================

function initFormSubmission() {
    const form = document.getElementById('publishForm');
    const publishBtn = document.getElementById('publishBtn');
    const saveDraftBtn = document.getElementById('saveDraftBtn');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validate
        if (!validateForm()) return;
        
        // Check if user is logged in
        if (!isLoggedIn()) {
            showFlashMessage('Please sign in to publish a listing', 'warning');
            setTimeout(() => {
                window.location.href = 'pages/auth/login.html?redirect=publish.html';
            }, 1500);
            return;
        }
        
        // Check if user account is approved
        if (typeof firebaseAuth !== 'undefined' && typeof firebaseDB !== 'undefined') {
            const user = firebaseAuth.currentUser;
            if (user) {
                const userDoc = await firebaseDB.collection('users').doc(user.uid).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    
                    if (userData.status === 'pending') {
                        showFlashMessage('⚠️ Your account is pending admin approval. Please wait for an admin to approve your account before publishing listings.', 'warning');
                        console.warn('Account status: pending - cannot publish');
                        return;
                    } else if (userData.status === 'rejected') {
                        showFlashMessage('Your account registration was rejected. Please contact support for more information.', 'error');
                        return;
                    }
                }
            }
        }
        
        // Collect form data
        const formData = collectFormData();
        
        // Show loading state
        const stopLoading = showLoading(publishBtn);
        
        try {
            if (typeof firebaseDB !== 'undefined') {
                // Upload to Firebase
                console.log('📤 Publishing to Firebase...', formData);
                await publishToFirebase(formData);
                console.log('✅ Published successfully!');
            } else {
                // Demo mode - simulate success
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            showFlashMessage('Listing published successfully! 🎉', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } catch (error) {
            console.error('Publish error:', error);
            showFlashMessage('Error publishing listing. Please try again.', 'error');
        } finally {
            stopLoading();
        }
    });
    
    saveDraftBtn.addEventListener('click', function() {
        const formData = collectFormData();
        localStorage.setItem('sankofa_draft', JSON.stringify(formData));
        showFlashMessage('Draft saved!', 'success');
    });
    
    // Load draft if exists
    const draft = localStorage.getItem('sankofa_draft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            if (data.title) document.getElementById('title').value = data.title;
            if (data.category) document.getElementById('category').value = data.category;
            if (data.description) document.getElementById('description').value = data.description;
            if (data.price) document.getElementById('price').value = data.price;
            if (data.city) document.getElementById('city').value = data.city;
            if (data.region) document.getElementById('region').value = data.region;
            
            // Load delivery options
            if (data.deliveryOptions && Array.isArray(data.deliveryOptions)) {
                if (data.deliveryOptions.includes('free-delivery')) {
                    document.getElementById('freeDelivery').checked = true;
                }
                if (data.deliveryOptions.includes('paid-delivery')) {
                    document.getElementById('paidDelivery').checked = true;
                    document.getElementById('deliveryFee').value = data.deliveryFee || '';
                    document.getElementById('deliveryFeeSection').style.display = 'block';
                }
                if (data.deliveryOptions.includes('pickup')) {
                    document.getElementById('pickupOnly').checked = true;
                }
                if (data.deliveryAreas) {
                    document.getElementById('deliveryAreas').value = data.deliveryAreas;
                }
            }
            
            // Update counters
            document.getElementById('titleCount').textContent = data.title?.length || 0;
            document.getElementById('descCount').textContent = data.description?.length || 0;
        } catch (e) {}
    }
}

function validateForm() {
    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('category').value;
    const condition = document.querySelector('input[name="condition"]:checked');
    const description = document.getElementById('description').value.trim();
    const price = document.getElementById('price').value;
    const region = document.getElementById('region').value;
    const city = document.getElementById('city').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    // Check if at least one delivery option is selected
    const freeDelivery = document.getElementById('freeDelivery').checked;
    const paidDelivery = document.getElementById('paidDelivery').checked;
    const pickupOnly = document.getElementById('pickupOnly').checked;
    
    if (!freeDelivery && !paidDelivery && !pickupOnly) {
        showFlashMessage('Please select at least one delivery option', 'error');
        return false;
    }
    
    // Validate delivery fee if paid delivery is selected
    if (paidDelivery) {
        const deliveryFee = document.getElementById('deliveryFee').value;
        if (!deliveryFee || deliveryFee < 0) {
            showFlashMessage('Please enter a valid delivery fee', 'error');
            return false;
        }
    }
    
    if (!title) {
        showFlashMessage('Please enter a title', 'error');
        return false;
    }
    if (!category) {
        showFlashMessage('Please select a category', 'error');
        return false;
    }
    if (!condition) {
        showFlashMessage('Please select the condition', 'error');
        return false;
    }
    if (!description) {
        showFlashMessage('Please add a description', 'error');
        return false;
    }
    if (!price || price < 1) {
        showFlashMessage('Please enter a valid price', 'error');
        return false;
    }
    if (!region) {
        showFlashMessage('Please select a region', 'error');
        return false;
    }
    if (!city) {
        showFlashMessage('Please enter your city', 'error');
        return false;
    }
    if (!phone) {
        showFlashMessage('Please enter your phone number', 'error');
        return false;
    }
    
    return true;
}

function collectFormData() {
    const deliveryOptions = [];
    if (document.getElementById('freeDelivery').checked) {
        deliveryOptions.push('free-delivery');
    }
    if (document.getElementById('paidDelivery').checked) {
        deliveryOptions.push('paid-delivery');
    }
    if (document.getElementById('pickupOnly').checked) {
        deliveryOptions.push('pickup');
    }

    return {
        title: document.getElementById('title').value.trim(),
        category: document.getElementById('category').value,
        condition: document.querySelector('input[name="condition"]:checked')?.value,
        description: document.getElementById('description').value.trim(),
        price: parseInt(document.getElementById('price').value),
        negotiable: document.getElementById('negotiable').checked,
        region: document.getElementById('region').value,
        city: document.getElementById('city').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        showPhone: document.getElementById('showPhone').checked,
        deliveryOptions: deliveryOptions,
        deliveryFee: document.getElementById('paidDelivery').checked ? parseFloat(document.getElementById('deliveryFee').value) : null,
        deliveryAreas: document.getElementById('deliveryAreas').value.trim(),
        photos: window.uploadedPhotos || [],
        createdAt: new Date().toISOString()
    };
}

async function publishToFirebase(data) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Not authenticated');
    
    // Upload photos to storage
    const photoURLs = [];
    for (let i = 0; i < data.photos.length; i++) {
        const url = await uploadPhotoToStorage(data.photos[i], user.uid, i);
        photoURLs.push(url);
    }
    
    // Create product document
    const productData = {
        ...data,
        photos: photoURLs,
        images: photoURLs,
        sellerId: user.uid,
        isActive: true,
        isSold: false,
        isFeatured: false,
        views: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await firebaseDB.collection('products').add(productData);
}

async function uploadPhotoToStorage(dataUrl, userId, index) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const path = `products/${userId}/${Date.now()}_${index}.jpg`;
    const result = await uploadFile(blob, path);
    return result.url;
}
