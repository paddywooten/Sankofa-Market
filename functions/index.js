const functions = require('firebase-functions');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const axios = require('axios');
const sharp = require('sharp');

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();
const visionClient = new vision.ImageAnnotatorClient();

/**
 * Analyze uploaded image and extract features
 */
exports.analyzeImage = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { imageData, imageUrl, category } = data;
  const userId = context.auth.uid;

  try {
    let imageBuffer;
    
    // Handle base64 image data or URL
    if (imageData) {
      imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
    } else if (imageUrl) {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data, 'binary');
    } else {
      throw new functions.https.HttpsError('invalid-argument', 'No image data provided');
    }

    // Resize image for faster processing
    const resizedImage = await sharp(imageBuffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Analyze image with Google Vision API
    const [result] = await visionClient.annotateImage({
      image: { content: resizedImage.toString('base64') },
      features: [
        { type: 'LABEL_DETECTION', maxResults: 20 },
        { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
        { type: 'IMAGE_PROPERTIES', maxResults: 10 },
        { type: 'TEXT_DETECTION', maxResults: 10 },
        { type: 'SAFE_SEARCH_DETECTION' }
      ]
    });

    // Extract features
    const labels = result.labelAnnotations || [];
    const objects = result.localizedObjectAnnotations || [];
    const colors = result.imagePropertiesAnnotation?.dominantColors?.colors || [];
    const texts = result.textAnnotations || [];
    const safeSearch = result.safeSearchAnnotation || {};

    // Check for adult/violent content
    if (safeSearch.adult === 'LIKELY' || safeSearch.adult === 'VERY_LIKELY' ||
        safeSearch.violence === 'LIKELY' || safeSearch.violence === 'VERY_LIKELY') {
      throw new functions.https.HttpsError('failed-precondition', 'Image contains inappropriate content');
    }

    // Extract dominant colors
    const dominantColors = colors.slice(0, 5).map(color => ({
      red: color.color.red,
      green: color.color.green,
      blue: color.color.blue,
      score: color.score,
      hex: rgbToHex(color.color.red, color.color.green, color.color.blue)
    }));

    // Extract top labels with confidence
    const topLabels = labels.slice(0, 15).map(label => ({
      description: label.description,
      score: label.score,
      topicality: label.topicality
    }));

    // Extract detected objects
    const detectedObjects = objects.slice(0, 10).map(obj => ({
      name: obj.name,
      score: obj.score,
      boundingBox: obj.boundingPoly
    }));

    // Extract text from image
    const detectedText = texts.slice(0, 5).map(text => text.description);

    // Create image fingerprint for similarity matching
    const fingerprint = createImageFingerprint(topLabels, dominantColors, detectedObjects);

    // Find similar products
    const similarProducts = await findSimilarProducts(fingerprint, category);

    // Save search to history
    await saveSearchHistory(userId, {
      imageData: imageData ? imageData.substring(0, 100) + '...' : imageUrl,
      labels: topLabels,
      colors: dominantColors,
      objects: detectedObjects,
      texts: detectedText,
      fingerprint,
      category,
      resultsCount: similarProducts.length,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      analysis: {
        labels: topLabels,
        colors: dominantColors,
        objects: detectedObjects,
        texts: detectedText,
        fingerprint
      },
      products: similarProducts,
      message: `Found ${similarProducts.length} similar products`
    };

  } catch (error) {
    console.error('Image analysis error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to analyze image');
  }
});

/**
 * Search by image URL
 */
exports.searchByUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { imageUrl, category } = data;
  
  if (!imageUrl) {
    throw new functions.https.HttpsError('invalid-argument', 'Image URL is required');
  }

  // Validate URL
  try {
    new URL(imageUrl);
  } catch (e) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid URL format');
  }

  // Reuse analyzeImage logic
  return exports.analyzeImage({ imageData: null, imageUrl, category }, context);
});

/**
 * Get user's search history
 */
exports.getSearchHistory = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;
  const limit = data.limit || 20;

  try {
    const snapshot = await db.collection('users')
      .doc(userId)
      .collection('searchHistory')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const history = [];
    snapshot.forEach(doc => {
      history.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      success: true,
      history
    };

  } catch (error) {
    console.error('Get history error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve search history');
  }
});

/**
 * Delete search history item
 */
