/**
 * Sankofa Market - Payment Safety Warnings
 * Reusable warning components for payment safety
 */

// ============================================================================
// PAYMENT WARNING COMPONENTS
// ============================================================================

/**
 * Get standard payment page warning HTML
 */
function getPaymentPageWarning() {
    return `
        <div class="payment-warning">
            <div class="payment-warning-header">
                <i class="fas fa-shield-alt"></i>
                <h3>Important Payment Safety Information</h3>
            </div>
            <div class="payment-warning-content">
                <div class="payment-warning-highlight">
                    <p><i class="fas fa-exclamation-triangle"></i> <strong>Only make payments through the Sankofa Market platform.</strong> Never send money directly to sellers via Mobile Money, bank transfer, or any other method outside our platform.</p>
                </div>
                
                <p><strong>Why this matters:</strong></p>
                <ul>
                    <li>✅ <strong>Escrow Protection:</strong> Your payment is held securely until you confirm delivery</li>
                    <li>✅ <strong>Dispute Resolution:</strong> We can help if there's a problem with your order</li>
                    <li>✅ <strong>Refund Guarantee:</strong> Get your money back if the item doesn't match the listing</li>
                    <li>❌ <strong>No Protection:</strong> Payments made outside the platform are NOT covered</li>
                </ul>
                
                <p><strong>Red flags to watch for:</strong></p>
                <ul>
                    <li>🚩 Seller asks you to pay via MoMo, bank transfer, or cash</li>
                    <li>🚩 Seller offers a "discount" for paying outside the platform</li>
                    <li>🚩 Seller pressures you to complete payment quickly</li>
                    <li>🚩 Seller asks for your personal payment details</li>
                </ul>
                
                <div class="payment-warning-highlight">
                    <p><i class="fas fa-info-circle"></i> If a seller asks you to pay outside the platform, <strong>report them immediately</strong> and do not proceed with the transaction.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Get delivery charges warning HTML
 */
function getDeliveryChargesWarning() {
    return `
        <div class="delivery-warning">
            <i class="fas fa-truck"></i>
            <div class="delivery-warning-content">
                <p><strong>Delivery Charges:</strong> The only payment you make during delivery is the <strong>delivery fee</strong> (if applicable). The item price has already been paid through the platform. Never pay the seller additional amounts during delivery.</p>
            </div>
        </div>
    `;
}

/**
 * Get chat/messaging warning banner HTML
 */
function getChatWarningBanner() {
    return `
        <div class="chat-warning-banner">
            <i class="fas fa-exclamation-triangle"></i>
            <p><strong>Safety Reminder:</strong> Only communicate and make payments through Sankofa Market. Never share personal contact details or pay outside the platform.</p>
        </div>
    `;
}

/**
 * Get contact seller warning HTML (for product detail page)
 */
function getContactSellerWarning() {
    return `
        <div class="payment-warning info">
            <div class="payment-warning-header">
                <i class="fas fa-comments"></i>
                <h3>Contacting the Seller</h3>
            </div>
            <div class="payment-warning-content">
                <p>Use our <strong>secure messaging system</strong> to communicate with sellers. This ensures:</p>
                <ul>
                    <li>✅ All conversations are recorded for dispute resolution</li>
                    <li>✅ Your personal contact information stays private</li>
                    <li>✅ We can help if there are any issues</li>
                </ul>
                
                <div class="payment-warning-highlight">
                    <p><i class="fas fa-shield-alt"></i> <strong>Never share your phone number, email, or payment details in messages.</strong> Keep all communication on the platform for your protection.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Get critical warning for suspicious activity
 */
function getSuspiciousActivityWarning() {
    return `
        <div class="payment-warning critical">
            <div class="payment-warning-header">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Warning: Potential Scam Detected</h3>
            </div>
            <div class="payment-warning-content">
                <div class="payment-warning-highlight">
                    <p><strong>This listing or seller has been flagged for suspicious activity.</strong> Please proceed with extreme caution.</p>
                </div>
                
                <p><strong>Common scam tactics:</strong></p>
                <ul>
                    <li>🚩 Asking for payment outside the platform</li>
                    <li>🚩 Requesting personal information (ID, bank details)</li>
                    <li>🚩 Offering deals that seem too good to be true</li>
                    <li>🚩 Pressuring you to act quickly</li>
                    <li>🚩 Refusing to use the platform's payment system</li>
                </ul>
                
                <p><strong>What you should do:</strong></p>
                <ul>
                    <li>✅ Report this listing using the "Report" button</li>
                    <li>✅ Do NOT send any money or personal information</li>
                    <li>✅ Look for other sellers with verified badges and good reviews</li>
                    <li>✅ Contact our support team if you have concerns</li>
                </ul>
            </div>
        </div>
    `;
}

// ============================================================================
// INJECTION HELPERS
// ============================================================================

/**
 * Inject payment warning into a container
 */
function injectPaymentWarning(containerId, warningType = 'standard') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let warningHtml = '';
    
    switch (warningType) {
        case 'standard':
            warningHtml = getPaymentPageWarning();
            break;
        case 'delivery':
            warningHtml = getDeliveryChargesWarning();
            break;
        case 'chat':
            warningHtml = getChatWarningBanner();
            break;
        case 'contact':
            warningHtml = getContactSellerWarning();
            break;
        case 'suspicious':
            warningHtml = getSuspiciousActivityWarning();
            break;
        default:
            warningHtml = getPaymentPageWarning();
    }
    
    container.innerHTML = warningHtml + container.innerHTML;
}

/**
 * Inject warning before a specific element
 */
function injectWarningBefore(elementId, warningType = 'standard') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let warningHtml = '';
    
    switch (warningType) {
        case 'standard':
            warningHtml = getPaymentPageWarning();
            break;
        case 'delivery':
            warningHtml = getDeliveryChargesWarning();
            break;
        case 'chat':
            warningHtml = getChatWarningBanner();
            break;
        case 'contact':
            warningHtml = getContactSellerWarning();
            break;
        case 'suspicious':
            warningHtml = getSuspiciousActivityWarning();
            break;
        default:
            warningHtml = getPaymentPageWarning();
    }
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = warningHtml;
    element.parentNode.insertBefore(wrapper, element);
}

// Export for use in other files
window.PaymentWarnings = {
    getPaymentPageWarning,
    getDeliveryChargesWarning,
    getChatWarningBanner,
    getContactSellerWarning,
    getSuspiciousActivityWarning,
    injectPaymentWarning,
    injectWarningBefore
};
