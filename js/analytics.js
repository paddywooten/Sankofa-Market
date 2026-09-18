/**
 * Search Analytics JavaScript
 * Handles analytics dashboard functionality
 */

let currentPeriod = 30;
let analyticsData = null;

document.addEventListener('DOMContentLoaded', function() {
    initAnalytics();
});

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initAnalytics() {
    // Check if user is authenticated and is admin
    if (typeof firebase === 'undefined' || typeof firebaseDB === 'undefined') {
        showDemoData();
        return;
    }

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            window.location.href = '../../pages/auth/login.html';
            return;
        }

        // Check admin status
        const userDoc = await firebaseDB.collection('users').doc(user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            showFlashMessage('Admin access required', 'error');
            setTimeout(() => {
                window.location.href = '../../index.html';
            }, 2000);
            return;
        }

        // Initialize UI
        initPeriodSelector();
        initExportButton();
        
        // Load analytics data
        loadAnalytics(currentPeriod);

    } catch (error) {
        console.error('Init error:', error);
        showDemoData();
    }
}

// ============================================================================
// PERIOD SELECTOR
// ============================================================================

function initPeriodSelector() {
    const periodBtns = document.querySelectorAll('.period-btn');
    
    periodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            periodBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentPeriod = parseInt(this.dataset.days);
            loadAnalytics(currentPeriod);
        });
    });
}

// ============================================================================
// LOAD ANALYTICS
// ============================================================================

async function loadAnalytics(days) {
    showLoading();

    try {
        const result = await firebase.functions().httpsCallable('getSearchAnalytics')({
            days: days,
            limit: 50
        });

        if (result.data.success) {
            analyticsData = result.data.data;
            renderAnalytics(analyticsData, result.data.period);
        } else {
            throw new Error('Failed to load analytics');
        }

    } catch (error) {
        console.error('Load analytics error:', error);
        showFlashMessage('Failed to load analytics. Showing demo data.', 'warning');
        showDemoData();
    }
}

// ============================================================================
// RENDER ANALYTICS
// ============================================================================

function renderAnalytics(data, period) {
    // Update summary cards
    document.getElementById('totalSearches').textContent = data.summary.totalSearches.toLocaleString();
    document.getElementById('uniqueQueries').textContent = data.summary.uniqueQueries.toLocaleString();
    document.getElementById('avgResults').textContent = data.summary.avgResultsPerSearch;
    document.getElementById('zeroResultRate').textContent = data.summary.zeroResultRate + '%';

    // Render most searched table
    renderMostSearchedTable(data.mostSearched, data.trending);

    // Render trending grid
    renderTrendingGrid(data.trending);

    // Render categories chart
    renderCategoriesChart(data.topCategories);

    // Render zero results table
    renderZeroResultsTable(data.zeroResults);

    // Render hourly chart
    renderHourlyChart(data.hourlyDistribution);
}

