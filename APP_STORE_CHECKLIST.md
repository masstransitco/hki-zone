# HKI App Store Submission Checklist

## 🔧 Pre-Submission Setup

### 1. Apple Developer Portal Setup
- [ ] Create App ID: `com.aircity.hki`
- [ ] Enable capabilities:
  - [ ] Push Notifications
  - [ ] Associated Domains
  - [ ] Background App Refresh
- [ ] Create APNs Key (.p8 file)
  - [ ] Download and save Key ID and Team ID
  - [ ] Update `scripts/send-push-notification.js` with your values
- [ ] Create Provisioning Profile for distribution

### 2. Xcode Project Configuration

#### Signing & Capabilities
- [ ] Set Team and Bundle Identifier: `com.aircity.hki`
- [ ] Enable capabilities:
  - [ ] Push Notifications
  - [ ] Background Modes → Remote notifications
  - [ ] Associated Domains → `applinks:hki.zone`

#### Info.plist Configuration
- [ ] **For Development**: Use `ios-config/info-plist-dev.xml`
- [ ] **For Production**: Use `ios-config/info-plist-prod.xml`
- [ ] Remove ALL ATS overrides before submission
- [ ] Verify Universal Links configuration

#### App Icons & Launch Screen
- [ ] Add app icons to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
  - Required sizes: 1024x1024, 180x180, 167x167, 152x152, 120x120, 87x87, 80x80, 76x76, 60x60, 58x58, 40x40, 29x29, 20x20
- [ ] Configure LaunchScreen.storyboard or add launch images
- [ ] Test launch screen on different device sizes

### 3. Capacitor Configuration

#### Switch to Production Config
```bash
npm run cap:prod
```

#### Verify Production Settings
- [ ] `capacitor.config.ts` points to `https://hki.zone`
- [ ] `cleartext: false` in server config
- [ ] Test app loads correctly with HTTPS

### 4. Universal Links Setup

#### Domain Configuration
- [ ] Upload `public/apple-app-site-association` to your domain
- [ ] Verify file is accessible at:
  - `https://hki.zone/apple-app-site-association`
  - `https://hki.zone/.well-known/apple-app-site-association`
- [ ] Replace `<TEAM_ID>` with your actual Team ID
- [ ] Test Universal Links on device

## 🧪 Testing & Quality Assurance

### 4. Device Testing
- [ ] Test on multiple iOS versions (minimum supported version)
- [ ] Test on different device sizes (iPhone, iPad if supported)
- [ ] Test app launch and navigation
- [ ] Test push notifications:
  - [ ] Permission request
  - [ ] Token registration
  - [ ] Foreground notifications
  - [ ] Background notifications
  - [ ] Notification taps
- [ ] Test native features:
  - [ ] Haptic feedback
  - [ ] Native sharing
  - [ ] Camera/photo access (if used)
- [ ] Test Universal Links from Safari

### 5. Performance & Stability
- [ ] Check for memory leaks
- [ ] Test app in low memory conditions
- [ ] Verify app handles network interruptions
- [ ] Test app backgrounding/foregrounding
- [ ] Ensure smooth animations and interactions

## 📋 App Store Connect Preparation

### 6. App Store Connect Setup
- [ ] Create app record in App Store Connect
- [ ] Set up App Information:
  - [ ] App name: "HKI"
  - [ ] Bundle ID: `com.aircity.hki`
  - [ ] SKU: unique identifier
- [ ] Prepare app description and keywords
- [ ] Create screenshots for all required device sizes
- [ ] Set age rating and content warnings

### 7. Privacy & Compliance
- [ ] Create Privacy Policy (required for App Store)
- [ ] Configure App Privacy details in App Store Connect:
  - [ ] Data collection practices
  - [ ] Push notification usage
  - [ ] Location usage (if applicable)
  - [ ] Camera/photo usage (if applicable)
- [ ] Add privacy manifest if required
- [ ] Verify GDPR/CCPA compliance

### 8. Metadata & Assets
- [ ] App Store screenshots (required sizes for each device)
- [ ] App preview videos (optional but recommended)
- [ ] App description and promotional text
- [ ] Keywords for App Store optimization
- [ ] Support URL and privacy policy URL
- [ ] Contact information

## 🚀 Build & Submission

### 9. Final Build Preparation
```bash
# Switch to production configuration
npm run cap:prod

# Build the project
npm run build

# Sync with iOS
npx cap sync ios

# Open in Xcode
npx cap open ios
```

### 10. Xcode Archive & Upload
- [ ] Set build configuration to "Release"
- [ ] Archive the app (Product → Archive)
- [ ] Validate archive before upload
- [ ] Upload to App Store Connect
- [ ] Wait for processing (15-60 minutes)

### 11. TestFlight (Recommended)
- [ ] Set up internal testing group
- [ ] Add test notes and instructions
- [ ] Test with internal team
- [ ] Create external testing group (optional)
- [ ] Gather feedback and fix issues

### 12. App Store Submission
- [ ] Select build in App Store Connect
- [ ] Complete all required metadata
- [ ] Submit for review
- [ ] Monitor review status
- [ ] Respond to any reviewer feedback

## 🔍 Post-Submission Monitoring

### 13. After Approval
- [ ] Test downloaded app from App Store
- [ ] Monitor crash reports and analytics
- [ ] Set up app store optimization (ASO)
- [ ] Plan for updates and maintenance

## 📝 Quick Reference Commands

```bash
# Development mode
npm run cap:dev
npm run dev

# Production mode
npm run cap:prod
npm run build
npx cap sync ios
npx cap open ios

# Test push notifications
node scripts/send-push-notification.js [DEVICE_TOKEN] [KEY_ID] [TEAM_ID]
```

## ⚠️ Common Issues & Solutions

### Build Issues
- **Archive fails**: Check code signing and provisioning profiles
- **App crashes on launch**: Verify Info.plist configuration and remove ATS overrides
- **Push notifications not working**: Check APNs key configuration and device token

### App Store Rejection Reasons
- **Missing privacy policy**: Add privacy policy URL in App Store Connect
- **Invalid app icons**: Ensure all required icon sizes are provided
- **ATS violations**: Remove all ATS overrides from Info.plist
- **Missing app functionality**: Ensure app provides meaningful functionality beyond web view

### Universal Links Issues
- **Links don't open app**: Verify apple-app-site-association file is accessible
- **Domain not associated**: Check Associated Domains capability in Xcode
- **Wrong Team ID**: Ensure Team ID in AASA file matches your developer account

## 📞 Support Resources

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [TestFlight Guide](https://developer.apple.com/testflight/)

---

**Next Step**: Run `npm run cap:prod` and start with Xcode configuration!