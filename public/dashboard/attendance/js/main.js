document.addEventListener('DOMContentLoaded', function() {
    initThemeToggle();
    showLoadingState();
    
    fetchAttendanceData()
        .then(data => {
            hideLoadingState();
            initDashboard(data);
        })
        .catch(error => {
            console.error('Error loading attendance data:', error);
            hideLoadingState();
            showErrorMessage('Failed to load attendance data. Please try again later.');
        });
});

function showLoadingState() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-circle-notch fa-spin"></i>
        </div>
        <p>Loading attendance data...</p>
    `;
    document.body.appendChild(loadingOverlay);

    if (!document.querySelector('#loading-styles')) {
        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.textContent = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                color: white;
            }
            .loading-spinner {
                font-size: 3rem;
                margin-bottom: 1rem;
            }
            .error-message {
                background-color: var(--absent);
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                margin: 10px 0;
                text-align: center;
            }
        `;
        document.head.appendChild(style);
    }
}

function hideLoadingState() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const mainElement = document.querySelector('main');
    mainElement.insertBefore(errorDiv, mainElement.firstChild);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

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
        
        if (window.attendanceChart) {
            updateChartColors();
        }
    });
}

async function fetchAttendanceData() {
    try {
        const response = await fetch('/api/getAttendance');
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('API Response:', data);
        
        return data;
    } catch (error) {
        console.error('Error fetching data from API:', error);
        throw error;
    }
}

function initDashboard(data) {
    document.getElementById('overall-attendance').textContent = data.meta.percentage + '%';
    document.getElementById('since-august').textContent = data.meta.percentage_singe_august + '%';
    
    updateDateRangeDisplay(data);
    setupDateRangeControls(data);
    
    const stats = calculateAttendanceStats(data);
    
    document.getElementById('present-count').textContent = `${stats.present} days`;
    document.getElementById('absent-count').textContent = `${stats.absent} days`;
    document.getElementById('late-count').textContent = `${stats.late} days`;
    
    initAttendanceChart(data);
}

function calculateAttendanceStats(data) {
    let present = 0;
    let absent = 0;
    let late = 0;
    
    for (const date in data.data) {
        const amStatus = data.data[date]?.AM?.status;
        const pmStatus = data.data[date]?.PM?.status;
        
        if (amStatus === 'present') present += 0.5;
        else if (amStatus === 'absent') absent += 0.5;
        else if (amStatus === 'excused') absent += 0.5;
        else if (amStatus === 'late') late += 0.5;
        
        if (pmStatus === 'present') present += 0.5;
        else if (pmStatus === 'absent') absent += 0.5;
        else if (pmStatus === 'excused') absent += 0.5;
        else if (pmStatus === 'late') late += 0.5;
    }
    
    return {
        present: Math.round(present),
        absent: Math.round(absent),
        late: Math.round(late)
    };
}

function initAttendanceChart(data) {
    const ctx = document.getElementById('attendance-chart').getContext('2d');
    
    if (window.attendanceChart) {
        window.attendanceChart.destroy();
    }
    
    const chartData = prepareChartData(data);
    
    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#f8f9fa' : '#212529';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    window.attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Present',
                data: chartData.present,
                backgroundColor: isDark ? 'rgba(46, 204, 113, 0.7)' : 'rgba(40, 167, 69, 0.7)',
                borderColor: isDark ? '#2ecc71' : '#28a745',
                borderWidth: 1
            }, {
                label: 'Absent',
                data: chartData.absent,
                backgroundColor: isDark ? 'rgba(231, 76, 60, 0.7)' : 'rgba(220, 53, 69, 0.7)',
                borderColor: isDark ? '#e74c3c' : '#dc3545',
                borderWidth: 1
            }, {
                label: 'Late',
                data: chartData.late,
                backgroundColor: isDark ? 'rgba(241, 196, 15, 0.7)' : 'rgba(255, 193, 7, 0.7)',
                borderColor: isDark ? '#f1c40f' : '#ffc107',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: 2,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            if (value === 0) return '0';
                            if (value === 1) return 'Half Day';
                            if (value === 2) return 'Full Day';
                            return value;
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            }
        }
    });
}

function updateChartColors() {
    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#f8f9fa' : '#212529';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    window.attendanceChart.data.datasets[0].backgroundColor = isDark ? 'rgba(46, 204, 113, 0.7)' : 'rgba(40, 167, 69, 0.7)';
    window.attendanceChart.data.datasets[0].borderColor = isDark ? '#2ecc71' : '#28a745';
    window.attendanceChart.data.datasets[1].backgroundColor = isDark ? 'rgba(231, 76, 60, 0.7)' : 'rgba(220, 53, 69, 0.7)';
    window.attendanceChart.data.datasets[1].borderColor = isDark ? '#e74c3c' : '#dc3545';
    window.attendanceChart.data.datasets[2].backgroundColor = isDark ? 'rgba(241, 196, 15, 0.7)' : 'rgba(255, 193, 7, 0.7)';
    window.attendanceChart.data.datasets[2].borderColor = isDark ? '#f1c40f' : '#ffc107';
    
    window.attendanceChart.options.scales.x.grid.color = gridColor;
    window.attendanceChart.options.scales.y.grid.color = gridColor;
    window.attendanceChart.options.scales.x.ticks.color = textColor;
    window.attendanceChart.options.scales.y.ticks.color = textColor;
    
    window.attendanceChart.options.plugins.legend.labels.color = textColor;
    
    window.attendanceChart.update();
}

