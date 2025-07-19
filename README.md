# HKI Zone - Hong Kong Information Hub

*A modern Next.js news aggregator for Hong Kong*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/masstransitcos-projects/v0-next-js-web-application)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/Qjocv17foH9)

## Overview

HKI Zone is a comprehensive Hong Kong news aggregator that collects articles from multiple local sources, processes them with AI summarization, and provides a modern, responsive interface for news consumption. The application features a sleek design with an innovative side menu navigation system.

### Key Features

- **Multi-source News Aggregation**: Real-time scraping from HKFP, SingTao, HK01, ONCC
- **AI-powered Summaries**: Automatic article summarization using Anthropic Claude
- **Modern UI Design**: Centered logo with slide-out side menu navigation
- **Responsive Design**: Mobile-first approach with touch-friendly interactions
- **Theme Support**: Dark/light mode with system preference detection
- **Multi-language Support**: English, Simplified Chinese, Traditional Chinese
- **Real-time Status**: Live news feed indicators and system status

## Deployment

Your project is live at:

**[https://vercel.com/masstransitcos-projects/v0-next-js-web-application](https://vercel.com/masstransitcos-projects/v0-next-js-web-application)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/Qjocv17foH9](https://v0.dev/chat/projects/Qjocv17foH9)**

## Architecture

The application is built with a modern tech stack:

- **Frontend**: Next.js 14 with React 18 and TypeScript
- **UI Framework**: Tailwind CSS with Radix UI components
- **Database**: Supabase (PostgreSQL)
- **AI Integration**: Anthropic Claude for summarization
- **Deployment**: Vercel with automatic deployments

## Documentation

Comprehensive documentation is available in the `/doc` directory:

- **[UI Components](./doc/UI_COMPONENTS.md)**: Detailed documentation of the header and navigation system
- **[Architecture](./ARCHITECTURE.md)**: Complete system architecture overview
- **[Changelog](./doc/CHANGELOG.md)**: Recent updates and feature implementations

## Recent Updates

### Header & Navigation Redesign
- **Centered Logo**: Modern header layout with centered branding
- **Side Menu**: Threads-style slide-out menu with push animation
- **Responsive Design**: Mobile-optimized with touch-friendly interactions
- **Accessibility**: Full keyboard navigation and screen reader support

### Technical Improvements
- Custom push animation system (no overlay)
- Hardware-accelerated CSS transforms
- Centralized state management for menu interactions
- Enhanced mobile viewport handling

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```
