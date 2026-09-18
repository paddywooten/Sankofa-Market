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
}

h2 {
    font-size: 18pt;
    color: #0064d2;
    border-bottom: 2px solid #e5e5e5;
    padding-bottom: 8px;
    margin-top: 25px;
}

h3 {
    font-size: 14pt;
    color: #191919;
    margin-top: 20px;
}

h4 {
    font-size: 12pt;
    color: #0064d2;
    margin-top: 15px;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
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
}

.critical-warning {
    background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
    border-left: 5px solid #dc3545;
    padding: 15px;
    margin: 15px 0;
    border-radius: 8px;
}

.info-box {
    background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
    border-left: 5px solid #17a2b8;
    padding: 15px;
    margin: 15px 0;
    border-radius: 8px;
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
"""

# Combine CSS
full_css = css_content + additional_css

# Convert markdown to HTML
html_content = markdown.markdown(
    md_content,
    extensions=['tables', 'fenced_code', 'codehilite', 'toc']
)

# Create full HTML document
full_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sankofa Market Ghana - Complete User Guide</title>
    <style>
{full_css}
    </style>
</head>
<body>
{html_content}
</body>
</html>
"""

# Save HTML file (for reference)
html_file = Path('SANKOFA-MARKET-GUIDE.html')
html_file.write_text(full_html, encoding='utf-8')
print(f"✓ HTML file created: {html_file}")

# Generate PDF
pdf_file = Path('SANKOFA-MARKET-GUIDE.pdf')
HTML(string=full_html).write_pdf(
    str(pdf_file),
    stylesheets=[CSS(string=full_css)]
)
print(f"✓ PDF file created: {pdf_file}")

print("\n✓ Conversion complete!")
print(f"  - HTML: {html_file.absolute()}")
print(f"  - PDF: {pdf_file.absolute()}")
