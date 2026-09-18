/* ============================================================================
   SANKOFA MARKET - USER LISTINGS PAGE
   ============================================================================ */

document.addEventListener('DOMContentLoaded', function() {
    initListingFilters();
});

/* ---- Filter Tabs ---- */
function initListingFilters() {
    const tabs = document.querySelectorAll('.filter-tab');
    const listings = document.querySelectorAll('.listing-card');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const filter = this.dataset.filter;

            listings.forEach(listing => {
                if (filter === 'all' || listing.dataset.status === filter) {
                    listing.style.display = '';
                } else {
                    listing.style.display = 'none';
                }
            });
        });
    });
}

/* ---- Listing Actions ---- */
function editListing(listingId) {
    showListingNotification('Opening editor for listing...', 'info');
    // In production: navigate to edit page
    // window.location.href = '../../publish.html?edit=' + listingId;
}

function deleteListing(listingId) {
    if (confirm('Are you sure you want to delete this listing?\n\nThis action cannot be undone.')) {
        const card = document.querySelector(`[data-id="${listingId}"]`) || 
                     document.querySelectorAll('.listing-card')[Array.from(document.querySelectorAll('.listing-card')).findIndex(c => c.onclick?.toString().includes(listingId))];
        
        // Animate removal
        if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => card.remove(), 300);
        }
        
        showListingNotification('Listing deleted successfully.', 'success');
    }
}

function relistItem(listingId) {
    showListingNotification('Creating new listing from sold item...', 'info');
    // In production: duplicate the listing as a new draft
}

function publishDraft(listingId) {
    showListingNotification('Publishing draft...', 'info');
    // In production: publish the draft via API
    setTimeout(() => {
        showListingNotification('Listing published successfully!', 'success');
    }, 1000);
}

function appealFlag(listingId) {
    const reason = prompt('Please explain why you believe this listing should not be flagged:');
    if (reason && reason.trim().length > 10) {
        showListingNotification('Appeal submitted. Our team will review within 24-48 hours.', 'success');
    } else if (reason !== null) {
        showListingNotification('Please provide a detailed reason (at least 10 characters).', 'warning');
    }
}

/* ---- Notification System ---- */
function showListingNotification(message, type = 'info') {
    document.querySelectorAll('.listing-notification').forEach(n => n.remove());
    
    const icons = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-circle',
        error: 'fa-times-circle'
    };
    
    const colors = {
        info: 'var(--primary-color)',
        success: 'var(--success-color)',
        warning: 'var(--accent-color)',
        error: 'var(--error-color)'
    };
    
    const notification = document.createElement('div');
    notification.className = 'listing-notification';
    notification.style.cssText = `
        position: fixed; top: 1rem; right: 1rem; z-index: 10000;
        background: white; padding: 1rem 1.5rem; border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 0.75rem;
        border-left: 4px solid ${colors[type]}; max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 1.25rem;"></i>
        <span style="font-size: 0.9rem;">${message}</span>
    `;
    
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
