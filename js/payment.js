/**
 * Payment Page JavaScript
 * Handles payment processing and form validation
 */

document.addEventListener('DOMContentLoaded', function() {
    initPaymentPage();
});

function initPaymentPage() {
    // Load order from cart
    loadOrderFromCart();
    
    // Initialize payment method switching
    initPaymentMethodSwitching();
    
    // Initialize form validation
    initFormValidation();
    
    // Initialize payment processing
    initPaymentProcessing();
    
    // Initialize card number formatting
    initCardFormatting();
}

// ============================================================================
// LOAD ORDER FROM CART
// ============================================================================

function loadOrderFromCart() {
    // Get cart from localStorage
    const cartData = localStorage.getItem('sankofa_cart');
    
    if (!cartData) {
        showFlashMessage('Your cart is empty', 'warning');
        setTimeout(() => {
            window.location.href = 'search.html';
        }, 2000);
        return;
    }

    const cart = JSON.parse(cartData);
    
    if (cart.items.length === 0) {
        showFlashMessage('Your cart is empty', 'warning');
        setTimeout(() => {
            window.location.href = 'search.html';
        }, 2000);
        return;
    }

    // Display order items
    displayOrderItems(cart.items);
    
    // Calculate and display totals
    calculateTotals(cart.items);
}

function displayOrderItems(items) {
    const orderItemsContainer = document.getElementById('orderItems');
    
    orderItemsContainer.innerHTML = items.map(item => `
        <div class="order-item">
            <div class="item-info">
                <img src="${item.image}" alt="${item.title}">
                <div>
                    <h4>${item.title}</h4>
                    <p>Qty: ${item.quantity}</p>
                </div>
            </div>
            <div class="item-price">GHS ${(item.price * item.quantity).toLocaleString()}</div>
        </div>
    `).join('');
}

function calculateTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Calculate delivery fee (simplified - would be more complex in production)
    const hasFreeDelivery = items.some(item => item.deliveryOptions?.includes('free-delivery'));
    const deliveryFee = hasFreeDelivery ? 0 : 50; // GHS 50 flat rate if not free
    
    // Service fee (optional - could be percentage or flat)
    const serviceFee = 0;
    
    const total = subtotal + deliveryFee + serviceFee;

    // Update display
    document.getElementById('orderSubtotal').textContent = `GHS ${subtotal.toLocaleString()}`;
    document.getElementById('orderDelivery').textContent = deliveryFee === 0 ? 'FREE' : `GHS ${deliveryFee.toLocaleString()}`;
    document.getElementById('orderService').textContent = `GHS ${serviceFee.toLocaleString()}`;
    document.getElementById('orderTotal').textContent = `GHS ${total.toLocaleString()}`;
    document.getElementById('payAmount').textContent = `GHS ${total.toLocaleString()}`;

    // Store for payment processing
    window.orderData = {
        items,
        subtotal,
        deliveryFee,
        serviceFee,
        total
    };
}

// ============================================================================
// PAYMENT METHOD SWITCHING
// ============================================================================

function initPaymentMethodSwitching() {
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    const momoDetails = document.getElementById('momoDetails');
    const cardDetails = document.getElementById('cardDetails');

    paymentMethods.forEach(method => {
        method.addEventListener('change', function() {
            if (this.value === 'momo') {
                momoDetails.style.display = 'block';
                cardDetails.style.display = 'none';
                
                // Update required fields
                setRequiredFields('momo');
            } else if (this.value === 'card') {
                momoDetails.style.display = 'none';
                cardDetails.style.display = 'block';
                
                // Update required fields
                setRequiredFields('card');
            }
            
            validateForm();
        });
    });
}

function setRequiredFields(method) {
    // MoMo fields
    const momoFields = ['momoNetwork', 'momoPhone', 'momoName'];
    momoFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.required = (method === 'momo');
        }
    });

    // Card fields
    const cardFields = ['cardNumber', 'cardExpiry', 'cardCVV', 'cardName'];
    cardFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.required = (method === 'card');
        }
    });
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

function initFormValidation() {
    const form = document.querySelector('.payment-form-section');
    const inputs = form.querySelectorAll('input, select');
    const acknowledgeCheckbox = document.getElementById('acknowledgeWarning');

    inputs.forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('change', validateForm);
    });

    acknowledgeCheckbox.addEventListener('change', validateForm);
    
    // Initial validation
    validateForm();
}

function validateForm() {
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const acknowledgeCheckbox = document.getElementById('acknowledgeWarning');
    const payButton = document.getElementById('payButton');
    
    let isValid = true;

    // Check acknowledgment
    if (!acknowledgeCheckbox.checked) {
        isValid = false;
    }

    // Check payment method specific fields
    if (paymentMethod === 'momo') {
        const momoNetwork = document.getElementById('momoNetwork').value;
        const momoPhone = document.getElementById('momoPhone').value;
        const momoName = document.getElementById('momoName').value;

        if (!momoNetwork || !momoPhone || !momoName) {
            isValid = false;
        }

        // Validate phone number format
        if (momoPhone && !validatePhoneNumber(momoPhone)) {
            isValid = false;
        }
    } else if (paymentMethod === 'card') {
        const cardNumber = document.getElementById('cardNumber').value;
        const cardExpiry = document.getElementById('cardExpiry').value;
        const cardCVV = document.getElementById('cardCVV').value;
        const cardName = document.getElementById('cardName').value;

        if (!cardNumber || !cardExpiry || !cardCVV || !cardName) {
            isValid = false;
        }

        // Validate card number (basic check)
        if (cardNumber && cardNumber.replace(/\s/g, '').length < 16) {
            isValid = false;
        }

        // Validate expiry
        if (cardExpiry && !validateCardExpiry(cardExpiry)) {
            isValid = false;
        }

        // Validate CVV
        if (cardCVV && cardCVV.length < 3) {
            isValid = false;
        }
    }

    // Enable/disable pay button
    payButton.disabled = !isValid;
    
    return isValid;
}

