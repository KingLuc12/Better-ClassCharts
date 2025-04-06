document.addEventListener('DOMContentLoaded', function() {
    // First, check if we're logged in
    checkAuthentication();
    
    // Set up session ping
    setupSessionPing();
    
    // Theme toggle functionality
    initThemeToggle();
    
    // Create modal for custom date range
    createCustomDateRangeModal();
    
    // Show loading states
    showLoading('attendance-loading', true);
    showLoading('achievements-loading', true);
    
    // Get time range dropdown
    const timeRangeSelect = document.getElementById('time-range');
    
    // Load initial data with current date range
    const initialDateRange = getDateRange(timeRangeSelect.value);
    
    // Fetch attendance and behavior data in parallel
    Promise.all([
        fetchAttendanceData(),
        fetchBehaviorData(initialDateRange.startDate, initialDateRange.endDate)
    ])
    .then(async ([attendanceData, behaviorData]) => {
        // Store the attendance data globally for filtering
        window.fullAttendanceData = attendanceData;
        window.fullBehaviorData = behaviorData;
        
        // Trigger event that attendance data has loaded (for custom date range modal)
        window.dispatchEvent(new CustomEvent('attendanceDataLoaded'));
        
        // Save initial selected value
        timeRangeSelect.setAttribute('data-last-value', timeRangeSelect.value);
        
        if (!attendanceData.success) {
            showError('attendance-card', 'Failed to load attendance data');
            await delay(1500)
            document.getElementById('attendance-card').remove();
        } else {
            processAttendanceData(attendanceData, initialDateRange.startDate, initialDateRange.endDate);
        }

        if (!behaviorData.success) {
            showError('achievements-card', 'Failed to load achievement data');
            await delay(1500)
            document.getElementById('achievements-card').remove();
        } else {
            processBehaviorData(behaviorData);
        }
        
        // Listen for changes in time range
        timeRangeSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                // Show the custom date range modal
                document.getElementById('custom-range-modal').classList.add('active');
                return;
            }
            
            // Save last selected value
            timeRangeSelect.setAttribute('data-last-value', this.value);
            
            const { startDate, endDate } = getDateRange(this.value);
            
            // Show loading states for updating
            showLoading('attendance-loading', true);
            showLoading('achievements-loading', true);
            
            // Update attendance data from already loaded full data
            processAttendanceData(window.fullAttendanceData, startDate, endDate);
            showLoading('attendance-loading', false);
            
            // Fetch new behavior data with proper date range
            fetchBehaviorData(startDate, endDate)
                .then(async behaviorData => {
                    if (!behaviorData.success) {
                        showError('achievements-card', 'Failed to load achievement data');
                        await delay(1500)
                        document.getElementById('achievements-card').remove();
                    } else {
                        processBehaviorData(behaviorData);
                    }
                    processBehaviorData(behaviorData);
                    showLoading('achievements-loading', false);
                })
                .catch(error => {
                    console.error('Error updating behavior data:', error);
                    showError('achievements-card', 'Failed to update achievement data');
                    showLoading('achievements-loading', false);
                });
        });
        
        // Hide loading states
        showLoading('attendance-loading', false);
        showLoading('achievements-loading', false);
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        
        // Safely hide loading states by checking if elements exist first
        if (document.getElementById('attendance-loading')) {
            showLoading('attendance-loading', false);
        }
        
        if (document.getElementById('achievements-loading')) {
            showLoading('achievements-loading', false);
        }
        
        // Show error messages on cards that exist
        if (document.getElementById('attendance-card')) {
            showError('attendance-card', 'Failed to load attendance data');
        }
        
        if (document.getElementById('achievements-card')) {
            showError('achievements-card', 'Failed to load achievement data');
        }
    });

    // Also fetch announcements data
    fetchAnnouncementsData();
});

// Add this function to the top of your file
function checkAuthentication() {
    fetch('/api/user')
        .then(response => {
            if (!response.ok) {
                // Not logged in, redirect to login
                window.location.href = '/login';
                throw new Error('Not logged in');
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.user) {
                // We're logged in, display user info in the header
                displayUserInfo(data.user);
            }
        })
        .catch(error => {
            console.error('Authentication check failed:', error);
        });
}