function renderMostSearchedTable(mostSearched, trending) {
    const tbody = document.getElementById('mostSearchedTable');
    
    if (mostSearched.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No search data available</td></tr>';
        return;
    }

    tbody.innerHTML = mostSearched.map((item, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        
        // Find trending data
        const trendData = trending.find(t => t.query === item.query);
        let trendHtml = '<span class="trend-indicator">—</span>';
        
        if (trendData) {
            if (trendData.growth === 'new') {
                trendHtml = '<span class="trend-indicator trend-new"><i class="fas fa-star"></i> New</span>';
            } else if (trendData.growth === 'up') {
                trendHtml = `<span class="trend-indicator trend-up"><i class="fas fa-arrow-up"></i> ${trendData.growthPercent}%</span>`;
            } else if (trendData.growth === 'down') {
                trendHtml = `<span class="trend-indicator trend-down"><i class="fas fa-arrow-down"></i> ${Math.abs(trendData.growthPercent)}%</span>`;
            }
        }

        return `
            <tr>
                <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                <td><span class="search-query">${escapeHtml(item.query)}</span></td>
                <td><span class="search-count">${item.count.toLocaleString()}</span></td>
                <td>${trendHtml}</td>
                <td>
                    <button class="action-btn" onclick="viewSearchResults('${escapeHtml(item.query)}')">
                        <i class="fas fa-search"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderTrendingGrid(trending) {
    const grid = document.getElementById('trendingGrid');
    
    if (trending.length === 0) {
        grid.innerHTML = '<div class="loading">No trending searches in this period</div>';
        return;
    }

    grid.innerHTML = trending.map(item => {
        const isNew = item.growth === 'new';
        const growthText = isNew ? 'New Trend' : `${item.growthPercent}% growth`;
        const growthClass = isNew ? 'new' : '';

        return `
            <div class="trending-item ${growthClass}">
                <div class="trending-query">${escapeHtml(item.query)}</div>
                <div class="trending-stats">
                    <span>${item.recentCount} searches (7d)</span>
                    <span class="trending-growth ${growthClass}">${growthText}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderCategoriesChart(topCategories) {
    const chart = document.getElementById('categoriesChart');
    
    if (topCategories.length === 0) {
        chart.innerHTML = '<div class="loading">No category data available</div>';
        return;
    }

    const maxCount = Math.max(...topCategories.map(c => c.count));

    chart.innerHTML = topCategories.map(item => {
        const percentage = (item.count / maxCount) * 100;
        const categoryName = item.category === 'uncategorized' ? 'Uncategorized' : 
                           item.category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        return `
            <div class="category-item">
                <div class="category-name">${categoryName}</div>
                <div class="category-bar-container">
                    <div class="category-bar" style="width: ${percentage}%">
                        ${percentage > 20 ? item.count.toLocaleString() : ''}
                    </div>
                </div>
                <div class="category-count">${item.count.toLocaleString()}</div>
            </div>
        `;
    }).join('');
}

function renderZeroResultsTable(zeroResults) {
    const tbody = document.getElementById('zeroResultsTable');
    
    if (zeroResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="loading">No zero-result searches</td></tr>';
        return;
    }

    tbody.innerHTML = zeroResults.map(item => {
        let opportunityClass = 'opportunity-low';
        let opportunityText = 'Low';
        
        if (item.count >= 10) {
            opportunityClass = 'opportunity-high';
            opportunityText = 'High';
        } else if (item.count >= 5) {
            opportunityClass = 'opportunity-medium';
            opportunityText = 'Medium';
        }

        return `
            <tr>
                <td><span class="search-query">${escapeHtml(item.query)}</span></td>
                <td><span class="search-count">${item.count.toLocaleString()}</span></td>
                <td><span class="opportunity-badge ${opportunityClass}">${opportunityText} Opportunity</span></td>
            </tr>
        `;
    }).join('');
}

function renderHourlyChart(hourlyDistribution) {
    const chart = document.getElementById('hourlyChart');
    
    if (!hourlyDistribution || hourlyDistribution.length === 0) {
        chart.innerHTML = '<div class="loading">No activity data available</div>';
        return;
    }

    const maxCount = Math.max(...hourlyDistribution);

    chart.innerHTML = hourlyDistribution.map((count, hour) => {
        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const hourLabel = hour.toString().padStart(2, '0') + ':00';

        return `
            <div class="hour-bar" 
                 style="height: ${Math.max(height, 2)}%" 
                 data-hour="${hourLabel}" 
                 data-count="${count} searches">
            </div>
        `;
    }).join('');
}

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

function initExportButton() {
    document.getElementById('exportBtn').addEventListener('click', async function() {
        try {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

            const result = await firebase.functions().httpsCallable('exportSearchData')({
                days: currentPeriod
            });

            if (result.data.success) {
                downloadCSV(result.data.data, `search-analytics-${currentPeriod}days.csv`);
                showFlashMessage(`Exported ${result.data.count} search records`, 'success');
            } else {
                throw new Error('Export failed');
            }

        } catch (error) {
            console.error('Export error:', error);
            showFlashMessage('Failed to export data', 'error');
        } finally {
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-download"></i> Export CSV';
        }
    });
}

function downloadCSV(csvData, filename) {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function viewSearchResults(query) {
    window.open(`../../search.html?q=${encodeURIComponent(query)}`, '_blank');
}

function showLoading() {
    document.getElementById('mostSearchedTable').innerHTML = '<tr><td colspan="5" class="loading">Loading analytics...</td></tr>';
    document.getElementById('trendingGrid').innerHTML = '<div class="loading">Loading trending searches...</div>';
    document.getElementById('categoriesChart').innerHTML = '<div class="loading">Loading category data...</div>';
    document.getElementById('zeroResultsTable').innerHTML = '<tr><td colspan="3" class="loading">Loading data...</td></tr>';
    document.getElementById('hourlyChart').innerHTML = '<div class="loading">Loading activity data...</div>';
}

function showDemoData() {
    const demoData = {};

    renderAnalytics(demoData, { days: 30 });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showFlashMessage(message, type = 'info') {
    // Use existing flash message function if available
    if (typeof window.showFlashMessage === 'function') {
        window.showFlashMessage(message, type);
    } else {
        alert(message);
    }
}
