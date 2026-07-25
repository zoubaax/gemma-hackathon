# SHIFAA

SHIFAA is a comprehensive platform consisting of a backend API, a web frontend, and a mobile application.

## Project Structure

This repository is organized into three main directories:

- `/backend` - Node.js/Express API
- `/frontend` - React Web Application (Vite)
- `/mobile` - React Native Mobile Application (Expo)

---

## Prerequisites

Before running the project, make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) (for the backend database)

---

## How to Run the Project

You will need to open **three separate terminal windows/tabs** to run the backend, frontend, and mobile app simultaneously.

### 1. Backend (Node.js/Express)

The backend serves the API and manages the database.

**Setup:**
```bash
cd backend
npm install
```

**Database Configuration:**
Ensure your PostgreSQL server is running. Configure your environment variables in `backend/.env` with your database connection details.

**Initialize & Migrate Database:**
```bash
npm run db:init
npm run db:migrate
```

**Start the Development Server:**
```bash
npm run dev
```
*(The server will typically start on port 3000 or whatever is defined in your `.env`)*

---

### 2. Frontend (Web Application)

The web frontend is built with React and Vite.

**Setup:**
```bash
cd frontend
npm install
```

**Start the Development Server:**
```bash
npm run dev
```
*(Open the URL provided in the terminal, usually `http://localhost:5173`)*

---

### 3. Mobile (React Native / Expo)

The mobile app is built using React Native and Expo.

**Setup:**
```bash
cd mobile
npm install
```

**Start the Expo Development Server:**
```bash
npm start
```

**Running on a device or emulator:**
- **iOS:** Press `i` in the terminal to launch on the iOS simulator (requires Xcode on macOS).
- **Android:** Press `a` in the terminal to launch on the Android emulator (requires Android Studio).
- **Physical Device:** Download the "Expo Go" app on your iOS or Android device and scan the QR code displayed in your terminal.
