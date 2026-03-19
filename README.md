<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>
# M-Cap Labs – Edit the Iconic Fast Food Punks M Cap

Live App: **[https://m-cap-labs.vercel.app/](https://m-cap-labs.vercel.app/)**

M-Cap Labs is a fun, creative web tool to remix and meme-ify the legendary **pixelated "M" cap** from the **Fast Food Punks** NFT collection (2021 bear market parody of CryptoPunks, featuring hand-drawn fast-food themed avatars with that classic red/white McDonald's-inspired M hat).

Built with love using Google AI Studio + Gemini + Vite + React + Vercel.

## Features

### Cap Engine (Manual 3-Layer Editor)
- Customize the iconic M cap with a **3-layer system**:
  - Base layer
  - Color/overlay layer
  - Details/top layer
- Random color combinations with one click
- Edit palette manually
- Add custom text
- Apply textures and animation effects
- Real-time preview

### Meme Engine (Automatic Cap Placement)
- Upload any photo/selfie
- AI-powered **head/face recognition** detects the head position
- Automatically places a randomized M cap on the detected head
- Adjust cap size, position, rotation, opacity
- Generate random variations instantly
- Download your meme-ready result

Perfect for creating hilarious Fast Food Punks-style memes, profile pics, or just vibing with the OG crypto fast-food aesthetic.

## Tech Stack
- Frontend: React + Vite
- AI: Google Gemini (for head detection & image understanding in Meme Engine)
- Deployment: Vercel
- Static assets: Served from `/public/`

## How to Run Locally (Optional)
1. Clone the repo
2. `npm install`
3. Add your Gemini API key: create `.env` with `VITE_GEMINI_API_KEY=your-key-here`
4. `npm run dev`

## Credits & Inspiration
- Inspired by the **Fast Food Punks** collection (2021) – the bear market meme kings with pixel M caps.
- Built in Google AI Studio, exported & deployed for everyone to enjoy.

Fork, remix, make memes – enjoy! 🍔🧢

Made with ❤️ in 2026

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9a95dfe4-1ba7-4eb5-ae5e-a00f1cdac1d6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
