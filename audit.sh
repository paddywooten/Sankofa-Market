#!/bin/bash

# Sankofa Market - Comprehensive File Audit Script

echo "==================================================================="
echo "SANKOFA MARKET - COMPREHENSIVE FILE AUDIT"
echo "==================================================================="
echo ""

# 1. File Structure Analysis
echo "1. FILE STRUCTURE ANALYSIS"
echo "-------------------------------------------------------------------"
echo "Total HTML files: $(find . -name '*.html' | wc -l)"
echo "Total JS files: $(find . -name '*.js' | wc -l)"
echo "Total CSS files: $(find . -name '*.css' | wc -l)"
echo "Total image files: $(find ./images -type f 2>/dev/null | wc -l)"
echo ""

# 2. Security Checks
echo "2. SECURITY AUDIT"
echo "-------------------------------------------------------------------"

# Check for hardcoded credentials
echo "Checking for hardcoded API keys/credentials..."
HARDCODED=$(grep -r "apiKey.*AIza" . --include="*.js" --include="*.html" 2>/dev/null | wc -l)
if [ $HARDCODED -gt 0 ]; then
    echo "⚠️  WARNING: Found $HARDCODED hardcoded API keys!"
    grep -r "apiKey.*AIza" . --include="*.js" --include="*.html" 2>/dev/null | head -5
else
    echo "✅ No hardcoded API keys found"
fi
echo ""

# Check for console.log statements
echo "Checking for console.log statements in production..."
CONSOLE_LOGS=$(grep -r "console.log" . --include="*.js" 2>/dev/null | grep -v "node_modules" | wc -l)
echo "ℹ️  Found $CONSOLE_LOGS console.log statements (review for production)"
echo ""

# Check for exposed admin routes
echo "Checking for exposed admin routes..."
ADMIN_ROUTES=$(grep -r "pages/admin" . --include="*.html" --include="*.js" 2>/dev/null | grep -v "admin-auth.js" | wc -l)
echo "ℹ️  Found $ADMIN_ROUTES references to admin routes"
echo ""

# Check for authentication checks
echo "Checking authentication implementation..."
AUTH_CHECKS=$(grep -r "firebase.auth()" . --include="*.js" 2>/dev/null | wc -l)
echo "✅ Found $AUTH_CHECKS Firebase auth implementations"
echo ""

# 3. Legal Document Check
echo "3. LEGAL DOCUMENTS AUDIT"
echo "-------------------------------------------------------------------"
LEGAL_DOCS=(
    "terms.html:Terms of Service"
    "privacy.html:Privacy Policy"
    "cookies.html:Cookie Policy"
    "refund-policy.html:Refund Policy"
    "shipping-policy.html:Shipping Policy"
    "disclaimer.html:Disclaimer"
    "acceptable-use.html:Acceptable Use Policy"
    "seller-agreement.html:Seller Agreement"
    "buyer-protection.html:Buyer Protection Policy"
    "prohibited-items.html:Prohibited Items List"
    "intellectual-property.html:Intellectual Property Policy"
    "contact.html:Contact Page"
    "about.html:About Page"
)

for doc in "${LEGAL_DOCS[@]}"; do
    IFS=':' read -r file name <<< "$doc"
    if [ -f "./$file" ] || [ -f "./pages/$file" ]; then
        echo "✅ $name exists"
    else
        echo "❌ MISSING: $name ($file)"
    fi
done
echo ""

# 4. Meta Tags Audit
echo "4. SEO & META TAGS AUDIT"
echo "-------------------------------------------------------------------"
HTML_FILES=$(find . -name '*.html' -not -path './node_modules/*' 2>/dev/null)
MISSING_META=0

for file in $HTML_FILES; do
    if ! grep -q "<meta name=\"description\"" "$file" 2>/dev/null; then
        echo "⚠️  Missing meta description: $file"
        MISSING_META=$((MISSING_META + 1))
    fi
    if ! grep -q "<meta name=\"viewport\"" "$file" 2>/dev/null; then
        echo "⚠️  Missing viewport meta: $file"
        MISSING_META=$((MISSING_META + 1))
    fi
done

if [ $MISSING_META -eq 0 ]; then
    echo "✅ All HTML files have proper meta tags"
fi
echo ""

# 5. Accessibility Audit
echo "5. ACCESSIBILITY AUDIT"
echo "-------------------------------------------------------------------"

