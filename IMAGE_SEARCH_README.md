# Image Search Feature - Enhanced Documentation

## Overview

The Sankofa Market image search feature allows users to find products by uploading images or providing image URLs. It uses **Google Cloud Vision API** for real image recognition and implements visual similarity algorithms to match uploaded images with products in the database.

## Features

### ✅ Core Capabilities

1. **Multiple Search Methods**
   - Upload images from device
   - Take photos with camera (mobile)
   - Drag and drop images
   - **Search by image URL** (new)
   - **Search history** (new)

2. **AI-Powered Image Analysis**
   - Object detection and labeling
   - Color analysis (dominant colors)
   - Text extraction (OCR)
   - Safe search filtering
   - Visual fingerprinting

3. **Visual Similarity Matching**
   - Label-based similarity scoring
   - Color profile matching
   - Object name matching
   - Category filtering
   - Confidence scoring

4. **Search History**
   - Automatic history saving
   - Replay previous searches
   - Delete individual items
   - Clear all history
   - Scheduled cleanup (90 days)

5. **Smart Results**
   - Ranked by similarity score
   - Category filtering
   - Product details display
   - Direct links to product pages

## Architecture

### Frontend (Client-Side)
- **Image Capture**: File input, camera, drag-drop, URL input
- **Image Preview**: Client-side preview before upload
- **UI Components**: Modal, tabs, history list, results grid
- **API Calls**: Firebase Functions invocation

### Backend (Firebase Cloud Functions)
- **Image Processing**: Sharp library for resizing
- **AI Analysis**: Google Cloud Vision API
- **Similarity Algorithm**: Custom fingerprint matching
- **Database**: Firestore for products and history
- **Storage**: Firebase Storage (optional for caching)

### Database Schema

```javascript
// Search History (users/{userId}/searchHistory/{searchId})
{
  imageData: "base64_preview_or_url",
  labels: [{ description, score, topicality }],
  colors: [{ hex, score, red, green, blue }],
  objects: [{ name, score, boundingBox }],
  texts: ["extracted_text_1", "extracted_text_2"],
  fingerprint: {
    labelScores: [{ desc, score }],
    colorProfile: [{ hex, score }],
    objectNames: ["object1", "object2"],
    primaryLabel: "primary_object",
    primaryColor: "#hex"
  },
  category: "electronics",
  resultsCount: 15,
  timestamp: Firestore Timestamp
}
```

## Setup & Configuration

### 1. Enable Google Cloud Vision API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **APIs & Services > Library**
4. Search for "Cloud Vision API"
5. Click **Enable**

### 2. Set Up Billing

Google Cloud Vision API requires billing to be enabled:
- Free tier: 1,000 requests/month
- After that: $1.50 per 1,000 requests

### 3. Install Cloud Functions Dependencies

```bash
cd functions
npm install
```

### 4. Deploy Cloud Functions

```bash
firebase deploy --only functions
```

### 5. Set Up Environment Variables (Optional)

For production, set up service account credentials:

```bash
firebase functions:config:set vision.key="YOUR_SERVICE_ACCOUNT_KEY"
```

## API Reference

### Cloud Functions

#### `analyzeImage`
Analyzes uploaded image and finds similar products.

**Parameters:**
```javascript
{
  imageData: "base64_encoded_image", // Required if no imageUrl
  imageUrl: "https://...",           // Required if no imageData
  category: "electronics"            // Optional filter
}
```

**Returns:**
```javascript
{
  success: true,
  analysis: {
    labels: [{ description, score, topicality }],
    colors: [{ hex, score, red, green, blue }],
    objects: [{ name, score, boundingBox }],
    texts: ["extracted_text"],
    fingerprint: { ... }
  },
  products: [{ id, title, price, image, ... }],
  message: "Found 15 similar products"
}
```

#### `searchByUrl`
Search by image URL (wrapper for analyzeImage).

**Parameters:**
```javascript
{
  imageUrl: "https://example.com/image.jpg",
  category: "fashion" // Optional
}
```

#### `getSearchHistory`
Retrieves user's search history.

**Parameters:**
```javascript
{
  limit: 20 // Optional, default 20
}
```

**Returns:**
```javascript
{
  success: true,
  history: [
    {
      id: "doc_id",
      imageData: "...",
      labels: [...],
      timestamp: Timestamp,
      resultsCount: 15
    }
  ]
}
```

#### `deleteSearchHistoryItem`
Deletes a single history item.

**Parameters:**
```javascript
{
  itemId: "history_doc_id"
}
```

#### `clearSearchHistory`
Clears all search history for the user.

**Parameters:** None

**Returns:**
```javascript
{
  success: true,
  message: "All search history cleared",
  count: 45
}
```

#### `cleanupOldSearchHistory` (Scheduled)
Automatically cleans up searches older than 90 days.
- Runs every Sunday at midnight (Africa/Accra timezone)

## Visual Similarity Algorithm

### Fingerprint Creation

The algorithm creates a unique fingerprint for each image:

