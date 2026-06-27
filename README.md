# Techie Brains Inc. Website

A client-ready React 19 + Vite website for Techie Brains Inc. covering recruitment, IT staffing, IT consulting, authentication, resume upload, application tracking, and admin management.

## What is included

- Premium responsive public website: Home, About, Services, Testimonials, FAQs, Contact, Login
- Attractive corporate UI with sticky navigation, search, dark/light mode, glass panels, motion, maps, and CTA flows
- Supabase-first authentication: login, register, forgot password, session persistence, and protected routes
- User dashboard: profile editing, resume upload validation, notifications, and application status timeline
- Admin dashboard: analytics, resume search/filter/status updates, approve/reject/delete, user management, contact messages, and announcements
- Supabase SQL schema with profiles, resume_uploads, notifications, contact_messages, RLS policies, and resume storage bucket policies

## Run locally

1. Install dependencies:

   npm install

2. Copy .env.example to .env and add your Supabase values.

3. Run supabase/schema.sql in your Supabase SQL editor.

4. In Supabase Authentication, enable email/password sign-in. Email verification can stay on for production.

5. Start the app:

   npm run dev

## Production notes

- Do not expose Supabase service-role keys in the browser.
- Admin user creation in a real deployment should be connected to a Supabase Edge Function that uses the service role securely on the server.
- To make a user an admin, update the user profile role in Supabase to Admin.
- Resume downloads work with real Supabase Storage URLs after the resumes bucket and policies are active.

## Demo mode

If Supabase env vars are missing, the app still allows local demo login so the client can review screens and button behavior. For final delivery, configure Supabase before deployment.

# -TechieBrains
