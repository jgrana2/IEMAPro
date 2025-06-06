# ECG Monitor - Medical IoT Device Management System

A comprehensive medical ECG monitoring system designed for real-time IoT Holter device integration and medical data management. Built with modern web technologies for healthcare professionals requiring precise cardiac monitoring capabilities.

## 🩺 Features

### Real-time ECG Monitoring
- **12-Lead ECG Support**: Full support for standard 12-lead ECG monitoring (Lead I, II, III, aVR, aVL, aVF, V1-V6)
- **ADS1298 Integration**: Native support for ADS1298 analog front-end (AFE) with 24-bit ADC resolution
- **Live Waveform Display**: Real-time ECG waveform visualization with customizable display settings
- **Signal Quality Assessment**: Automatic signal quality monitoring with noise detection

### Bluetooth Device Management
- **BLE Device Discovery**: Scan and connect to Bluetooth Low Energy medical devices
- **Connection Status Monitoring**: Real-time connection status tracking and automatic reconnection
- **Device State Management**: Persistent device pairing and configuration storage

### AI-Powered Diagnosis
- **Intelligent ECG Analysis**: AI-powered ECG interpretation using Claude 3.5 Sonnet
- **Heart Rhythm Detection**: Automatic rhythm classification and abnormality detection
- **Clinical Recommendations**: Evidence-based recommendations for detected abnormalities
- **Interactive Chat Interface**: Natural language queries about ECG findings

### Patient Management
- **Patient Profiles**: Comprehensive patient information management
- **Recording Sessions**: Track and manage ECG recording sessions
- **Medical History**: Store and access patient medical history
- **Session Analytics**: Detailed analysis of recording sessions with exportable reports

### Data Export & Reporting
- **PDF Report Generation**: Professional ECG reports with patient information and analysis
- **Data Export**: Export ECG data in standard formats for external analysis
- **Session Documentation**: Comprehensive session logs and system monitoring

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript for type safety
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with dark mode support
- **State Management**: TanStack Query for server state, React hooks for local state

### Backend (Node.js + Express)
- **Runtime**: Node.js 20 with Express.js framework
- **WebSocket**: Real-time communication for ECG data streaming
- **Data Storage**: In-memory storage with Drizzle ORM
- **API Integration**: Anthropic Claude API for AI analysis

### IoT Integration
- **Bluetooth**: Web Bluetooth API for device connectivity
- **Signal Processing**: Custom ADS1298 parser for 24-bit ECG data
- **Real-time Streaming**: WebSocket-based data transmission

## 🚀 Quick Start

### Prerequisites
- Node.js 20 or higher
- Modern web browser with Bluetooth API support
- ADS1298-compatible ECG device (optional for testing)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ecg-monitor.git
   cd ecg-monitor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Create .env file
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open your browser to `http://localhost:5000`

### Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## 📱 Usage

### Device Connection
1. Navigate to the left sidebar and click "Scan Devices"
2. Select your ADS1298-compatible ECG device from the list
3. Click "Connect" to establish Bluetooth connection
4. Monitor connection status in the header

### Patient Management
1. Click "New Patient" to create a patient profile
2. Fill in patient information (name, ID, demographics)
3. Select the patient from the sidebar to begin monitoring

### ECG Recording
1. Ensure device is connected and patient is selected
2. Click "Start Recording" to begin ECG data collection
3. Monitor real-time waveforms across all 12 leads
4. Use "Stop Recording" to end the session

### AI Analysis
1. Open the AI Diagnosis panel (robot icon)
2. Ask questions about the current ECG in natural language
3. Review AI-generated analysis including:
   - Heart rate calculations
   - Rhythm classification
   - Detected abnormalities
   - Clinical recommendations

### Data Export
1. Complete an ECG recording session
2. Navigate to the session in the right sidebar
3. Click "Export PDF" to generate a clinical report
4. Download contains patient info, ECG strips, and analysis

## 🔧 Configuration

### Bluetooth Settings
- Ensure your device supports Web Bluetooth API
- Enable Bluetooth permissions in browser settings
- For Chrome: `chrome://flags/#enable-web-bluetooth`

### AI Configuration
- Obtain Anthropic API key from console.anthropic.com
- Add key to environment variables
- Configure analysis parameters in `server/ai-diagnosis.ts`

### ECG Parameters
- Sample rate: Configurable (default 500Hz)
- Lead configuration: Standard 12-lead setup
- Buffer size: 2500 samples (~5 seconds at 500Hz)
- Signal quality thresholds: Adjustable in parser

## 🛠️ Development

### Project Structure
```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility libraries
│   │   └── pages/          # Application pages
├── server/                 # Backend Express application
│   ├── ai-diagnosis.ts     # AI analysis integration
│   ├── routes.ts           # API route definitions
│   └── storage.ts          # Data storage layer
├── shared/                 # Shared types and schemas
└── package.json           # Dependencies and scripts
```

### Key Components
- **ECGCanvas**: Real-time waveform rendering
- **ADS1298Parser**: 24-bit ECG data processing
- **BluetoothHook**: Device connection management
- **AIDiagnosisPanel**: AI-powered analysis interface

### API Endpoints
- `GET /api/patients` - Patient management
- `GET /api/recording-sessions` - Session data
- `GET /api/ble-devices` - Device management
- `WebSocket /ws` - Real-time ECG streaming

## 🔒 Security & Compliance

### Data Privacy
- All patient data stored locally (no external transmission)
- Secure WebSocket connections for real-time data
- No persistent storage of sensitive medical information

### Medical Device Integration
- Follows FDA guidelines for software as medical device (SaMD)
- Compatible with Class II medical devices
- Supports IEC 60601-2-51 standards for ECG equipment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write unit tests for new features
- Update documentation for API changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Troubleshooting
- **Bluetooth Connection Issues**: Check browser compatibility and permissions
- **ECG Data Not Displaying**: Verify device compatibility and data format
- **AI Analysis Errors**: Confirm API key configuration and network connectivity

### Getting Help
- Open an issue on GitHub for bug reports
- Check the wiki for detailed documentation
- Contact support for enterprise licensing

## 🙏 Acknowledgments

- [ADS1298](https://www.ti.com/product/ADS1298) - Texas Instruments ECG Analog Front-End
- [Anthropic Claude](https://www.anthropic.com/) - AI-powered medical analysis
- [Shadcn/ui](https://ui.shadcn.com/) - Modern React component library
- Healthcare professionals who provided clinical insights

---

**⚠️ Medical Disclaimer**: This software is for educational and research purposes. Not intended for clinical diagnosis or patient care without proper validation and regulatory approval.