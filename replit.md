# ECG Monitor - Medical IoT Device Management System

## Overview

This is a comprehensive medical ECG monitoring application built for real-time IoT Holter device integration and medical data management. The system provides 12-lead ECG monitoring with AI-powered diagnosis capabilities using Claude 3.5 Sonnet, Bluetooth Low Energy device management, and real-time waveform visualization.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming and dark mode support
- **State Management**: 
  - TanStack Query for server state management and caching
  - React hooks for local component state
  - Custom hooks for WebSocket and Bluetooth functionality

### Backend Architecture
- **Runtime**: Node.js 20 with Express.js framework
- **WebSocket**: Real-time bidirectional communication for ECG data streaming
- **Data Layer**: Drizzle ORM with PostgreSQL for structured data storage
- **In-Memory Storage**: Fallback storage implementation for development
- **API Integration**: Anthropic Claude API for AI-powered ECG analysis

### IoT Integration
- **BLE Protocol**: Web Bluetooth API for device discovery and connection
- **ADS1298 Support**: Native support for ADS1298 analog front-end with 24-bit ADC
- **Real-time Data**: WebSocket streaming of ECG data with configurable buffer sizes
- **Signal Processing**: Built-in signal quality assessment and heart rate calculation

## Key Components

### ECG Data Processing
- **12-Lead Support**: Full implementation of standard ECG leads (I, II, III, aVR, aVL, aVF, V1-V6)
- **ADS1298 Parser**: Custom parser for 24-bit signed ECG data with proper voltage conversion
- **Signal Quality**: Automatic assessment of signal quality with noise detection
- **Heart Rate Calculation**: Real-time BPM calculation from ECG waveforms

### Bluetooth Device Management  
- **Device Discovery**: Scan and connect to BLE medical devices
- **Connection Management**: Automatic reconnection and connection status monitoring
- **Device State**: Persistent device configuration and pairing storage
- **Multiple Channels**: Support for up to 8 ECG channels from ADS1298

### AI-Powered Analysis
- **Claude Integration**: Uses Anthropic's Claude 3.5 Sonnet for ECG interpretation
- **Rhythm Analysis**: Automatic detection of heart rhythm abnormalities
- **Clinical Recommendations**: Evidence-based suggestions for detected conditions
- **Interactive Chat**: Natural language interface for ECG-related queries

### Patient Management
- **Patient Profiles**: Complete patient information with medical history
- **Recording Sessions**: Track and manage ECG recording sessions with metadata
- **Session Analytics**: Detailed analysis and reporting of recording sessions
- **Data Export**: PDF report generation and data export capabilities

## Data Flow

1. **Device Connection**: BLE devices discovered and connected via Web Bluetooth API
2. **Data Acquisition**: ADS1298 streams 24-bit ECG data through BLE characteristics
3. **Real-time Processing**: Data parsed, converted to voltage, and buffered client-side
4. **WebSocket Streaming**: Processed ECG data streamed to server via WebSocket
5. **AI Analysis**: ECG data analyzed by Claude AI for abnormality detection
6. **Storage**: Session data and patient information stored in PostgreSQL
7. **Visualization**: Real-time waveform display with configurable lead selection

## External Dependencies

### Core Dependencies
- **@anthropic-ai/sdk**: AI-powered ECG analysis and clinical recommendations
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **@tanstack/react-query**: Server state management and data fetching
- **drizzle-orm**: Type-safe database ORM with schema validation

### UI/UX Dependencies
- **@radix-ui/react-***: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework with theming
- **class-variance-authority**: Component variant management
- **lucide-react**: Modern icon library

### Development Tools
- **TypeScript**: Type safety across frontend and backend
- **Vite**: Fast development server and build tool
- **esbuild**: Fast JavaScript bundler for production

## Deployment Strategy

### Development Environment
- **Replit Integration**: Configured for Replit development environment
- **Hot Reload**: Vite development server with fast refresh
- **PostgreSQL**: Local PostgreSQL 16 instance for development
- **WebSocket**: Development WebSocket server on port 5000

### Production Deployment
- **Autoscale Target**: Configured for autoscaling deployment
- **Build Process**: Vite frontend build + esbuild backend bundling
- **Static Assets**: Frontend served as static files from Express
- **Environment Variables**: DATABASE_URL and ANTHROPIC_API_KEY required

### Database Configuration
- **Schema Management**: Drizzle migrations with push-based schema updates
- **Connection**: PostgreSQL via connection string with proper SSL configuration
- **Fallback Storage**: In-memory storage implementation for development without database

## Changelog

Changelog:
- June 15, 2025. Initial setup
- June 15, 2025. Fixed ECG data buffer accumulation issue - buffer now properly grows from 28 to 2500 samples instead of resetting

## User Preferences

Preferred communication style: Simple, everyday language.