// Function to display user info in the header
function displayUserInfo(user) {
    // Check if we have a header element for user info
    const userInfoContainer = document.querySelector('.user-info');
    
    if (userInfoContainer) {
        let html = '';
        
        // Add avatar if available
        if (user.avatar) {
            html += `<div class="user-avatar"><img src="${user.avatar}" alt="${user.name}"></div>`;
        } else {
            html += `<div class="user-avatar"><i class="fas fa-user"></i></div>`;
        }
        
        // Add user name
        html += `<div class="user-name">${user.displayName || user.name}</div>`;
        
        // Add logout button
        html += `<button id="logout-btn" class="btn-small"><i class="fas fa-sign-out-alt"></i></button>`;
        
        userInfoContainer.innerHTML = html;
        
        // Add logout event listener
        document.getElementById('logout-btn').addEventListener('click', logout);
    }
}

// Update the logout function

function logout() {
    fetch('/api/logout', {
        method: 'POST'
    })
    .then(() => {
        // Redirect to login page
        window.location.href = '/login';
    })
    .catch(error => {
        console.error('Logout failed:', error);
        alert('Failed to log out. Please try again.');
    });
}

// Create modal for custom date range selection
function createCustomDateRangeModal() {
    // Only create if it doesn't exist
    if (document.getElementById('custom-range-modal')) {
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'custom-range-modal';
    modal.className = 'modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    modalContent.innerHTML = `
        <h3>Select Custom Date Range</h3>
        <div class="date-inputs">
            <input type="date" id="custom-start-date" name="start-date">
            <input type="date" id="custom-end-date" name="end-date">
        </div>
        <div class="modal-buttons">
            <button class="btn btn-secondary" id="cancel-custom-range">Cancel</button>
            <button class="btn" id="apply-custom-range">Apply</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Get the earliest and latest date from attendance data
    // This will be set once the data is loaded
    const setDateBoundaries = () => {
        if (window.fullAttendanceData && window.fullAttendanceData.meta && window.fullAttendanceData.meta.dates) {
            const availableDates = window.fullAttendanceData.meta.dates.sort();
            const earliestDate = availableDates[0];
            const latestDate = availableDates[availableDates.length - 1];
            
            // Set min/max attributes for date inputs
            const startDateInput = document.getElementById('custom-start-date');
            const endDateInput = document.getElementById('custom-end-date');
            
            if (startDateInput && endDateInput) {
                startDateInput.min = earliestDate;
                startDateInput.max = latestDate;
                endDateInput.min = earliestDate;
                endDateInput.max = latestDate;
            }
        }
    };
    
    // Set default values (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const startDateInput = document.getElementById('custom-start-date');
    const endDateInput = document.getElementById('custom-end-date');
    
    startDateInput.value = formatDateForAPI(thirtyDaysAgo);
    endDateInput.value = formatDateForAPI(today);
    
    // Add event listeners
    const timeRangeSelect = document.getElementById('time-range');
    
    document.getElementById('cancel-custom-range').addEventListener('click', function() {
        modal.classList.remove('active');
        // Reset dropdown to previous selection
        timeRangeSelect.value = timeRangeSelect.getAttribute('data-last-value') || 'this-month';
    });
    
    document.getElementById('apply-custom-range').addEventListener('click', function() {
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);
        
        if (startDate > endDate) {
            showError('attendance-card', 'Start date must be before end date');
            return;
        }
        
        // Save the custom dates for later reference
        timeRangeSelect.setAttribute('data-custom-start', startDateInput.value);
        timeRangeSelect.setAttribute('data-custom-end', endDateInput.value);
        
        // Show loading states for updating
        showLoading('attendance-loading', true);
        showLoading('achievements-loading', true);
        
        // Update attendance data from already loaded full data
        processAttendanceData(window.fullAttendanceData, startDate, endDate);
        showLoading('attendance-loading', false);
        
        // Fetch new behavior data with custom date range
        fetchBehaviorData(startDate, endDate)
            .then(behaviorData => {
                processBehaviorData(behaviorData);
                showLoading('achievements-loading', false);
            })
            .catch(error => {
                console.error('Error updating behavior data:', error);
                showError('achievements-card', 'Failed to update achievement data');
                showLoading('achievements-loading', false);
            });
        
        modal.classList.remove('active');
    });
    
    // Update the date boundaries once data is loaded
    if (window.fullAttendanceData) {
        setDateBoundaries();
    } else {
        // We'll call setDateBoundaries later when data is loaded
        window.addEventListener('attendanceDataLoaded', setDateBoundaries);
    }
}

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function initThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;
    
    // Check if user has already set a preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.className = savedTheme;
    } else {
        // Check if user prefers dark mode at the system level
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            body.className = 'dark-theme';
        } else {
            body.className = 'light-theme';
        }
    }
    
    // Toggle theme when button is clicked
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

