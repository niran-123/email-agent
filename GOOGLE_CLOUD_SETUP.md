# MailMind AI — Google Cloud Platform & Gmail API Setup Guide

This guide details the step-by-step setup required in the Google Cloud Console to enable Google OAuth 2.0 authentication and the Gmail API for MailMind AI.

---

## Step 1: Create a Google Cloud Project

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google account.
3. In the top navigation bar, click the project selector dropdown (next to "Google Cloud").
4. Click **New Project** in the upper-right corner of the modal dialog.
5. Enter project details:
   - **Project Name**: `MailMind AI` (or any custom name)
   - **Organization**: Leave as default or select your organization.
6. Click **Create** and wait for Google Cloud to provision the project.
7. Ensure your new project is actively selected in the top bar dropdown.

---

## Step 2: Enable the Gmail API

1. In the Google Cloud Console search bar, search for **Gmail API**.
2. Select **Gmail API** from the Marketplace / API Library results.
3. Click the blue **Enable** button.
4. Wait for the API status to transition to enabled.

---

## Step 3: Enable the Google Cloud Pub/Sub API

*(Required for real-time Gmail push notifications in subsequent phases)*

1. In the search bar, search for **Cloud Pub/Sub API**.
2. Select **Cloud Pub/Sub API** from the results.
3. Click **Enable**.

---

## Step 4: Configure the OAuth Consent Screen

1. In the left navigation menu, navigate to **APIs & Services** > **OAuth consent screen**.
2. Choose User Type:
   - **External**: Select this (allows any Google account or designated test users to authenticate).
   - Click **Create**.
3. **App information**:
   - **App name**: `MailMind AI`
   - **User support email**: Select your developer email address.
   - **App logo**: (Optional during development).
4. **App domain**:
   - **Application home page**: `http://localhost:5173` (or your production frontend URL).
   - **Privacy Policy**: (Optional for development).
   - **Developer contact email**: Enter your contact email.
   - Click **Save and Continue**.
5. **Scopes**:
   - Click **Add or Remove Scopes**.
   - Under manually enter scopes or from the list, select:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
     - `https://www.googleapis.com/auth/gmail.readonly` *(Read-only access to messages, labels, and threads)*
   - *Security Note*: Do **NOT** request write or full-access scopes (`https://mail.google.com/`) at this stage. Principle of least privilege must be maintained.
   - Click **Update**, then **Save and Continue**.

---

## Step 5: Create an OAuth 2.0 Web Application Client

1. In the left navigation menu, click **Credentials**.
2. Click **+ Create Credentials** at the top of the page, then choose **OAuth client ID**.
3. Under **Application type**, select **Web application**.
4. Set **Name**: `MailMind AI Web Client`.

---

## Step 6 & 7: Configure Authorized JavaScript Origins and Redirect URIs

Scroll down to the configuration sections within the same client creation page:

### Authorized JavaScript origins:
Add the origins where your frontend runs:
- `http://localhost:5173`
- `http://localhost:5000`
- *(Add your production frontend domain when deploying)*

### Authorized redirect URIs:
Add the exact backend callback URL that Google will redirect back to after user approval:
- `http://localhost:5000/api/auth/google/callback`
- *(Add your production callback domain when deploying, e.g., `https://api.yourdomain.com/api/auth/google/callback`)*

Click **Create**.

A dialog will appear showing:
- **Your Client ID**: e.g., `123456789-abcdef.apps.googleusercontent.com`
- **Your Client Secret**: e.g., `GOCSPX-xxxxxxxxxxxxxxxx`

Copy both into `backend/.env`:
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

---

## Step 8: Add Test Users During Development

While your OAuth consent screen is in **Testing** status:
1. Go back to **APIs & Services** > **OAuth consent screen**.
2. Scroll to the **Test users** section.
3. Click **+ Add Users**.
4. Enter the Google/Gmail email address you plan to use for logging in and testing.
5. Click **Save**.

