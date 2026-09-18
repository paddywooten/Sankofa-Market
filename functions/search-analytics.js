/**
 * Search Analytics Cloud Functions
 * Aggregates search data for admin dashboard
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Get search analytics data
 */
exports.getSearchAnalytics = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if user is admin
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    try {
        const days = data.days || 30;
        const limit = data.limit || 50;
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get search logs from the specified period
        const searchLogsSnapshot = await db.collection('search_logs')
            .where('timestamp', '>=', startDate)
            .orderBy('timestamp', 'desc')
            .limit(10000)
            .get();

        const searches = [];
        searchLogsSnapshot.forEach(doc => {
            searches.push(doc.data());
        });

        // Aggregate data
        const analytics = aggregateSearchData(searches, limit);

        return {
            success: true,
            data: analytics,
            period: {
                days: days,
                totalSearches: searches.length,
                startDate: startDate.toISOString(),
                endDate: new Date().toISOString()
            }
        };

    } catch (error) {
        console.error('Search analytics error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to retrieve analytics');
    }
});

/**
 * Aggregate search data into meaningful metrics
 */
function aggregateSearchData(searches, limit) {
    // Most searched queries
    const queryCounts = {};
    const categoryCounts = {};
    const zeroResultQueries = {};
    const hourlyDistribution = new Array(24).fill(0);
    const dailyDistribution = {};
    
    searches.forEach(search => {
        const query = search.query || '';
        const category = search.category || 'uncategorized';
        const resultsCount = search.resultsCount || 0;
        const timestamp = search.timestamp?.toDate ? search.timestamp.toDate() : new Date();
        
        // Count queries
        if (query) {
            queryCounts[query] = (queryCounts[query] || 0) + 1;
            
            // Track zero-result queries
            if (resultsCount === 0) {
                zeroResultQueries[query] = (zeroResultQueries[query] || 0) + 1;
            }
        }
        
        // Count categories
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        
        // Hourly distribution
        const hour = timestamp.getHours();
        hourlyDistribution[hour]++;
        
        // Daily distribution
        const dateKey = timestamp.toISOString().split('T')[0];
        dailyDistribution[dateKey] = (dailyDistribution[dateKey] || 0) + 1;
    });

    // Convert to arrays and sort
    const mostSearched = Object.entries(queryCounts)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    const topCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const zeroResults = Object.entries(zeroResultQueries)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    // Trending searches (queries that increased in last 7 days vs previous 7 days)
    const trending = calculateTrending(searches);

    return {
        mostSearched,
        topCategories,
        zeroResults,
        trending,
        hourlyDistribution,
        dailyDistribution,
        summary: {
            totalSearches: searches.length,
            uniqueQueries: Object.keys(queryCounts).length,
            avgResultsPerSearch: searches.length > 0 
                ? Math.round(searches.reduce((sum, s) => sum + (s.resultsCount || 0), 0) / searches.length)
                : 0,
            zeroResultRate: searches.length > 0
                ? Math.round((Object.values(zeroResultQueries).reduce((a, b) => a + b, 0) / searches.length) * 100)
                : 0
        }
    };
}

/**
 * Calculate trending searches
 */
function calculateTrending(searches) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentCounts = {};
    const previousCounts = {};

    searches.forEach(search => {
        const query = search.query || '';
        if (!query) return;

        const timestamp = search.timestamp?.toDate ? search.timestamp.toDate() : new Date();

        if (timestamp >= sevenDaysAgo) {
            recentCounts[query] = (recentCounts[query] || 0) + 1;
        } else if (timestamp >= fourteenDaysAgo) {
            previousCounts[query] = (previousCounts[query] || 0) + 1;
        }
    });

    const trending = [];
    Object.keys(recentCounts).forEach(query => {
        const recent = recentCounts[query];
        const previous = previousCounts[query] || 0;
        
        if (previous === 0 && recent >= 3) {
            // New trending query
            trending.push({
                query,
                recentCount: recent,
                previousCount: previous,
                growth: 'new',
                growthPercent: 100
            });
        } else if (previous > 0) {
            const growth = ((recent - previous) / previous) * 100;
            if (growth > 20 && recent >= 2) {
                trending.push({
                    query,
                    recentCount: recent,
                    previousCount: previous,
                    growth: growth > 0 ? 'up' : 'down',
                    growthPercent: Math.round(growth)
                });
            }
        }
    });

    return trending
        .sort((a, b) => b.recentCount - a.recentCount)
        .slice(0, 15);
}

/**
 * Scheduled function: Clean up old search logs (older than 90 days)
 */
exports.cleanupOldSearchLogs = functions.pubsub
    .schedule('0 0 * * 0') // Every Sunday at midnight
    .timeZone('Africa/Accra')
    .onRun(async (context) => {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        try {
            const snapshot = await db.collection('search_logs')
                .where('timestamp', '<', ninetyDaysAgo)
                .limit(500)
                .get();

            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`Cleaned ${snapshot.size} old search logs`);
            }

            return null;
        } catch (error) {
            console.error('Cleanup error:', error);
            return null;
        }
    });

/**
 * Export search data to CSV (for admin download)
 */
exports.exportSearchData = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if user is admin
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    try {
        const days = data.days || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const snapshot = await db.collection('search_logs')
            .where('timestamp', '>=', startDate)
            .orderBy('timestamp', 'desc')
            .get();

        const searches = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            searches.push({
                query: data.query || '',
                category: data.category || '',
                resultsCount: data.resultsCount || 0,
                timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : '',
                userId: data.userId || 'anonymous'
            });
        });

        // Convert to CSV
        const csv = convertToCSV(searches);

        return {
            success: true,
            data: csv,
            count: searches.length
        };

    } catch (error) {
        console.error('Export error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to export data');
    }
});

/**
 * Convert array to CSV string
 */
function convertToCSV(data) {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma
            const escaped = String(value).replace(/"/g, '""');
            return escaped.includes(',') ? `"${escaped}"` : escaped;
        });
        csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
}
