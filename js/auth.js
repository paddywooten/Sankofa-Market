/**
 * Sankofa Market - Authentication JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    // Determine which page we're on
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) initLogin();
    if (registerForm) initRegister();
    
    initPasswordToggles();
});

// ============================================================================
// LOGIN
// ============================================================================

function initLogin() {
    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const googleBtn = document.getElementById('googleLoginBtn');
    const facebookBtn = document.getElementById('facebookLoginBtn');
    const forgotLink = document.getElementById('forgotPasswordLink');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            showFlashMessage('Please fill in all fields', 'error');
            return;
        }
        
        const stopLoading = showLoading(loginBtn);
        
        try {
            if (typeof firebaseAuth !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
                await firebaseAuth.signInWithEmailAndPassword(email, password);
                showFlashMessage('Welcome back!', 'success');
                redirectAfterAuth();
            } else {
                // Demo mode
                await new Promise(resolve => setTimeout(resolve, 1000));
                localStorage.setItem('sankofa_user', JSON.stringify({ email, name: 'Demo User' }));
                showFlashMessage('Welcome back! (Demo mode)', 'success');
                redirectAfterAuth();
            }
        } catch (error) {
            console.error('Login error:', error);
            showFlashMessage(getAuthErrorMessage(error.code), 'error');
        } finally {
            stopLoading();
        }
    });
    
    // Google login
    googleBtn.addEventListener('click', async function() {
        try {
            if (typeof firebaseAuth !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
                const provider = new firebase.auth.GoogleAuthProvider();
                await firebaseAuth.signInWithPopup(provider);
                showFlashMessage('Signed in with Google!', 'success');
                redirectAfterAuth();
            } else {
                showFlashMessage('Google login requires Firebase setup', 'warning');
            }
        } catch (error) {
            showFlashMessage(getAuthErrorMessage(error.code), 'error');
        }
    });
    
    // Facebook login
    facebookBtn.addEventListener('click', async function() {
        try {
            if (typeof firebaseAuth !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
                const provider = new firebase.auth.FacebookAuthProvider();
                await firebaseAuth.signInWithPopup(provider);
                showFlashMessage('Signed in with Facebook!', 'success');
                redirectAfterAuth();
            } else {
                showFlashMessage('Facebook login requires Firebase setup', 'warning');
            }
        } catch (error) {
            showFlashMessage(getAuthErrorMessage(error.code), 'error');
        }
    });
    
    // Forgot password
    forgotLink.addEventListener('click', async function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        
        if (!email) {
            showFlashMessage('Enter your email first, then click forgot password', 'info');
            return;
        }
        
        try {
            if (typeof firebaseAuth !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
                await firebaseAuth.sendPasswordResetEmail(email);
            } else {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            showFlashMessage('Password reset email sent! Check your inbox.', 'success');
        } catch (error) {
            showFlashMessage(getAuthErrorMessage(error.code), 'error');
        }
    });
}

// ============================================================================
// REGISTER
// ============================================================================

function initRegister() {
    const form = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const googleBtn = document.getElementById('googleRegisterBtn');
    const facebookBtn = document.getElementById('facebookRegisterBtn');
    
    // Password strength meter
    passwordInput.addEventListener('input', function() {
        updatePasswordStrength(this.value);
    });
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;
        const terms = document.getElementById('terms').checked;
        
        // Validation
        if (!firstName || !lastName) {
            showFlashMessage('Please enter your name', 'error');
            return;
        }
        if (!email || !isValidEmail(email)) {
            showFlashMessage('Please enter a valid email', 'error');
            return;
        }
        if (!phone) {
            showFlashMessage('Please enter your phone number', 'error');
            return;
        }
        if (password.length < 8) {
            showFlashMessage('Password must be at least 8 characters', 'error');
            return;
        }
        if (password !== confirmPassword) {
            showFlashMessage('Passwords do not match', 'error');
            return;
        }
        if (!terms) {
            showFlashMessage('Please agree to the Terms of Service', 'error');
            return;
        }
        
        const stopLoading = showLoading(registerBtn);
        
        try {
            if (typeof firebaseAuth !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
                const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
                
                // Update profile
                await cred.user.updateProfile({
                    displayName: `${firstName} ${lastName}`
                });
                
                // Save user data to Firestore
                if (typeof firebaseDB !== 'undefined') {
                    await firebaseDB.collection('users').doc(cred.user.uid).set({
                        firstName,
                        lastName,
                        email,
                        phone,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                showFlashMessage('Account created successfully!', 'success');
            } else {
                // Demo mode
                await new Promise(resolve => setTimeout(resolve, 1500));
                localStorage.setItem('sankofa_user', JSON.stringify({ 
                    email, name: `${firstName} ${lastName}`, phone 
                }));
                showFlashMessage('Account created! (Demo mode)', 'success');
            }
            
            redirectAfterAuth();
        } catch (error) {
            console.error('Register error:', error);
            showFlashMessage(getAuthErrorMessage(error.code), 'error');
        } finally {
            stopLoading();
        }
    });
    
    // Google register
    googleBtn.addEventListener('click', async function() {
        try {
            if (typeof firebaseAuth !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
                const provider = new firebase.auth.GoogleAuthProvider();
                await firebaseAuth.signInWithPopup(provider);
                showFlashMessage('Signed up with Google!', 'success');
                redirectAfterAuth();
            } else {
                showFlashMessage('Google sign up requires Firebase setup', 'warning');
            }
        } catch (error) {
            showFlashMessage(getAuthErrorMessage(error.code), 'error');
        }
    });
    
    // Facebook register
    facebookBtn.addEventListener('click', async function() {
        try {
            if (typeof firebaseAuth !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
                const provider = new firebase.auth.FacebookAuthProvider();
                await firebaseAuth.signInWithPopup(provider);
                showFlashMessage('Signed up with Facebook!', 'success');
                redirectAfterAuth();
            } else {
                showFlashMessage('Facebook sign up requires Firebase setup', 'warning');
            }
        } catch (error) {
            showFlashMessage(getAuthErrorMessage(error.code), 'error');
        }
    });
}

// ============================================================================
// PASSWORD HELPERS
// ============================================================================

function initPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

function updatePasswordStrength(password) {
    const fill = document.getElementById('strengthFill');
    const text = document.getElementById('strengthText');
    
    if (!fill || !text) return;
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    fill.className = 'strength-fill';
    
    if (password.length === 0) {
        text.textContent = '';
    } else if (strength <= 1) {
        fill.classList.add('weak');
        text.textContent = 'Weak password';
        text.style.color = '#e74c3c';
    } else if (strength <= 2) {
        fill.classList.add('medium');
        text.textContent = 'Medium strength';
        text.style.color = '#f5af02';
    } else {
        fill.classList.add('strong');
        text.textContent = 'Strong password';
        text.style.color = '#86b817';
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function redirectAfterAuth() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    
    setTimeout(() => {
        if (redirect) {
            window.location.href = `../../${redirect}`;
        } else {
            window.location.href = '../../index.html';
        }
    }, 1500);
}

function getAuthErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'This email is already registered',
        'auth/invalid-email': 'Invalid email address',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/weak-password': 'Password is too weak',
        'auth/too-many-requests': 'Too many attempts. Please try again later',
        'auth/popup-closed-by-user': 'Sign in popup was closed',
        'auth/network-request-failed': 'Network error. Check your connection'
    };
    return messages[code] || 'An error occurred. Please try again.';
}
