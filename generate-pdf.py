#!/usr/bin/env python3
"""
Generate PDF from Sankofa Market Guide with letterhead
"""

import markdown
from weasyprint import HTML, CSS
from pathlib import Path

# Read the markdown file
md_file = Path('SANKOFA-MARKET-GUIDE.md')
md_content = md_file.read_text(encoding='utf-8')

# Read the letterhead CSS
css_file = Path('css/letterhead.css')
css_content = css_file.read_text(encoding='utf-8')

# Add additional CSS for better PDF rendering
additional_css = """
@page {
    size: A4;
    margin: 2cm;
    
    @top-center {
        content: "";
    }
    
    @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9pt;
        color: #767676;
    }
}

@page :first {
    @top-center {
        content: "";
    }
}

body {
    font-family: 'Arial', sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #333;
}

h1 {
    font-size: 24pt;
    color: #0064d2;
    border-bottom: 3px solid #f5af02;
    padding-bottom: 10px;
    margin-top: 30px;
    page-break-after: avoid;
}

h2 {
    font-size: 18pt;
    color: #0064d2;
    border-bottom: 2px solid #e5e5e5;
    padding-bottom: 8px;
    margin-top: 25px;
    page-break-after: avoid;
}

h3 {
    font-size: 14pt;
    color: #191919;
    margin-top: 20px;
    page-break-after: avoid;
}

h4 {
    font-size: 12pt;
    color: #0064d2;
    margin-top: 15px;
    page-break-after: avoid;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    page-break-inside: avoid;
}

th, td {
    border: 1px solid #e5e5e5;
    padding: 8px;
    text-align: left;
}

th {
    background-color: #f8f9fa;
    font-weight: bold;
}

code {
    background-color: #f8f9fa;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 10pt;
}

pre {
    background-color: #f8f9fa;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
    font-size: 9pt;
    page-break-inside: avoid;
}

blockquote {
    border-left: 4px solid #0064d2;
    padding-left: 15px;
    margin-left: 0;
    color: #555;
}

.highlight-box {
    background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
    border-left: 5px solid #ffc107;
    padding: 15px;
    margin: 15px 0;
    border-radius: 8px;
    page-break-inside: avoid;
}

.critical-warning {
    background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
    border-left: 5px solid #dc3545;
    padding: 15px;
    margin: 15px 0;
    border-radius: 8px;
    page-break-inside: avoid;
}

.info-box {
    background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
    border-left: 5px solid #17a2b8;
    padding: 15px;
    margin: 15px 0;
    border-radius: 8px;
    page-break-inside: avoid;
}

.page-break {
    page-break-after: always;
}

.no-break {
    page-break-inside: avoid;
}

img {
    max-width: 100%;
    height: auto;
}

ul, ol {
    margin-left: 20px;
}

li {
    margin-bottom: 5px;
}

a {
    color: #0064d2;
    text-decoration: none;
}

hr {
    border: none;
    border-top: 2px solid #e5e5e5;
    margin: 30px 0;
}

/* Letterhead on first page */
.letterhead {
    page-break-after: avoid;
    margin-bottom: 30px;
}

/* Footer on all pages */
.letterhead-footer {
    page-break-before: always;
    margin-top: 50px;
}
"""

# Create letterhead HTML structure
letterhead_html = """
<div class="letterhead">
    <div class="letterhead-container">
        <div class="letterhead-left">
            <img src="images/logos/sankofa-market-logo-full-color.png" alt="Sankofa Market Ghana" class="letterhead-logo">
            <div class="letterhead-text">
                <h1 class="letterhead-title">Sankofa Market Ghana</h1>
                <p class="letterhead-subtitle">Ghana's Premier Online Marketplace</p>
                <p class="letterhead-tagline">Connecting Buyers and Sellers Across Ghana</p>
            </div>
        </div>
        <div class="letterhead-right">
            <div class="letterhead-contact">
                <div class="letterhead-contact-item">
                    <i class="fas fa-globe"></i>
                    <a href="https://sankofamarket.com.gh">sankofamarket.com.gh</a>
                </div>
                <div class="letterhead-contact-item">
                    <i class="fas fa-envelope"></i>
                    <a href="mailto:info@sankofamarket.com.gh">info@sankofamarket.com.gh</a>
                </div>
                <div class="letterhead-contact-item">
                    <i class="fas fa-phone"></i>
                    <span>+233 XX XXX XXXX</span>
                </div>
                <div class="letterhead-contact-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>Accra, Ghana</span>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="ghana-accent"></div>
"""

# Create footer HTML structure
footer_html = """
<div class="letterhead-footer">
    <div class="letterhead-footer-container">
        <div class="footer-top">
            <div class="footer-section">
                <h3>About Us</h3>
                <p>Sankofa Market Ghana is Ghana's premier online marketplace, connecting buyers and sellers across all 16 regions with safety, convenience, and trust.</p>
            </div>
            <div class="footer-section">
                <h3>Quick Links</h3>
                <ul>
                    <li><a href="https://sankofamarket.com.gh">Home</a></li>
                    <li><a href="https://sankofamarket.com.gh/about">About Us</a></li>
                    <li><a href="https://sankofamarket.com.gh/help">Help Center</a></li>
                    <li><a href="https://sankofamarket.com.gh/contact">Contact Us</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h3>Categories</h3>
                <ul>
                    <li><a href="https://sankofamarket.com.gh/category/electronics">Electronics</a></li>
                    <li><a href="https://sankofamarket.com.gh/category/fashion">Fashion</a></li>
                    <li><a href="https://sankofamarket.com.gh/category/home-garden">Home & Garden</a></li>
                    <li><a href="https://sankofamarket.com.gh/categories">All Categories</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h3>Contact Us</h3>
                <div class="footer-contact-item">
                    <i class="fas fa-envelope"></i>
                    <a href="mailto:info@sankofamarket.com.gh">info@sankofamarket.com.gh</a>
                </div>
                <div class="footer-contact-item">
                    <i class="fas fa-phone"></i>
                    <span>+233 XX XXX XXXX</span>
                </div>
                <div class="footer-contact-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>Accra, Ghana</span>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <div class="footer-copyright">
                <p>&copy; 2026 Sankofa Market Ghana. All rights reserved.</p>
            </div>
            <div class="footer-legal">
                <a href="https://sankofamarket.com.gh/terms">Terms</a>
                <a href="https://sankofamarket.com.gh/privacy">Privacy</a>
                <a href="https://sankofamarket.com.gh/cookies">Cookies</a>
            </div>
        </div>
    </div>
</div>
"""

# Combine CSS
full_css = css_content + additional_css

# Convert markdown to HTML
html_content = markdown.markdown(
    md_content,
    extensions=['tables', 'fenced_code', 'codehilite', 'toc']
)

# Create full HTML document with letterhead and footer
full_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sankofa Market Ghana - Complete User Guide</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
{full_css}
    </style>
</head>
<body>
{letterhead_html}
{html_content}
{footer_html}
</body>
</html>
"""

# Save HTML file (for reference)
html_file = Path('SANKOFA-MARKET-GUIDE.html')
html_file.write_text(full_html, encoding='utf-8')
print(f"✓ HTML file created: {html_file}")

# Generate PDF
pdf_file = Path('SANKOFA-MARKET-GUIDE.pdf')
HTML(string=full_html, base_url='.').write_pdf(
    str(pdf_file),
    stylesheets=[CSS(string=full_css)]
)
print(f"✓ PDF file created: {pdf_file}")

print("\n✓ Conversion complete!")
print(f"  - HTML: {html_file.absolute()}")
print(f"  - PDF: {pdf_file.absolute()}")