function updateDashboardData(timeRange) {
    // Get date range based on selected time range
    const { startDate, endDate } = getDateRange(timeRange);
    
    try {
        // Process and display attendance data
        processAttendanceData(window.fullAttendanceData, startDate, endDate);
        
        // Process and display behavior data for the same date range
        processBehaviorData(window.fullBehaviorData, startDate, endDate);
    } catch (error) {
        console.error('Error updating dashboard:', error);
        
        // Show error messages
        showError('attendance-card', 'Failed to update attendance data');
        showError('achievements-card', 'Failed to update achievement data');
    }
}

// Update the showLoading function to handle null elements
function showLoading(elementId, isLoading) {
    const loadingElement = document.getElementById(elementId);
    
    // Check if element exists before trying to modify it
    if (!loadingElement) {
        console.warn(`Loading element with ID '${elementId}' not found`);
        return;
    }
    
    loadingElement.style.display = isLoading ? 'flex' : 'none';
    
    // Make sure we have a parent card before trying to find elements inside it
    const parentCard = loadingElement.closest('.dashboard-card');
    if (parentCard) {
        const statsElement = parentCard.querySelector('.attendance-stats, .achievement-stats');
        if (statsElement) {
            statsElement.style.display = isLoading ? 'none' : '';
        }
    }
}

function showError(parentId, message) {
    const parentElement = document.getElementById(parentId);
    
    // Remove any existing error messages
    const existingError = parentElement.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    
    // Insert after the card header
    const cardBody = parentElement.querySelector('.card-body');
    cardBody.insertBefore(errorElement, cardBody.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        errorElement.remove();
    }, 5000);
}

function getDateRange(timeRange) {
    const now = new Date();
    let startDate, endDate;
    
    // Handle custom date range case
    if (timeRange === 'custom') {
        const timeRangeSelect = document.getElementById('time-range');
        const customStartDate = timeRangeSelect.getAttribute('data-custom-start') 
            || document.getElementById('custom-start-date')?.value;
        const customEndDate = timeRangeSelect.getAttribute('data-custom-end') 
            || document.getElementById('custom-end-date')?.value;
        
        if (customStartDate && customEndDate) {
            return {
                startDate: new Date(customStartDate),
                endDate: new Date(customEndDate)
            };
        }
        
        // Fall back to this month if custom dates aren't available
        timeRange = 'this-month';
    }
    
    switch(timeRange) {
        case 'since-august':
            const currentYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
            startDate = new Date(currentYear, 7, 1); // August 1st
            endDate = new Date(now);
            break;
            
        case 'this-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
            endDate = new Date(now);
            break;
            
        case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 1st of last month
            endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month
            break;
            
        case 'this-week':
            const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to get Monday
            startDate = new Date(now);
            startDate.setDate(diff);
            startDate.setHours(0, 0, 0, 0); // Start of Monday
            endDate = new Date(now);
            break;
            
        default:
            // Default to this month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now);
    }
    
    return { 
        startDate,
        endDate 
    };
}

// Add this to your main.js to handle session refresh errors

