# GrhaPOCH

A comprehensive, full-stack multi-role food ordering, restaurant management, and delivery logistics platform built with React 19, Vite, Node.js, Express, MongoDB, Socket.io, Redis, and Firebase.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Project Architecture & Structure](#-project-architecture--structure)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [Available NPM Scripts](#-available-npm-scripts)
  - [Backend Scripts](#backend-scripts)
  - [Frontend Scripts](#frontend-scripts)
- [Ports & Endpoint References](#-ports--endpoint-references)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🌟 Overview

**GrhaPOCH** is a modern food delivery ecosystem designed to handle end-to-end interactions across four core user roles:

1. **User (Customer)**: Browse restaurants, search foods, manage cart, place orders, real-time tracking, rate delivery & restaurant.
2. **Restaurant Partner**: Manage food inventory, menu categories, accept/reject live orders, update preparation status, view earnings and payouts.
3. **Delivery Partner (Deliveryman)**: Real-time trip assignments, live GPS order tracking, pocket statement, COD collection management, trip history, and bonus incentives.
4. **Admin Panel**: Complete system administration including restaurant onboarding, menu category approvals, delivery boy commissions, system-wide analytics, ad banners, and reports.

---

## ✨ Key Features

### 🛒 Customer Web Portal
- **Interactive Home & Dining**: Explore popular restaurants, curated categories, food under ₹250, top offers, and dining reservations.
- **Search & Filtering**: Search by dishes, restaurants, cuisine, diet type (Veg / Non-Veg / Both), price, and ratings.
- **Cart & Checkout**: Multi-restaurant support, delivery instructions, coupon redemption, Razorpay payment gateway integration, COD options.
- **Live Order Tracking**: Real-time status cards (Placed, Preparing, Out for Delivery, Delivered) with instant socket updates & Firebase notifications.
- **Ratings & Feedback**: Modal-based dual rating system (Restaurant & Delivery Partner rating with comments).

### 🏪 Restaurant Partner Portal
- **Live Order Management**: Real-time order notification sounds, one-click order acceptance, status pipeline (Confirmed -> Preparing -> Ready -> Dispatched).
- **Menu & Category Control**: Create food items with variants, add-ons, diet scope (Veg/Non-Veg), and submit categories for admin approval with compulsory image uploads.
- **Finance & Payouts**: Daily/monthly revenue metrics, withdrawal requests, commission tracking, and subscription plan management.

### 🛵 Delivery Partner (Deliveryman V2)
- **Compact Trip History**: Real-time trip status, detailed food items list (`2x Shawarma, 1x Coke`), date/time breakdown, and earnings per trip.
- **Pocket Statement**: Live cash-on-delivery (COD) collection tracking, limit settlements, and bonus payouts.
- **Emergency & Support**: Real-time safety issue reporting and support ticket generation.

### ⚙️ Super Admin Dashboard
- **Approvals Pipeline**: Approve new restaurant onboarding requests, globalize menu categories across all outlets, manage food item approvals.
- **Delivery Management**: Assign delivery zones, configure delivery commissions, manage incentives and bonuses.
- **Marketing & Content**: Create promotional ad banners, manage coupons, push system notifications, and review complaints.
- **Reports & Analytics**: Comprehensive exportable reports (PDF / Excel) for sales, taxes, commissions, disbursements, and user feedback.

---

## 🛠 Technology Stack

### Frontend
- **Framework**: React 19 + Vite 7
- **Styling**: Tailwind CSS v4 + Emotion + Custom CSS Design System
- **State Management**: Redux Toolkit & Zustand
- **Animations & Motion**: Framer Motion + GSAP + Lenis Smooth Scroll
- **Realtime & Push**: Socket.io Client + Firebase (Realtime Database & FCM Notifications)
- **Maps**: Google Maps JavaScript API Loader + Leaflet / React-Leaflet
- **Icons**: Lucide React + Material-UI Icons + HeroIcons

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose ORM
- **Cache & Message Broker**: Redis + BullMQ (Background Workers for OTP, Notifications, Orders, Payments, Maintenance)
- **Realtime**: Socket.io Server + `@socket.io/redis-adapter`
- **Security & Auth**: JWT (Access & Refresh tokens), BcryptJS, Helmet, Express Rate Limit, Mongo-Sanitize, XSS-Clean
- **File Processing**: Multer + Sharp (WebP compression & image resizing)
- **Integrations**: Razorpay API, Nodemailer (SMTP), Firebase Admin SDK, SMS India Hub API

---

## 📁 Project Architecture & Structure

```
grhapoch/
├── Backend/
│   ├── src/
│   │   ├── app.js                   # Express app setup, middlewares, routes
│   │   ├── config/                  # DB, Redis, Socket, Firebase, Env validations
│   │   ├── middleware/              # Authentication, authorization, rate limiters
│   │   ├── modules/                 # Modular domain logic
│   │   │   ├── food/                # Admin, User, Restaurant, Delivery modules
│   │   │   └── socket/              # Socket controllers & event handlers
│   │   ├── queues/                  # BullMQ background workers (OTP, Orders, Notifications)
│   │   ├── services/                # Storage, SMS, Email, Upload services
│   │   └── utils/                   # Logger, helpers, async handlers
│   ├── scripts/                     # Database migrations & scheduled jobs
│   ├── server.js                    # Primary HTTP & socket server entry point
│   ├── socket-server.js             # Standalone Socket.io server (optional cluster mode)
│   ├── uploads/                     # Local storage directory for uploaded media
│   └── package.json
│
├── Frontend/
│   ├── public/                      # Static assets & Firebase messaging service worker
│   ├── src/
│   │   ├── components/              # Shared UI components & design system
│   │   ├── context/                 # Auth & global state providers
│   │   ├── hooks/                   # Custom React hooks (navigation, back button, socket)
│   │   ├── modules/                 # Domain modules (Food, DeliveryV2, Admin)
│   │   │   └── Food/
│   │   │       ├── components/      # User, Admin & Restaurant components
│   │   │       ├── pages/           # Pages (User, Restaurant, Admin, Delivery)
│   │   │       └── utils/           # Helper utilities & API callers
│   │   ├── services/                # Axios API instance and endpoints
│   │   ├── App.jsx                  # Main App router
│   │   ├── main.jsx                 # Entry point
│   │   └── index.css                # Global styles & Tailwind import
│   ├── vite.config.js               # Vite configuration with aliases & PWA
│   └── package.json
│
└── README.md
```

---

## 💻 Prerequisites

Ensure you have the following installed on your development machine:

- **Node.js**: `v18.x` or higher (Node v20 LTS recommended)
- **npm**: `v9.x` or higher (comes bundled with Node.js)
- **MongoDB**: Community or Enterprise Server `v6.0+` (or a MongoDB Atlas connection string)
- **Redis Server**: `v6.x+` (Recommended for socket adapter, caching, and BullMQ background workers)

---

## 🚀 Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/aditi1717/grhapoch.git
cd grhapoch
```

---

### 2. Backend Setup

1. **Navigate to the Backend directory:**
   ```bash
   cd Backend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the `Backend/` directory:
   ```bash
   cp .env.example .env
   ```

4. **Start the Backend Server:**

   - **Development mode (with auto-reload):**
     ```bash
     npm run dev
     ```

   - **Production mode:**
     ```bash
     npm start
     ```

   The backend will start running at `http://localhost:5000`.

5. *(Optional)* **Start Background Queue Workers & Socket Server:**
   - **Socket Server:** `npm run start:socket`
   - **OTP Worker:** `npm run worker:otp`
   - **Order Worker:** `npm run worker:order`
   - **Notification Worker:** `npm run worker:notification`

---

### 3. Frontend Setup

1. **Navigate to the Frontend directory:**
   ```bash
   cd ../Frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the `Frontend/` directory:
   ```bash
   cp .env.production.example .env
   ```

4. **Start the Frontend Development Server:**
   ```bash
   npm run dev
   ```

   The application will be accessible in your browser at `http://localhost:5173`.

5. **Build for Production:**
   ```bash
   npm run build
   ```
   The compiled production output will be generated inside the `Frontend/dist` folder.

---

## 📜 Available NPM Scripts

### Backend Scripts

Run from the `Backend` directory:

| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts server with `nodemon` for auto-reloading on changes |
| `npm start` | Starts production Node.js server (`server.js`) |
| `npm run start:socket` | Runs standalone Socket.io server (`socket-server.js`) |
| `npm run start:scheduler` | Runs background scheduled jobs (e.g. offer expirations, FSSAI alerts) |
| `npm run worker:otp` | Runs BullMQ worker for processing OTP queues |
| `npm run worker:order` | Runs BullMQ worker for background order processing |
| `npm run worker:notification` | Runs BullMQ worker for push notifications |
| `npm run migrate:fcm-tokens` | Migration script for FCM token user profiles |
| `npm run migrate:order-payments` | Migration script syncing orders with transaction records |

### Frontend Scripts

Run from the `Frontend` directory:

| Script | Description |
| :--- | :--- |
| `npm run dev` | Launches Vite local development server (`http://localhost:5173`) |
| `npm run build` | Compiles production build to `dist/` folder |
| `npm run preview` | Previews the compiled production build locally |
| `npm run lint` | Runs ESLint to check for code style issues |
| `npm run start` | Runs Express server (`server.js`) to serve `dist/` build |

---

## 🔌 Ports & Endpoint References

| Service / Portal | Default Local URL / Port | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | `http://localhost:5173` | Main User, Restaurant, Admin & Delivery Portal |
| **Backend REST API** | `http://localhost:5000/api/v1` | Express REST API server |
| **Media Uploads** | `http://localhost:5000/uploads` | Uploaded images & media assets |
| **Socket Server** | `http://localhost:5001` | Socket.io real-time communication server |

---

## ❓ Troubleshooting & FAQs

### 1. Backend throws MongoDB connection error?
- Make sure MongoDB service is running locally (`mongod`) or update `MONGO_URI` in `Backend/.env` to a valid MongoDB connection string.

### 2. OTP is not receiving on mobile number?
- If `USE_DEFAULT_OTP=true` is set in `Backend/.env`, use `123456` as the default verification code.
- Ensure your `SMS_INDIA_HUB` credentials and DLT template ID are valid if `USE_DEFAULT_OTP=false`.

### 3. Images fail to upload on Category or Menu pages?
- Ensure the `Backend/uploads` directory exists or the backend process has write permissions to create it automatically.

### 4. Port 5000 or 5173 already in use?
- Change `PORT` in `Backend/.env` or specify a custom port in `Frontend/package.json` (`vite --port 3000`).

---

## 📄 License

This project is proprietary software under the **ISC License**. All rights reserved.