function validatePhoneNumber(phone) {
    // Ghana phone number validation
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
}

function validateCardExpiry(expiry) {
    const parts = expiry.split('/');
    if (parts.length !== 2) return false;
    
    const month = parseInt(parts[0]);
    const year = parseInt(parts[1]);
    
    if (month < 1 || month > 12) return false;
    if (year < 24) return false; // Assuming 2024+
    
    return true;
}

// ============================================================================
// CARD FORMATTING
// ============================================================================

function initCardFormatting() {
    const cardNumber = document.getElementById('cardNumber');
    const cardExpiry = document.getElementById('cardExpiry');
    const cardCVV = document.getElementById('cardCVV');

    if (cardNumber) {
        cardNumber.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = '';
            
            for (let i = 0; i < value.length; i++) {
                if (i > 0 && i % 4 === 0) {
                    formattedValue += ' ';
                }
                formattedValue += value[i];
            }
            
            e.target.value = formattedValue;
        });
    }

    if (cardExpiry) {
        cardExpiry.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            
            e.target.value = value;
        });
    }

    if (cardCVV) {
        cardCVV.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

// ============================================================================
// PAYMENT PROCESSING
// ============================================================================

function initPaymentProcessing() {
    const payButton = document.getElementById('payButton');
    
    payButton.addEventListener('click', async function() {
        if (!validateForm()) {
            showFlashMessage('Please fill in all required fields', 'error');
            return;
        }

        await processPayment();
    });
}

async function processPayment() {
    const payButton = document.getElementById('payButton');
    const originalText = payButton.innerHTML;
    
    try {
        // Disable button and show loading
        payButton.disabled = true;
        payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Payment...';

        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        const orderData = window.orderData;

        let paymentData = {
            method: paymentMethod,
            amount: orderData.total,
            items: orderData.items,
            timestamp: new Date().toISOString()
        };

        if (paymentMethod === 'momo') {
            paymentData.momo = {
                network: document.getElementById('momoNetwork').value,
                phone: document.getElementById('momoPhone').value,
                name: document.getElementById('momoName').value
            };

            // Simulate MoMo payment
            await processMomoPayment(paymentData);
        } else if (paymentMethod === 'card') {
            paymentData.card = {
                number: document.getElementById('cardNumber').value,
                expiry: document.getElementById('cardExpiry').value,
                cvv: document.getElementById('cardCVV').value,
                name: document.getElementById('cardName').value
            };

            // Simulate card payment
            await processCardPayment(paymentData);
        }

    } catch (error) {
        console.error('Payment error:', error);
        showFlashMessage('Payment failed. Please try again.', 'error');
        
        // Re-enable button
        payButton.disabled = false;
        payButton.innerHTML = originalText;
    }
}

async function processMomoPayment(paymentData) {
    // In production, this would integrate with Paystack, Hubtel, or other MoMo providers
    // For demo, simulate the process
    
    showFlashMessage('Sending payment prompt to your phone...', 'info');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Simulate success
    showFlashMessage('Payment prompt sent! Please authorize on your phone.', 'success');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Complete payment
    await completePayment(paymentData);
}

async function processCardPayment(paymentData) {
    // In production, this would integrate with Paystack, Stripe, or other card processors
    // For demo, simulate the process
    
    showFlashMessage('Processing card payment...', 'info');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Complete payment
    await completePayment(paymentData);
}

async function completePayment(paymentData) {
    try {
        // Check if user is logged in
        if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
            // Create order in Firebase
            const orderRef = await firebase.firestore().collection('orders').add({
                userId: firebase.auth().currentUser.uid,
                items: paymentData.items,
                paymentMethod: paymentData.method,
                paymentData: {
                    method: paymentData.method,
                    ...(paymentData.method === 'momo' ? {
                        network: paymentData.momo.network,
                        phone: paymentData.momo.phone
                    } : {
                        last4: paymentData.card.number.slice(-4)
                    })
                },
                subtotal: window.orderData.subtotal,
                deliveryFee: window.orderData.deliveryFee,
                serviceFee: window.orderData.serviceFee,
                total: window.orderData.total,
                status: 'paid',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Clear cart
            localStorage.removeItem('sankofa_cart');
            
            // Show success message
            showFlashMessage('Payment successful! 🎉', 'success');
            
            // Redirect to order confirmation
            setTimeout(() => {
                window.location.href = `order-confirmation.html?orderId=${orderRef.id}`;
            }, 2000);
            
        } else {
            // Demo mode
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Clear cart
            localStorage.removeItem('sankofa_cart');
            
            // Show success message
            showFlashMessage('Payment successful! (Demo mode)', 'success');
            
            // Redirect to success page
            setTimeout(() => {
                window.location.href = 'payment-success.html';
            }, 2000);
        }

    } catch (error) {
        console.error('Complete payment error:', error);
        throw error;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showFlashMessage(message, type = 'info') {
    // Use existing flash message system if available
    if (typeof window.showFlashMessage === 'function') {
        window.showFlashMessage(message, type);
    } else {
        // Fallback alert
        alert(message);
    }
}