async function handleApiResponse(response) {
    const clonedResponse = response.clone();
    const data = clonedResponse.json()
    if (response.ok) {
        return data;
    }

    const responseData = await data.catch(() => null);
    
    if (responseData && responseData.success === false) {
        return data;
    }

    response = await fetch(response.url, {
        method: response.method,
        headers: response.headers,
        body: response.bodyUsed ? null : response.body
    });
    
    if (response.status === 401) {
        const authCheck = await fetch('/api/auth-status');
        const authData = await authCheck.json();
        
        if (!authData.authenticated) {
            window.location.href = '/login';
            throw new Error('Session expired');
        }
    }
    
    try {
        const errorData = await response.json();
        throw new Error(errorData.message || 'API request failed');
    } catch (e) {
        throw new Error(`API request failed: ${response.statusText}`);
    }
}

// Then update your fetch functions to use this handler:

async function fetchAttendanceData() {
    try {
        const response = await fetch('/api/getAttendance');
        return await handleApiResponse(response);
    } catch (error) {
        console.error('Error fetching attendance data:', error);
        throw error;
    }
}

async function fetchBehaviorData(startDate, endDate) {
    try {
        // Format dates for API if provided
        const fromDate = startDate ? formatDateForAPI(startDate) : undefined;
        const toDate = endDate ? formatDateForAPI(endDate) : undefined;
        
        // Build the query string with date parameters
        let url = '/api/getBehaviour';
        if (fromDate && toDate) {
            url += `?from=${fromDate}&to=${toDate}`;
        }
        
        const response = await fetch(url);
        return await handleApiResponse(response);
    } catch (error) {
        console.error('Error fetching behavior data:', error);
        throw error;
    }
}

// Do the same for other API calls
async function fetchAnnouncementsData() {
    try {
        const announcementsContainer = document.getElementById('announcements-container');
        // Show loading state
        showLoading('announcements-loading', true);
        
        const response = await fetch('/api/getAnnouncements');
        const data = await handleApiResponse(response);

        if (data.success === 1 && data.data && data.data.length > 0) {
            // Process and display announcements
            processAnnouncementsData(data.data);
        } else {
            // Display message if no announcements
            announcementsContainer.innerHTML = `
                <div class="no-announcements">
                    <p>No announcements available</p>
                </div>
            `;
            
            // Disable navigation buttons
            document.getElementById('prev-announcement').disabled = true;
            document.getElementById('next-announcement').disabled = true;
        }
        
        // Hide loading state
        showLoading('announcements-loading', false);
        
    } catch (error) {
        console.error('Error fetching announcements:', error);
        showError('announcements-card', 'Failed to load announcements');
        showLoading('announcements-loading', false);
    }
}

function processAttendanceData(data, startDate, endDate) {
    if (!data || !data.data || !data.meta || !data.meta.dates) {
        throw new Error('Invalid attendance data structure');
    }
    
    // Format dates for comparison
    const startFormatted = formatDateForAPI(startDate);
    const endFormatted = formatDateForAPI(endDate);
    
    // Filter dates within the range
    const datesInRange = data.meta.dates.filter(date => {
        return date >= startFormatted && date <= endFormatted;
    });
    
    if (datesInRange.length === 0) {
        showError('attendance-card', 'No attendance data available for the selected date range');
        
        // Still update UI with zeros
        document.getElementById('overall-attendance').textContent = '0%';
        document.getElementById('present-days').textContent = '0 days';
        document.getElementById('absent-days').textContent = '0 days';
        document.getElementById('late-days').textContent = '0 days';
        return;
    }
    
    // Create a filtered data object
    const filteredData = {
        data: {},
        meta: {
            ...data.meta,
            dates: datesInRange,
        }
    };
    
    // Add only the attendance data for dates in range
    datesInRange.forEach(date => {
        if (data.data[date]) {
            filteredData.data[date] = data.data[date];
        }
    });
    
    // Calculate attendance statistics for the filtered data
    const stats = calculateAttendanceStats(filteredData);
    
    // Update the UI with attendance stats
    document.getElementById('overall-attendance').textContent = `${stats.percentage}%`;
    document.getElementById('present-days').textContent = `${stats.present} days`;
    document.getElementById('absent-days').textContent = `${stats.absent} days`;
    document.getElementById('late-days').textContent = `${stats.late} days`;
}