```javascript
fingerprint = {
  labelScores: Top 15 labels with confidence scores,
  colorProfile: Top 5 dominant colors,
  objectNames: Detected object names,
  primaryLabel: Highest confidence label,
  primaryColor: Most dominant color
}
```

### Similarity Scoring

Products are scored out of 100 points:

| Component | Max Points | Method |
|-----------|-----------|--------|
| **Label Matching** | 40 | Match labels with product title/description |
| **Category Matching** | 20 | Primary label matches product category |
| **Object Matching** | 20 | Detected objects in product title/description |
| **Color Matching** | 10 | Color profile similarity (simplified) |
| **Text Matching** | 10 | Extracted text in product metadata |

**Formula:**
```javascript
score = (labelMatch * 40) + (categoryMatch * 20) + 
        (objectMatch * 20) + (colorMatch * 10) + (textMatch * 10)
```

### Ranking

Products are sorted by similarity score (descending) and top 20 are returned.

## Security & Privacy

### Content Filtering
- **Safe Search**: Blocks adult/violent content
- **Authentication**: All functions require user authentication
- **Input Validation**: URL and image format validation

### Data Protection
- **History Privacy**: Users can only access their own history
- **Automatic Cleanup**: 90-day retention policy
- **No Image Storage**: Images are processed but not stored (unless cached)

### Rate Limiting
- Firebase Functions has built-in rate limiting
- Consider adding custom rate limiting for production

## Performance Optimization

### Image Processing
- **Resizing**: Images resized to 800x800 max before analysis
- **Compression**: JPEG quality 85% for faster processing
- **Caching**: Consider caching analysis results for duplicate images

### Database Queries
- **Indexed Queries**: Category and timestamp indexed
- **Pagination**: History limited to 20 items by default
- **Batch Operations**: Bulk delete for history cleanup

### API Optimization
- **Batch Features**: Multiple Vision API features in one call
- **Result Limiting**: Top 20 products returned
- **Lazy Loading**: Results loaded on demand

## Usage Examples

### Frontend: Upload Image
```javascript
// User uploads image
const file = input.files[0];
const reader = new FileReader();

reader.onload = async (e) => {
  const imageData = e.target.result;
  
  const result = await firebase.functions()
    .httpsCallable('analyzeImage')({
      imageData: imageData,
      category: 'electronics'
    });
  
  console.log(result.data.products);
};

reader.readAsDataURL(file);
```

### Frontend: Search by URL
```javascript
const result = await firebase.functions()
  .httpsCallable('searchByUrl')({
    imageUrl: 'https://example.com/product.jpg',
    category: 'fashion'
  });

displayResults(result.data.products);
```

### Frontend: Get History
```javascript
const result = await firebase.functions()
  .httpsCallable('getSearchHistory')({
    limit: 10
  });

renderHistory(result.data.history);
```

## Troubleshooting

### Common Issues

**"Image contains inappropriate content"**
- Safe Search detected adult/violent content
- Upload a different image

**"Failed to analyze image"**
- Check Vision API is enabled
- Verify billing is set up
- Check Firebase Functions logs

**"No similar products found"**
- Try without category filter
- Upload clearer images
- Ensure products exist in database

**"User must be authenticated"**
- User must be logged in
- Check Firebase Auth setup

### Debug Mode

Enable verbose logging in Cloud Functions:

```javascript
functions.logger.setLogLevel('DEBUG');
```

View logs:
```bash
firebase functions:log
```

## Cost Estimation

### Google Cloud Vision API
- **Free Tier**: 1,000 requests/month
- **Standard**: $1.50 per 1,000 requests
- **Features Used**: Label, Object, Color, Text, Safe Search

### Firebase Cloud Functions
- **Free Tier**: 2M invocations/month
- **Standard**: $0.40 per million invocations
- **Compute Time**: $0.0000100 per GB-second

### Example Costs (10,000 searches/month)
- Vision API: $15.00
- Cloud Functions: ~$2.00
- **Total**: ~$17.00/month

## Future Enhancements

### Planned Features
1. **Image Caching**: Store analysis results to avoid re-processing
2. **Batch Upload**: Search multiple images at once
3. **Advanced Filters**: Price range, condition, seller rating
4. **Visual Search Suggestions**: "Try searching for..."
5. **ML Model Training**: Custom model for Ghanaian products
6. **Reverse Image Search**: Find where else image appears online
7. **AR Preview**: See products in your space

### Technical Improvements
1. **Vector Embeddings**: Use ML embeddings for better similarity
2. **CDN Integration**: Cache results at edge
3. **Progressive Web App**: Offline search capability
4. **Real-time Updates**: WebSocket for live results
5. **A/B Testing**: Test different similarity algorithms

## Support

For issues or questions:
- **GitHub Issues**: Report bugs and request features
- **Firebase Support**: For Cloud Functions issues
- **Google Cloud Support**: For Vision API issues

## License

© 2026 Sankofa Market. All rights reserved.

---

**Made with ❤️ in Ghana 🇬🇭**
