# School Result System

A modern, high-performance School Result System built with **Next.js 15+ (App Router)**, **TypeScript**, **Tailwind CSS**, and integrated with **Supabase** for database/authentication and the **Google Sheets API** for data synchronization.

## 🚀 Features

- **Dashboard**: Real-time analytics, overview cards, and visualizations of student performance using Recharts.
- **Student Profile Management**: Complete search, filter, and detail view sheets for student information.
- **Marks Management**: Input and edit student marks/results dynamically.
- **Subjects & Classes**: Management interfaces for school curriculum structures (Classes, Subjects, Exams).
- **Google Sheets Synchronization**: Seamless integration to import/export student records and marks.
- **Elegant Dark/Light Mode**: Smooth theme transitions with `next-themes` and a fully responsive premium interface.

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router, Turbopack enabled)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, CSS Variables
- **UI Components**: Radix UI, Lucide Icons, Sonner (for beautiful toast notifications), Recharts (for charts)
- **Backend & Auth**: Supabase SSR
- **Data Integration**: Google Sheets API, PapaParse (CSV parser), XLSX (Excel reader/writer)

## 📋 Prerequisites

Before running the project, you need:
- Node.js installed (v18+ recommended)
- A Supabase project (for authentication and database)
- A Google Cloud Console project with Google Sheets API enabled and an API key generated

## ⚙️ Local Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <your-github-repo-url>
   cd school-result-system
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and fill in your Supabase credentials and Google Sheets API keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   GOOGLE_SHEETS_API_KEY=your-google-sheets-api-key
   AUTH_DISABLED=false
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

5. **Build for production:**
   ```bash
   npm run build
   ```

## 🔒 Security Note (GitHub Uploads)

To keep your credentials secure, **never upload local configuration files containing keys to GitHub**. 
The project includes a configured `.gitignore` that automatically excludes the following files from tracking:
- `.env.local` (Contains your private API keys)
- `.next/` & `node_modules/` (Auto-generated directories)
- `.cursor/` (Local IDE configurations)
- `build-log.txt`, `recent.txt`, `tsc-check.txt`, `tsc-errors.txt` (Local log files)