exports.deleteSearchHistoryItem = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;
  const { itemId } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'Item ID is required');
  }

  try {
    await db.collection('users')
      .doc(userId)
      .collection('searchHistory')
      .doc(itemId)
      .delete();

    return {
      success: true,
      message: 'Search history item deleted'
    };

  } catch (error) {
    console.error('Delete history error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to delete search history item');
  }
});

/**
 * Clear all search history
 */
exports.clearSearchHistory = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    const snapshot = await db.collection('users')
      .doc(userId)
      .collection('searchHistory')
      .get();

    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return {
      success: true,
      message: 'All search history cleared',
      count: snapshot.size
    };

  } catch (error) {
    console.error('Clear history error:', error);
    throw new functions.HttpsError('internal', 'Failed to clear search history');
  }
});

/**
 * Helper: Convert RGB to Hex
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Helper: Create image fingerprint for similarity matching
 */
function createImageFingerprint(labels, colors, objects) {
  return {
    labelScores: labels.map(l => ({ desc: l.description.toLowerCase(), score: l.score })),
    colorProfile: colors.map(c => ({ hex: c.hex, score: c.score })),
    objectNames: objects.map(o => o.name.toLowerCase()),
    primaryLabel: labels[0]?.description.toLowerCase() || 'unknown',
    primaryColor: colors[0]?.hex || '#000000'
  };
}

/**
 * Helper: Find similar products using fingerprint
 */
async function findSimilarProducts(fingerprint, categoryFilter) {
  try {
    let query = db.collection('products').where('isActive', '==', true);
    
    if (categoryFilter) {
      query = query.where('category', '==', categoryFilter);
    }

    const snapshot = await query.limit(100).get();
    
    if (snapshot.empty) {
      return [];
    }

    const products = [];
    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Calculate similarity scores
    const scoredProducts = products.map(product => {
      const score = calculateSimilarityScore(fingerprint, product);
      return { ...product, similarityScore: score };
    });

    // Sort by similarity score and return top 20
    scoredProducts.sort((a, b) => b.similarityScore - a.similarityScore);
    
    return scoredProducts.slice(0, 20).map(product => {
      const { similarityScore, ...productData } = product;
      return productData;
    });

  } catch (error) {
    console.error('Find similar products error:', error);
    return [];
  }
}

/**
 * Helper: Calculate similarity score between fingerprint and product
 */
function calculateSimilarityScore(fingerprint, product) {
  let score = 0;
  const maxScore = 100;

  // Label matching (40 points max)
  const productTitle = (product.title || '').toLowerCase();
  const productDesc = (product.description || '').toLowerCase();
  
  fingerprint.labelScores.forEach(label => {
    if (productTitle.includes(label.desc) || productDesc.includes(label.desc)) {
      score += label.score * 40;
    }
  });

  // Category matching (20 points)
  if (product.category && fingerprint.primaryLabel.includes(product.category)) {
    score += 20;
  }

  // Object name matching (20 points)
  fingerprint.objectNames.forEach(objName => {
    if (productTitle.includes(objName) || productDesc.includes(objName)) {
      score += 20 / fingerprint.objectNames.length;
    }
  });

  // Color matching (10 points)
  // This is simplified - in production, you'd compare actual product images
  score += 10;

  // Text matching (10 points)
  if (product.title || product.description) {
    score += 10;
  }

  return Math.min(score, maxScore);
}

/**
 * Helper: Save search to user's history
 */
async function saveSearchHistory(userId, searchData) {
  try {
    await db.collection('users')
      .doc(userId)
      .collection('searchHistory')
      .add(searchData);
  } catch (error) {
    console.error('Save history error:', error);
    // Don't throw - history saving is not critical
  }
}

/**
 * Scheduled function: Clean up old search history (older than 90 days)
 */
exports.cleanupOldSearchHistory = functions.pubsub
  .schedule('0 0 * * 0') // Every Sunday at midnight
  .timeZone('Africa/Accra')
  .onRun(async (context) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    try {
      const usersSnapshot = await db.collection('users').get();
      
      for (const userDoc of usersSnapshot.docs) {
        const historySnapshot = await db.collection('users')
          .doc(userDoc.id)
          .collection('searchHistory')
          .where('timestamp', '<', ninetyDaysAgo)
          .get();

        if (!historySnapshot.empty) {
          const batch = db.batch();
          historySnapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          console.log(`Cleaned ${historySnapshot.size} old searches for user ${userDoc.id}`);
        }
      }

      console.log('Search history cleanup completed');
      return null;

    } catch (error) {
      console.error('Cleanup error:', error);
      return null;
    }
  });
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