function prepareChartData(data) {
    const labels = [];
    const present = [];
    const absent = [];
    const late = [];
    
    const dates = data.meta.dates.slice(-10);
    
    dates.forEach(date => {
        if (data.data[date]) {
            const displayDate = formatDate(new Date(date));
            labels.push(displayDate);
            
            let presentCount = 0;
            let absentCount = 0;
            let lateCount = 0;
            
            const amStatus = data.data[date]?.AM?.status;
            if (amStatus === 'present') presentCount++;
            else if (amStatus === 'absent' || amStatus === 'excused') absentCount++;
            else if (amStatus === 'late') lateCount++;
            
            const pmStatus = data.data[date]?.PM?.status;
            if (pmStatus === 'present') presentCount++;
            else if (pmStatus === 'absent' || pmStatus === 'excused') absentCount++;
            else if (pmStatus === 'late') lateCount++;
            
            present.push(presentCount);
            absent.push(absentCount);
            late.push(lateCount);
        }
    });
    
    return { labels, present, absent, late };
}

function formatDate(date, shortFormat = false) {
    const options = { 
        month: shortFormat ? 'short' : 'long',
        day: 'numeric',
        year: 'numeric'
    };
    
    return date.toLocaleDateString('en-US', options);
}

function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

window.addEventListener('resize', function() {
    if (window.attendanceChart) {
        window.attendanceChart.resize();
    }
});

function updateDateRangeDisplay(data, customRange = null) {
    const startDate = customRange ? new Date(customRange.start) : new Date(data.meta.start_date);
    const endDate = customRange ? new Date(customRange.end) : new Date(data.meta.end_date);
    document.getElementById('date-range').textContent = `${formatDate(startDate, true)} - ${formatDate(endDate, true)}`;
    
    document.getElementById('date-range').setAttribute('data-start', formatDateForAPI(startDate));
    document.getElementById('date-range').setAttribute('data-end', formatDateForAPI(endDate));
}

function setupDateRangeControls(data) {
    const dateRangeSelect = document.getElementById('date-range-select');
    let modalCreated = false;
    
    function createCustomRangeModal() {
        if (modalCreated) return;
        
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
        
        const availableDates = data.meta.dates.sort();
        const earliestDate = availableDates[0];
        const latestDate = availableDates[availableDates.length - 1];
        
        const startDateInput = document.getElementById('custom-start-date');
        const endDateInput = document.getElementById('custom-end-date');
        
        startDateInput.min = earliestDate;
        startDateInput.max = latestDate;
        endDateInput.min = earliestDate;
        endDateInput.max = latestDate;
        
        const today = new Date(latestDate);
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        startDateInput.value = formatDateForAPI(thirtyDaysAgo);
        endDateInput.value = formatDateForAPI(today);
        
        document.getElementById('cancel-custom-range').addEventListener('click', function() {
            modal.classList.remove('active');
            dateRangeSelect.value = dateRangeSelect.getAttribute('data-last-value') || 'since-august';
        });
        
        document.getElementById('apply-custom-range').addEventListener('click', function() {
            const startDate = new Date(startDateInput.value);
            const endDate = new Date(endDateInput.value);
            
            if (startDate > endDate) {
                showErrorMessage('Start date must be before end date');
                return;
            }
            
            updateDateRangeDisplay(data, {
                start: startDate,
                end: endDate
            });
            
            updateChartForDateRange(data, startDate, endDate);
            modal.classList.remove('active');
        });
        
        modalCreated = true;
    }
    
    dateRangeSelect.addEventListener('change', function() {
        dateRangeSelect.setAttribute('data-last-value', this.value);
        
        const option = this.value;
        const today = new Date();
        
        if (option === 'custom') {
            createCustomRangeModal();
            document.getElementById('custom-range-modal').classList.add('active');
            return;
        }
        
        let startDate, endDate;
        
        switch (option) {
            case 'since-august':
                const currentYear = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
                startDate = new Date(currentYear, 7, 1);
                endDate = new Date(today);
                break;
                
            case 'this-month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today);
                break;
                
            case 'last-month':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
        }
        
        updateDateRangeDisplay(data, { start: startDate, end: endDate });
        updateChartForDateRange(data, startDate, endDate);
    });
    
    dateRangeSelect.value = 'since-august';
    dateRangeSelect.dispatchEvent(new Event('change'));
}

function updateChartForDateRange(data, startDate, endDate) {
    const startFormatted = formatDateForAPI(startDate);
    const endFormatted = formatDateForAPI(endDate);
    
    const datesInRange = data.meta.dates.filter(date => {
        return date >= startFormatted && date <= endFormatted;
    });
    
    if (datesInRange.length === 0) {
        showErrorMessage('No data available for the selected date range');
        return;
    }
    
    const filteredData = {
        data: {},
        meta: {
            ...data.meta,
            dates: datesInRange,
        }
    };
    
    datesInRange.forEach(date => {
        if (data.data[date]) {
            filteredData.data[date] = data.data[date];
        }
    });
    
    const periodStats = calculateAttendanceStats(filteredData);
    
    document.getElementById('present-count').textContent = `${periodStats.present} days`;
    document.getElementById('absent-count').textContent = `${periodStats.absent} days`;
    document.getElementById('late-count').textContent = `${periodStats.late} days`;
    
    const totalDays = periodStats.present + periodStats.absent + periodStats.late;
    let attendancePercentage = 0;
    
    if (totalDays > 0) {
        attendancePercentage = Math.round((periodStats.present / totalDays) * 100);
    }
    
    document.getElementById('overall-attendance').textContent = `${attendancePercentage}%`;
    
    if (window.attendanceChart) {
        window.attendanceChart.destroy();
    }
    initAttendanceChart(filteredData);
}
