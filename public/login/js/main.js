document.addEventListener('DOMContentLoaded', function() {
    initThemeToggle();
    initLoginForm();
    checkSavedCredentials();
});

function initThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.className = savedTheme;
    } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            body.className = 'dark-theme';
        } else {
            body.className = 'light-theme';
        }
    }
    
    themeToggleBtn.addEventListener('click', function() {
        if (body.classList.contains('light-theme')) {
            body.className = 'dark-theme';
            localStorage.setItem('theme', 'dark-theme');
        } else {
            body.className = 'light-theme';
            localStorage.setItem('theme', 'light-theme');
        }
    });
}

function checkIfLoggedIn() {
    if (!window.location.pathname.includes('/login')) {
        fetch('/api/user')
            .then(response => {
                if (response.ok) {
                    window.location.href = '/dashboard';
                    return response.json();
                }
                throw new Error('Not logged in');
            })
            .catch(error => {
                console.log('Not logged in:', error);
            });
    }
}

function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    
    if (!loginForm) {
        console.error('Login form not found');
        return;
    }
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log("Form submitted!");
        
        const btnText = loginForm.querySelector('.btn-text');
        const btnLoading = loginForm.querySelector('.btn-loading');
        
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
        errorMessage.style.display = 'none';
        
        const pupilCode = document.getElementById('pupil-code').value.trim();
        const dateOfBirth = document.getElementById('date-of-birth').value;
        const rememberMe = document.getElementById('remember-me').checked;
        
        console.log("Form data collected:", {
            pupilCode: pupilCode ? "PROVIDED" : "MISSING",
            dateOfBirth: dateOfBirth ? "PROVIDED" : "MISSING",
            rememberMe
        });
        
        if (!pupilCode || !dateOfBirth) {
            errorMessage.textContent = 'Please enter both pupil code and date of birth.';
            errorMessage.style.display = 'block';
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
            console.log("Form validation failed");
            return;
        }
        
        try {
            const response = await fetch('/api/verify-credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pupilCode, dateOfBirth })
            });
            
            if (!response.ok) {
                const data = await response.json();
                errorMessage.textContent = data.message || 'Invalid credentials';
                errorMessage.style.display = 'block';
                btnText.style.display = 'block';
                btnLoading.style.display = 'none';
                return;
            }
            
            if (rememberMe) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 30);
                
                document.cookie = `pupilCode=${encodeURIComponent(pupilCode)};expires=${expiryDate.toUTCString()};path=/;SameSite=Strict`;
                document.cookie = `dateOfBirth=${encodeURIComponent(dateOfBirth)};expires=${expiryDate.toUTCString()};path=/;SameSite=Strict`;
            } else {
                document.cookie = `pupilCode=${encodeURIComponent(pupilCode)};path=/;SameSite=Strict`;
                document.cookie = `dateOfBirth=${encodeURIComponent(dateOfBirth)};path=/;SameSite=Strict`;
            }
            
            window.location.href = '/dashboard';
            
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'An error occurred. Please try again.';
            errorMessage.style.display = 'block';
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
        }
    });
}

function checkSavedCredentials() {
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    }
    
    const pupilCode = getCookie('pupilCode');
    const dateOfBirth = getCookie('dateOfBirth');
    
    if (pupilCode && dateOfBirth) {
        const pupilCodeInput = document.getElementById('pupil-code');
        const dobInput = document.getElementById('date-of-birth');
        const rememberMeCheckbox = document.getElementById('remember-me');
        
        if (pupilCodeInput && dobInput) {
            pupilCodeInput.value = pupilCode;
            dobInput.value = dateOfBirth;
            
            if (rememberMeCheckbox) {
                rememberMeCheckbox.checked = true;
            }
        }
    }
}