# Check for alt attributes on images
IMAGES_WITHOUT_ALT=$(grep -r "<img" . --include="*.html" 2>/dev/null | grep -v "alt=" | wc -l)
if [ $IMAGES_WITHOUT_ALT -gt 0 ]; then
    echo "⚠️  Found $IMAGES_WITHOUT_ALT images without alt attributes"
else
    echo "✅ All images have alt attributes"
fi

# Check for form labels
FORMS_WITHOUT_LABELS=$(grep -r "<input" . --include="*.html" 2>/dev/null | grep -v "label" | wc -l)
echo "ℹ️  Found $FORMS_WITHOUT_LABELS inputs (manual review needed for labels)"
echo ""

# 6. Performance Audit
echo "6. PERFORMANCE AUDIT"
echo "-------------------------------------------------------------------"

# Check for large files
LARGE_FILES=$(find . -type f \( -name "*.js" -o -name "*.css" \) -size +100k 2>/dev/null | wc -l)
if [ $LARGE_FILES -gt 0 ]; then
    echo "⚠️  Found $LARGE_FILES files larger than 100KB:"
    find . -type f \( -name "*.js" -o -name "*.css" \) -size +100k 2>/dev/null | head -5
else
    echo "✅ No excessively large files found"
fi

# Check for minified files
MINIFIED=$(find . -name "*.min.js" -o -name "*.min.css" 2>/dev/null | wc -l)
echo "ℹ️  Found $MINIFIED minified files"
echo ""

# 7. Responsive Design Audit
echo "7. RESPONSIVE DESIGN AUDIT"
echo "-------------------------------------------------------------------"
MEDIA_QUERIES=$(grep -r "@media" . --include="*.css" 2>/dev/null | wc -l)
echo "✅ Found $MEDIA_QUERIES media queries for responsive design"
echo ""

# 8. External Resources Audit
echo "8. EXTERNAL RESOURCES AUDIT"
echo "-------------------------------------------------------------------"
CDN_LINKS=$(grep -r "cdnjs.cloudflare.com\|fonts.googleapis.com\|fonts.gstatic.com" . --include="*.html" 2>/dev/null | wc -l)
echo "ℹ️  Found $CDN_LINKS external CDN/font references"
echo ""

# 9. Database/Firestore Security
echo "9. DATABASE SECURITY AUDIT"
echo "-------------------------------------------------------------------"
FIRESTORE_RULES=$(find . -name "firestore.rules" 2>/dev/null | wc -l)
if [ $FIRESTORE_RULES -gt 0 ]; then
    echo "✅ Firestore rules file exists"
else
    echo "⚠️  No Firestore rules file found (important for security)"
fi

STORAGE_RULES=$(find . -name "storage.rules" 2>/dev/null | wc -l)
if [ $STORAGE_RULES -gt 0 ]; then
    echo "✅ Storage rules file exists"
else
    echo "⚠️  No Storage rules file found (important for security)"
fi
echo ""

# 10. Error Handling Audit
echo "10. ERROR HANDLING AUDIT"
echo "-------------------------------------------------------------------"
TRY_CATCH=$(grep -r "try {" . --include="*.js" 2>/dev/null | wc -l)
CATCH=$(grep -r "catch" . --include="*.js" 2>/dev/null | wc -l)
echo "✅ Found $TRY_CATCH try blocks and $CATCH catch blocks"
echo ""

# 11. User Input Validation
echo "11. INPUT VALIDATION AUDIT"
echo "-------------------------------------------------------------------"
VALIDATION=$(grep -r "validate\|validation\|required" . --include="*.js" 2>/dev/null | wc -l)
echo "✅ Found $VALIDATION validation-related code references"
echo ""

# 12. Summary
echo "==================================================================="
echo "AUDIT SUMMARY"
echo "==================================================================="
echo "Total files audited: $(find . -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \) | wc -l)"
echo ""
echo "RECOMMENDATIONS:"
echo "1. Create missing legal documents (Terms, Privacy, etc.)"
echo "2. Review console.log statements for production"
echo "3. Add Firestore and Storage security rules"
echo "4. Ensure all images have alt attributes"
echo "5. Add meta descriptions to all pages"
echo "6. Consider minifying CSS/JS for production"
echo ""
echo "==================================================================="