*Note*: Only users added to this list will be allowed to authorize the application while in testing status. Unregistered accounts will receive `Error 403: access_denied`.

---

## Step 9: Understanding OAuth Verification Requirements for Public Release

When preparing for production:
1. **Restricted Scopes**: `https://www.googleapis.com/auth/gmail.readonly` is classified by Google as a **Restricted Scope**.
2. **CASA Security Assessment**: Applications accessing Gmail data commercially or for unverified public users must undergo a **Cloud Application Security Assessment (CASA)** by an authorized third-party lab.
3. **Verification Process**:
   - Provide a publicly accessible Privacy Policy explaining data storage and retention.
   - Provide a YouTube video demo demonstrating the OAuth grant and consent flow.
   - Submit for Google App Verification from the **OAuth consent screen** tab.
4. **Internal Testing Alternative**: For internal workspace domains or developer testing with up to 100 test users, CASA verification is not required as long as the app stays in "Testing" mode.

---

## Step 10: Google Cloud Pub/Sub Setup for Real-time Gmail Push Notifications (Phase 3)

Gmail push notifications require a Google Cloud Pub/Sub topic and a push subscription directed to your webhook.

### 10.1 Create a Pub/Sub Topic
1. In Google Cloud Console, navigate to **Pub/Sub** > **Topics**.
2. Click **Create Topic**.
3. **Topic ID**: `mailmind-gmail-notifications`.
4. Leave other options as default and click **Create**.
5. Note the full topic name: `projects/<your-project-id>/topics/mailmind-gmail-notifications`.
6. Add this to your `backend/.env`:
   ```env
   GOOGLE_PUBSUB_TOPIC=projects/<your-project-id>/topics/mailmind-gmail-notifications
   ```

### 10.2 Grant Gmail Permission to Publish to the Topic
*Crucial Step*: Gmail must be granted the `Pub/Sub Publisher` role on your topic:
1. In the **Topics** list, click on `mailmind-gmail-notifications`.
2. Open the **Permissions** tab on the right panel (or click **Show Info Panel**).
3. Click **Add Principal**.
4. In **New principals**, enter the official Google Gmail push service account:
   ```
   gmail-api-push@system.gserviceaccount.com
   ```
5. In **Select a role**, choose **Pub/Sub** > **Pub/Sub Publisher**.
6. Click **Save**.

### 10.3 Create a Push Subscription
1. Inside your topic details, click **Subscriptions** > **Create Subscription** (or navigate to **Pub/Sub** > **Subscriptions** > **Create Subscription**).
2. **Subscription ID**: `mailmind-gmail-push-sub`.
3. Select **Delivery type**: **Push**.
4. **Endpoint URL**:
   - For local development: Use your ngrok / tunnel URL (e.g., `https://abc.ngrok-free.app/api/webhooks/gmail`).
   - For production: `https://api.yourdomain.com/api/webhooks/gmail`.
5. **Enable authentication** (Recommended):
   - Check **Enable authentication**.
   - Create or select a Service Account.
   - Set **Audience**: `https://api.yourdomain.com/api/webhooks/gmail` (or match your server domain).
6. **Acknowledgement deadline**: Set to **30 seconds** (gives the server time to enqueue the job safely).
7. **Message retention duration**: 7 days.
8. Click **Create**.

### 10.4 Testing Push Notifications
You can verify the webhook without waiting for real emails:
1. Go to your topic `mailmind-gmail-notifications` in the Cloud Console.
2. Click the **Messages** tab, then **Publish Message**.
3. In **Message body**, enter:
   ```json
   {
     "emailAddress": "your-test-user@gmail.com",
     "historyId": "12345678"
   }
   ```
4. Click **Publish**.
5. Inspect your backend logs. You will see:
   ```
   [Webhook:PubSub] 📬 Change notification for your-test-user@gmail.com (historyId: 12345678)
   ```
   And your server will return `200 OK` with `{ status: "acknowledged" }`.

