# Rx Portal - Doctor Prescription Management System

A modern, responsive, and efficient prescription management application designed for doctors. Built with React, TypeScript, Vite, Supabase, and Tailwind CSS.

## Features

-   **Dashboard**: Overview of patient statistics and quick actions.
-   **Write Prescription**: Comprehensive interface for creating prescriptions with:
    -   Patient History Autofill
    -   Medicine Autosuggest (Local & Database)
    -   Dynamic fields for Medicines, Tests, Advice, etc.
-   **Print Studio**:
    -   **Mobile-Friendly Preview**: Auto-scaling A4 layout for mobile devices.
    -   **Drag-and-Drop Layout Editor**: Customize the position of every element to match your pre-printed slots.
    -   **PWA Support**: Installable as a native-like app on mobile and desktop.
-   **Video Consultations (Telemedicine)**:
    -   **Strict 30-Minute Slots**: Automated timer that expires call links after the appointment time passes.
    -   **Premium Mobile UI**: Draggable Picture-in-Picture (PIP) self-view and tap-to-hide controls for an immersive experience.
    -   **Secure Access**: Direct URL access is blocked outside valid appointment windows.
-   **Doctor Profile**:
    -   **Public Profile**: Doctors can upload avatars and set bio/specialization details.
    -   **Patient Visibility**: Patients can browse doctor profiles and see who they are booking with.
-   **Enhanced Prescription Writing**:
    -   **Pediatric Friendly**: Flexible inputs for Age (Y/M/D), Weight, and granular complaint durations.
    -   **Localization**: Built-in Bangla scripts for follow-up instructions and layout text.
    -   **Smart History**: "Re-prescribe" button to clone past prescriptions instantly.
-   **Patient History**: Searchable archive of all past visits and prescriptions.
-   **Settings**: Manage prescription templates (letterheads) and account settings.

## Tech Stack

-   **Frontend**: React (v19), TypeScript, Vite
-   **Styling**: Tailwind CSS (v4), Lucide React (Icons)
-   **Backend**: Supabase (Auth, Database, RPC)
-   **State/Forms**: React Hook Form
-   **Deployment**: Vercel (PWA Configured)

## Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/workmail1803-ai/Doctors_RX.git
    cd Doctors_RX
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env.local` file in the root directory with your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

5.  **Build for Production**:
    ```bash
    npm run build
    ```

## Project Structure

-   `src/components`: Reusable UI components (SmartInput, Sidebar, etc.)
-   `src/pages`: Main application pages (WritePrescription, PrintPrescription, etc.)
-   `src/data`: Local datasets (meds.ts)
-   `src/lib`: Supabase client configuration
-   `src/types`: TypeScript definitions

## License

Private / Proprietary.
