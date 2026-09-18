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
                const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
                
                // Check user status
                if (typeof firebaseDB !== 'undefined') {
                    const userDoc = await firebaseDB.collection('users').doc(cred.user.uid).get();
                    
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        
                        if (userData.status === 'pending') {
                            // Sign out user and show message
                            await firebaseAuth.signOut();
                            showFlashMessage('Your account is pending admin approval. Please wait for approval before logging in.', 'warning');
                            return;
                        } else if (userData.status === 'rejected') {
                            await firebaseAuth.signOut();
                            showFlashMessage('Your account registration was rejected. Please contact support for more information.', 'error');
                            return;
                        }
                        // If status is 'approved' or undefined (for old accounts), allow login
                    }
                }
                
                showFlashMessage('Welcome back!', 'success');
                redirectAfterAuth();
            } else {
                // Demo mode
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const demoUser = localStorage.getItem('sankofa_user');
                if (demoUser) {
                    const userData = JSON.parse(demoUser);
                    if (userData.status === 'pending') {
                        showFlashMessage('Your account is pending admin approval. Please wait for approval before logging in.', 'warning');
                        return;
                    }
                }
                
                localStorage.setItem('sankofa_user', JSON.stringify({ email, name: 'Demo User', status: 'approved' }));
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
    
    // File upload handlers
    initFileUploads();
    
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
        const ghanaCardFiles = window.ghanaCardFiles || [];
        const passportPhotoFile = window.passportPhotoFile;
        
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
        if (ghanaCardFiles.length === 0) {
            showFlashMessage('Please upload your Ghana Card (front and back)', 'error');
            return;
        }
        if (ghanaCardFiles.length < 2) {
            showFlashMessage('Please upload both front and back of your Ghana Card', 'error');
            return;
        }
        if (!passportPhotoFile) {
            showFlashMessage('Please upload your passport picture', 'error');
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
                
                // Upload verification documents to Firebase Storage
                const ghanaCardUrls = [];
                for (let i = 0; i < ghanaCardFiles.length; i++) {
                    const url = await uploadVerificationFile(ghanaCardFiles[i], `verifications/${cred.user.uid}/ghana_card_${i}`);
                    ghanaCardUrls.push(url);
                }
                
                const passportPhotoUrl = await uploadVerificationFile(passportPhotoFile, `verifications/${cred.user.uid}/passport_photo`);
                
                // Save user data to Firestore with pending status
                if (typeof firebaseDB !== 'undefined') {
                    await firebaseDB.collection('users').doc(cred.user.uid).set({
                        firstName,
                        lastName,
                        email,
                        phone,
                        status: 'pending', // Account pending admin approval
                        verification: {
                            ghanaCard: ghanaCardUrls,
                            passportPhoto: passportPhotoUrl,
                            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
                        },
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                // Sign out user since account is pending approval
                await firebaseAuth.signOut();
                
                showFlashMessage('Account created! Your account is pending admin approval. You will receive an email once approved.', 'success');
                
                // Redirect to login page after delay
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            } else {
                // Demo mode
                await new Promise(resolve => setTimeout(resolve, 1500));
                localStorage.setItem('sankofa_user', JSON.stringify({ 
                    email, 
                    name: `${firstName} ${lastName}`, 
                    phone,
                    status: 'pending'
                }));
                showFlashMessage('Account created! Your account is pending admin approval. (Demo mode)', 'success');
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            }
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
// FILE UPLOAD HANDLERS
// ============================================================================

function initFileUploads() {
    // Ghana Card upload
    const ghanaCardInput = document.getElementById('ghanaCard');
    const ghanaCardPreview = document.getElementById('ghanaCardPreview');
    window.ghanaCardFiles = [];
    
    ghanaCardInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        
        if (window.ghanaCardFiles.length + files.length > 2) {
            showFlashMessage('Maximum 2 images for Ghana Card (front and back)', 'warning');
            return;
        }
        
        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                showFlashMessage('Only image files are allowed', 'error');
                return;
            }
            
            window.ghanaCardFiles.push(file);
            displayFilePreview(file, ghanaCardPreview, window.ghanaCardFiles.length - 1, 'ghanaCard');
        });
        
        // Reset input
        this.value = '';
    });
    
    // Passport Photo upload
    const passportPhotoInput = document.getElementById('passportPhoto');
    const passportPhotoPreview = document.getElementById('passportPhotoPreview');
    window.passportPhotoFile = null;
    
    passportPhotoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            showFlashMessage('Only image files are allowed', 'error');
            return;
        }
        
        window.passportPhotoFile = file;
        displayFilePreview(file, passportPhotoPreview, 0, 'passportPhoto');
        
        // Reset input
        this.value = '';
    });
}

function displayFilePreview(file, container, index, type) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const previewItem = document.createElement('div');
        previewItem.className = 'file-preview-item';
        previewItem.innerHTML = `
            <img src="${e.target.result}" alt="Preview">
            <button type="button" class="remove-file" data-index="${index}" data-type="${type}">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(previewItem);
        
        // Add remove handler
        previewItem.querySelector('.remove-file').addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            const fileType = this.dataset.type;
            
            if (fileType === 'ghanaCard') {
                window.ghanaCardFiles.splice(idx, 1);
            } else {
                window.passportPhotoFile = null;
            }
            
            previewItem.remove();
            
            // Re-render previews with correct indices
            if (fileType === 'ghanaCard') {
                container.innerHTML = '';
                window.ghanaCardFiles.forEach((f, i) => {
                    displayFilePreview(f, container, i, 'ghanaCard');
                });
            }
        });
    };
    
    reader.readAsDataURL(file);
}

async function uploadVerificationFile(file, path) {
    if (typeof firebaseStorage === 'undefined') {
        // Demo mode - return mock URL
        return `https://storage.example.com/${path}`;
    }
    
    const storageRef = firebaseStorage.ref();
    const fileRef = storageRef.child(path);
    
    await fileRef.put(file);
    return await fileRef.getDownloadURL();
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
