# E-Commerce Website Frontend Requirements

## Project Overview
Build a modern e-commerce website frontend for selling AI-powered agents and automation tools.

## Core Pages Required

### 1. Landing Page (index.html)
- Hero section with compelling headline about AI agents
- Featured products grid (3-4 highlighted agents)
- Benefits section explaining why businesses need AI agents
- Call-to-action buttons leading to product catalog

### 2. Product Catalog Page (products.html)
- Grid layout showing all available AI agents
- Each product card should display:
  - Agent name
  - Brief description
  - Price
  - "Add to Cart" button
- Simple category filter (e.g., Customer Service, Data Analysis, Content Creation)

### 3. Product Detail Page (product-detail.html)
- Detailed information about a specific AI agent
- Features list
- Use cases
- Pricing tiers
- "Add to Cart" functionality
- Customer reviews section (mock data)

### 4. Shopping Cart Page (cart.html)
- List of selected items
- Quantity adjustment
- Price calculation
- Remove item functionality
- Checkout button

### 5. Checkout Page (checkout.html)
- Billing information form
- Shipping information form
- Order summary
- Payment method selection (mock)
- Place order button

## Design Requirements
- Clean, modern design inspired by leading SaaS companies
- Consistent color scheme (suggest: blue/white/gray)
- Responsive layout that works on desktop and mobile
- Professional typography
- Smooth hover effects and transitions

## Functional Requirements
- Shopping cart data persists across pages (use localStorage)
- Form validation on checkout
- Dynamic price calculations
- Product filtering on catalog page
- Responsive navigation menu

## ⚠️ EXECUTIVE MUST DEFINE DESIGN SYSTEM FIRST ⚠️

**BEFORE delegating to managers, the Executive MUST create a comprehensive DESIGN_SYSTEM.md file that includes:**

### 1. Global Navigation Structure
- Define exact navigation menu that ALL pages must use
- Specify which pages link to which: index.html ↔ products.html ↔ cart.html ↔ checkout.html
- Include cart icon with counter in navigation
- Define mobile-responsive navigation behavior

### 2. Shared CSS Variables & Styling
- Define CSS custom properties (--primary-color, --secondary-color, etc.)
- Specify typography scale (headings, body text, buttons)
- Define button styles (.btn-primary, .btn-secondary, .btn-cart)
- Set spacing system (margins, padding, gaps)
- Define card component styles for products
- Specify form input styling

### 3. Component Templates
- Navigation bar HTML structure that ALL pages must copy exactly
- Footer structure (if needed)
- Product card HTML template
- Button HTML templates
- Form element templates

### 4. Page Layout Standards
- Define page wrapper/container structure
- Set maximum widths and responsive breakpoints
- Specify header, main, footer layout pattern

**The Executive must create this DESIGN_SYSTEM.md file FIRST, then send it to ALL managers before they start work. Every manager must confirm they've read and understood the design system before beginning implementation.**

## CRITICAL TECHNOLOGY REQUIREMENTS:
• Use ONLY vanilla HTML, CSS, and JavaScript - NO frameworks, NO build tools, NO npm packages
• All code must work by simply opening an HTML file in a browser
• Use inline styles or <style> tags for CSS
• Use <script> tags for JavaScript - no modules, no imports
• Store cart data in localStorage for persistence
• Use relative links between HTML pages
• Keep all files in a single directory for simplicity
• ALL pages must use the EXACT navigation and styling defined in DESIGN_SYSTEM.md

## Sample Products
Create at least 6 AI agent products with creative names and descriptions, such as:
- "DataMiner Pro" - Automated data analysis agent
- "CustomerBot 3000" - 24/7 customer service agent
- "ContentGenius" - AI content creation assistant
- "CodeHelper AI" - Programming assistant agent
- "SalesBoost Agent" - Lead qualification and nurturing
- "ResearchBot Plus" - Market research automation

## 🎯 EXECUTIVE WORKFLOW (MANDATORY SEQUENCE)

**Step 1: Create Design System (Executive Only)**
1. Create DESIGN_SYSTEM.md with all navigation, styling, and component standards
2. Include exact HTML templates for navigation, buttons, product cards
3. Define CSS variables and naming conventions
4. Specify inter-page linking structure

**Step 2: Distribute Design System (Executive Only)**
1. Send DESIGN_SYSTEM.md to ALL managers before they start
2. **MANDATORY: Send explicit technology requirements message to EACH manager: "TECHNOLOGY REQUIREMENTS (MANDATORY): Use ONLY vanilla HTML, CSS, and JavaScript. NO frameworks (no React, Vue, Angular). NO build tools (no npm, webpack, vite). NO package.json. All code must work by opening HTML files directly in browser."**
3. Require each manager to confirm understanding with "CONFIRMED: Vanilla HTML/CSS/JS only"
4. Do NOT allow managers to start until they've confirmed understanding

**Step 3: Delegate Implementation (Executive Only)**
1. Assign managers to specific pages
2. Remind managers to follow DESIGN_SYSTEM.md exactly
3. Monitor progress and ensure consistency

**Step 4: Integration Testing (Executive Only)**
1. Test navigation between all pages
2. Verify consistent styling across all pages
3. Test cart functionality across page transitions
4. Ensure complete user journey works

## Deliverables
1. DESIGN_SYSTEM.md file (created first by Executive)
2. All HTML pages listed above
3. CSS styling (can be inline or in style tags) - MUST follow design system
4. JavaScript for interactivity (in script tags)
5. A simple README.md explaining how to use the site

## Success Criteria
- All pages have identical navigation menus with working links
- All pages use the same color scheme, fonts, and button styles
- Cart persists across all page transitions
- Complete user journey: index.html → products.html → product-detail.html → cart.html → checkout.html
- Site works by simply opening HTML files in browser (no server needed)

Remember: The goal is a functional, professional-looking e-commerce site that demonstrates the value of AI agents to potential customers. The site should be simple enough to work without any server or build process - just opening HTML files in a browser.