<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Fitfo mobile app (Expo / React Native). The following changes were made in this session:

- **`apps/mobile/.env`** — Updated with correct `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` values.
- **`App.tsx`** — Added `account_deleted`, `profile_name_updated`, and `weight_entry_logged` capture calls at the relevant success handlers.
- **`src/components/CoachSheet.tsx`** — Imported `usePostHog`, added `coach_message_sent` capture when a user sends a message to the AI coach.
- **`src/screens/ProfileScreen.tsx`** — Imported `usePostHog`, added `feature_suggestion_opened` capture when the user opens the feature suggestion email flow.
- **`src/screens/WorkoutSummaryScreen.tsx`** — Imported `usePostHog`, added `workout_repeated` capture when the user taps "Start this workout again" from the summary screen.

Previously instrumented (existing events retained unchanged):

- Auth: `sign_up_initiated`, `sign_up_completed`, `login_initiated`, `login_completed`, `apple_sign_in_completed`
- Onboarding: `onboarding_completed`
- Paywall: `paywall_viewed`, `subscription_started`, `subscription_restored`
- Workout flow: `workout_import_initiated`, `workout_import_completed`, `workout_started`, `workout_saved`, `workout_scheduled`, `workout_completed`
- User identification: `posthog.identify()` on sign-up, login, Apple Sign In, and session restore; `posthog.reset()` on logout

## Events

| Event | Description | File |
|---|---|---|
| `account_deleted` | User successfully deleted their account | `App.tsx` |
| `profile_name_updated` | User successfully updated their display name | `App.tsx` |
| `weight_entry_logged` | User logged a body weight entry (includes `weight_lbs` property) | `App.tsx` |
| `coach_message_sent` | User sent a message to the AI coach during a workout (includes `message_index`, `has_workout_context`) | `src/components/CoachSheet.tsx` |
| `feature_suggestion_opened` | User opened the feature suggestion email flow from the profile screen | `src/screens/ProfileScreen.tsx` |
| `workout_repeated` | User tapped "Start this workout again" from the workout summary screen (includes `workout_id`) | `src/screens/WorkoutSummaryScreen.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/407085/dashboard/1537322
- **Signup to Subscription Funnel:** https://us.posthog.com/project/407085/insights/ntHdEFgP
- **Workout Completions Over Time:** https://us.posthog.com/project/407085/insights/bLuv0jvv
- **Workout Import Funnel:** https://us.posthog.com/project/407085/insights/RhxyOKnS
- **Feature Engagement Breakdown:** https://us.posthog.com/project/407085/insights/bWs6pplA
- **Account Deletions Over Time:** https://us.posthog.com/project/407085/insights/6OzWVOZa

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
