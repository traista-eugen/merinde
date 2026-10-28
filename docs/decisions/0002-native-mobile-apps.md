# 0002: Native mobile apps for iOS and Android

- **Status:** accepted
- **Date:** 2026-10-28

## Context

Merinde is used on the go: in the kitchen, and in the store while shopping. Most input comes from the camera (receipts, barcodes, expiry labels) and voice. It has to be usable by our family and by other households.

## Options considered

1. **Native app per platform:** Swift + SwiftUI on iOS, Kotlin + Jetpack Compose on Android.
2. **Cross-platform:** React Native / Expo, Flutter, or Kotlin Multiplatform.
3. **Web app / PWA.**

## Decision

Option 1. Mobile only, a native app for each platform. No web or desktop app.

## Consequences

- Best access to camera, scanning (Apple VisionKit, Google ML Kit) and speech APIs, and each app feels at home on its platform.
- Every screen is built twice. To limit that, business logic lives on the backend (AI calls, ingredient matching, price comparison), and the apps stay thin.
- iOS ships first, for the 4 Nov 2026 hackathon demo; Android follows after the hackathon on the same backend.