function calculateAttendanceStats(data) {
    let present = 0;
    let absent = 0;
    let late = 0;
    
    for (const date in data.data) {
        // Check AM session status
        const amStatus = data.data[date]?.AM?.status;
        const pmStatus = data.data[date]?.PM?.status;
        
        // Count each half-day separately
        if (amStatus === 'present') present += 0.5;
        else if (amStatus === 'absent' || amStatus === 'excused') absent += 0.5;
        else if (amStatus === 'late') late += 0.5;
        
        if (pmStatus === 'present') present += 0.5;
        else if (pmStatus === 'absent' || pmStatus === 'excused') absent += 0.5;
        else if (pmStatus === 'late') late += 0.5;
    }
    
    // Round to whole days for display
    const presentDays = Math.round(present);
    const absentDays = Math.round(absent);
    const lateDays = Math.round(late);
    
    // Calculate overall percentage
    const totalDays = present + absent + late;
    const percentage = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;
    
    return {
        present: presentDays,
        absent: absentDays,
        late: lateDays,
        percentage: percentage
    };
}

function processBehaviorData(data) {
    if (!data || !data.data) {
        throw new Error('Invalid behavior data structure');
    }
    
    // Calculate behavior stats from the data
    const positiveReasons = {};
    const negativeReasons = {};
    
    // Extract positive and negative reasons from the data
    if (data.data.positive_reasons) {
        Object.assign(positiveReasons, data.data.positive_reasons);
    }
    
    if (data.data.negative_reasons) {
        Object.assign(negativeReasons, data.data.negative_reasons);
    }
    
    // Calculate total positive points
    let totalPositivePoints = 0;
    for (const reason in positiveReasons) {
        totalPositivePoints += positiveReasons[reason];
    }
    
    // Calculate total negative points
    let totalNegativePoints = 0;
    for (const reason in negativeReasons) {
        totalNegativePoints += negativeReasons[reason];
    }
    
    // Update UI with totals
    document.getElementById('total-positive-points').textContent = totalPositivePoints;
    document.getElementById('total-negative-points').textContent = totalNegativePoints;
    
    // Generate breakdown for positive points
    const positiveBreakdown = document.getElementById('positive-breakdown');
    positiveBreakdown.innerHTML = '';
    
    // Sort reasons by point value (descending)
    const sortedPositiveReasons = Object.entries(positiveReasons)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedPositiveReasons.length === 0) {
        positiveBreakdown.innerHTML = `
            <div class="reason" style="grid-column: span 2; text-align: center;">No positive points during this period</div>
        `;
    } else {
        // Display top 5 positive reasons
        sortedPositiveReasons.slice(0, 5).forEach(([reason, points]) => {
            positiveBreakdown.innerHTML += `
                <div class="reason">${reason}:</div>
                <div class="points">+${points}</div>
            `;
        });
        
        // If there are more than 5 reasons, show a summary of the rest
        if (sortedPositiveReasons.length > 5) {
            const remainingCount = sortedPositiveReasons.length - 5;
            const remainingPoints = sortedPositiveReasons.slice(5).reduce((sum, [_, points]) => sum + points, 0);
            
            positiveBreakdown.innerHTML += `
                <div class="reason">Other (${remainingCount} more):</div>
                <div class="points">+${remainingPoints}</div>
            `;
        }
    }
    
    // Generate breakdown for negative points
    const negativeBreakdown = document.getElementById('negative-breakdown');
    negativeBreakdown.innerHTML = '';
    
    // Sort reasons by point value (descending)
    const sortedNegativeReasons = Object.entries(negativeReasons)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedNegativeReasons.length === 0) {
        negativeBreakdown.innerHTML = `
            <div class="reason" style="grid-column: span 2; text-align: center;">No negative points during this period</div>
        `;
    } else {
        // Display all negative reasons
        sortedNegativeReasons.forEach(([reason, points]) => {
            negativeBreakdown.innerHTML += `
                <div class="reason">${reason}:</div>
                <div class="points">-${points}</div>
            `;
        });
    }
}

