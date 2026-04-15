# LiftSync Mobile

React Native mobile client for LiftSync, built with Expo.

## Getting started

1. Install dependencies:

```bash
pnpm install
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Set `EXPO_PUBLIC_API_URL` to your API base URL.

If you are testing on a physical device, do not use `localhost`. Point the app at your machine's LAN IP instead, for example `http://192.168.1.25:8000`.

4. Start the app:

```bash
pnpm start
```

You can also run:

```bash
pnpm android
pnpm ios
pnpm web
```

## What was ported

- TikTok URL submission flow
- Job polling and status progress
- Workout plan rendering with blocks, exercises, and notes
- Mobile-safe API configuration through `EXPO_PUBLIC_API_URL`
