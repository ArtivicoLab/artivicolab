# ArtivicoLab - Website Showcase Platform

## Overview

ArtivicoLab is a static website showcase platform built by Gradi Kayamba that displays a curated collection of website templates and designs. The platform serves as a portfolio and gallery for showcasing various website templates, particularly focusing on restaurant and salon websites with Caribbean/Jamaican themes.

## System Architecture

### Frontend Architecture
- **Static Website**: Pure HTML, CSS, and JavaScript frontend
- **Responsive Design**: Mobile-first approach with CSS Grid and Flexbox
- **Component-Based Structure**: Modular CSS and JavaScript files for different features
- **Visual Effects**: Custom rain animation and luxury visual effects for enhanced user experience

### Backend Architecture
- **Flask Web Server**: Simple Python Flask application serving static files
- **Static File Serving**: Direct file serving with no database or dynamic content generation
- **Deployment**: Configured for Gunicorn WSGI server with autoscale deployment

### Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Python 3.11, Flask 3.1.0
- **Fonts**: Google Fonts (Inter, Pacifico)
- **Icons**: SVG-based logo and favicon
- **Deployment**: Replit with Nix package management

## Key Components

### Website Gallery System
- **Data Management**: Centralized website data in `assets/js/data.js`
- **Dynamic Gallery**: JavaScript-powered gallery rendering
- **Showcase Details**: Individual website detail pages with embedded iframes
- **Navigation**: URL parameter-based routing for showcase details

### Visual Enhancement System
- **Rain Animation**: Custom CSS animations with multiple drop types (normal, shimmer, purple)
- **Mouse Tracking**: Interactive glow effects following user cursor
- **Luxury Effects**: Gold and purple shimmer effects for premium feel

### Content Protection System
- **Right-click Protection**: Disabled context menus
- **Copy Protection**: Prevention of text selection and drag-and-drop
- **Developer Tools Blocking**: Attempts to disable F12 and inspection tools
- **Iframe Protection**: Overlay system to prevent direct interaction with embedded sites

### Form Integration
- **Contact Form**: Integrated with FormSubmit.co for contact form handling
- **Email Configuration**: Direct email forwarding to contact@artivicolab.com
- **Validation**: Client-side form validation

## Data Flow

1. **Page Load**: Static HTML files served by Flask application
2. **Gallery Population**: JavaScript loads website data from data.js and renders gallery items
3. **Navigation**: User clicks trigger URL-based navigation with query parameters
4. **Showcase Display**: JavaScript reads URL parameters and displays corresponding website details
5. **Iframe Loading**: External websites loaded in protected iframe containers
6. **Form Submission**: Contact forms submitted directly to FormSubmit.co service

## External Dependencies

### Third-Party Services
- **FormSubmit.co**: Contact form processing and email forwarding
- **Google Fonts**: Typography (Inter, Pacifico font families)
- **Google Analytics**: Website traffic tracking and analytics (G-WMW68GE9TM)
- **External Websites**: Showcase websites hosted on GitHub Pages

### CDN Resources
- **Google Fonts API**: Font loading with preconnect optimization
- **External Images**: Website thumbnails and preview images

### Development Dependencies
- **Flask**: Web framework for static file serving
- **Gunicorn**: WSGI HTTP Server for production deployment
- **Python 3.11**: Runtime environment

## Deployment Strategy

### Replit Configuration
- **Nix Packages**: OpenSSL and PostgreSQL (prepared for future database integration)
- **Python Modules**: Python 3.11 with Flask dependencies
- **Port Configuration**: Internal port 5000 mapped to external port 80
- **Autoscale Deployment**: Configured for automatic scaling based on traffic

### Production Setup
- **WSGI Server**: Gunicorn with bind configuration for 0.0.0.0:5000
- **Reload Support**: Development reload enabled for code changes
- **Domain**: Custom domain configured via CNAME (artivicolab.com)
- **Static Assets**: All assets served directly by Flask static file handler

### SEO Configuration
- **Sitemap**: XML sitemap for search engine indexing
- **Meta Tags**: Comprehensive OpenGraph and meta tag implementation
- **Structured Data**: Author and organization metadata included

## Changelog

```
Changelog:
- June 17, 2025. Initial setup
- June 20, 2025. Added Neon Fluencer navigation button with neon glow effects
- July 19, 2025. Integrated Google Analytics tracking (G-WMW68GE9TM) across all pages
- July 19, 2025. Added Luxe Hair Studio showcase with pink/purple gradient theme and custom SVG thumbnail
- July 20, 2025. Added Luxe Styles by Jasmine as direct navigation link with pink/purple gradient styling and shimmer animation
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```

## Architecture Decisions

### Static vs Dynamic Content
**Problem**: Need to showcase multiple websites efficiently
**Solution**: Static website with JavaScript-powered dynamic content loading
**Rationale**: Faster loading, easier deployment, and sufficient for current content volume

### Flask for Static Serving
**Problem**: Need simple web server for static file hosting
**Solution**: Minimal Flask application with static file serving
**Rationale**: Simple setup, Python ecosystem compatibility, easy to extend for future features

### External Form Processing
**Problem**: Need contact form functionality without backend complexity
**Solution**: FormSubmit.co integration for form processing
**Rationale**: No server-side form handling required, reliable email delivery, spam protection included

### Iframe-based Website Display
**Problem**: Display external websites within platform safely
**Solution**: Protected iframe implementation with overlay protection
**Rationale**: Maintains user experience while providing content protection and preventing unauthorized interaction

### Client-side Data Management
**Problem**: Manage website showcase data efficiently
**Solution**: JavaScript object-based data storage in separate file
**Rationale**: Easy to maintain, no database overhead, sufficient for current scale, easily extendable