// Helper function to format date for API (YYYY-MM-DD)
function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Function to process and display announcements data
function processAnnouncementsData(announcements) {
    // Store announcements in a global variable
    window.announcements = announcements;
    window.currentAnnouncementIndex = 0;
    
    // Display the first announcement
    displayCurrentAnnouncement();
    
    // Add event listeners for navigation buttons
    const prevButton = document.getElementById('prev-announcement');
    const nextButton = document.getElementById('next-announcement');
    
    prevButton.addEventListener('click', showPreviousAnnouncement);
    nextButton.addEventListener('click', showNextAnnouncement);
    
    // Update button states
    updateAnnouncementNavButtons();
}

// Function to display the current announcement
function displayCurrentAnnouncement() {
    if (!window.announcements || !window.announcements.length) {
        return;
    }
    
    const announcement = window.announcements[window.currentAnnouncementIndex];
    const container = document.getElementById('announcements-container');
    
    // Format date
    const date = new Date(announcement.timestamp);
    const formattedDate = date.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
    
    // Create announcement element
    container.innerHTML = `
        <div class="announcement">
            <div class="announcement-header">
                <div class="announcement-school">
                    <div class="announcement-school-logo">
                        <img src="${announcement.school_logo}" alt="${announcement.school_name} Logo">
                    </div>
                    <div class="announcement-info">
                        <h3 class="announcement-title">${announcement.title}</h3>
                        <p class="announcement-meta">
                            <span class="announcement-date">${formattedDate}</span> | 
                            <span class="announcement-teacher">${announcement.teacher_name}</span>
                        </p>
                    </div>
                </div>
            </div>
            <div class="announcement-content">
                ${announcement.description}
            </div>
            <div class="announcement-pagination">
                ${window.currentAnnouncementIndex + 1} of ${window.announcements.length}
            </div>
        </div>
    `;
    
    // Update button states
    updateAnnouncementNavButtons();
}

// Function to show previous announcement
function showPreviousAnnouncement() {
    if (window.currentAnnouncementIndex > 0) {
        window.currentAnnouncementIndex--;
        displayCurrentAnnouncement();
    }
}

// Function to show next announcement
function showNextAnnouncement() {
    if (window.currentAnnouncementIndex < window.announcements.length - 1) {
        window.currentAnnouncementIndex++;
        displayCurrentAnnouncement();
    }
}

// Function to update navigation button states
function updateAnnouncementNavButtons() {
    const prevButton = document.getElementById('prev-announcement');
    const nextButton = document.getElementById('next-announcement');
    
    if (window.currentAnnouncementIndex === 0) {
        prevButton.disabled = true;
        prevButton.classList.add('disabled');
    } else {
        prevButton.disabled = false;
        prevButton.classList.remove('disabled');
    }
    
    if (!window.announcements || window.currentAnnouncementIndex === window.announcements.length - 1) {
        nextButton.disabled = true;
        nextButton.classList.add('disabled');
    } else {
        nextButton.disabled = false;
        nextButton.classList.remove('disabled');
    }
}

// Add this to your main.js file

// Function to periodically ping the server to keep the session active
function setupSessionPing() {
    // Check authentication status every 4 minutes
    const PING_INTERVAL = 4 * 60 * 1000; // 4 minutes
    
    setInterval(async () => {
        try {
            console.log('Pinging server to keep session active...');
            const response = await fetch('/api/auth-status');
            const data = await response.json();
            
            if (!data.authenticated) {
                console.warn('Session no longer authenticated, redirecting to login');
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Error pinging server:', error);
        }
    }, PING_INTERVAL);
}

// Add this to your main.js file

// Handle page visibility changes to refresh session when user returns
document.addEventListener('visibilitychange', async function() {
    // When the user returns to the page
    if (document.visibilityState === 'visible') {
        console.log('User returned to the page, checking session...');
        try {
            // Check if we're still logged in
            const response = await fetch('/api/auth-status');
            const data = await response.json();
            
            if (data.authenticated) {
                console.log('Session still valid, refreshing data...');
                // Optionally refresh data here if needed
                
                // Force a refresh of ClassCharts session on the server by making a lightweight API call
                await fetch('/api/user');
            } else {
                console.warn('Session expired while away, redirecting to login');
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Error checking session on page return:', error);
        }
    }
});