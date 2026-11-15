# AquaSense - Smart Aquarium Monitoring & Automated Feeder System 🐠🌊

An IoT Smart Aquarium Monitoring and Automated Feeder System built for **IT1140 Fundamentals of Computing - Mini Project**. It features a modern **Web Dashboard and Android PWA Mobile App** connected to an ESP32 microcontroller via **Blynk IoT Cloud REST API** and **Telegram Bot alerts**.

---

## 📱 Features

1. **Universal Web & Mobile App**:
   - Runs directly in Google Chrome, Microsoft Edge, Safari, Firefox, and Android browsers.
   - Installable on **Android** as a standalone native-feeling full-screen app via PWA ("Install App" / "Add to Home Screen").
2. **Real-Time Telemetry & Calibrated Gauges**:
   - 🌡️ **Temperature Gauge**: Monitored via DS18B20 sensor (Safe range: `24.0°C - 30.0°C`).
   - 💧 **Water Level Gauge**: Calibrated to practical ESP32 ADC range (`~2000 - 2200` Full water, Low water alarm `< 1300`).
   - 🌊 **Water Clarity (Turbidity)**: Calibrated (`~2000 - 2100` Clean clear water, Cloudy alarm `< 1700`).
   - ⚡ **Hardware Online/Offline Indicator**: Live ping to Blynk IoT Cloud.
3. **Controls & Feeder Automation**:
   - 🐟 **Instant Feed Button (V6)**: Remotely triggers SG90 feeder servo motor from the web/app and auto-resets button state.
   - ⏰ **Scheduled Feeding Countdown**: Synchronized with Sri Lanka Standard Time (UTC+5:30) via NTP (Morning `08:00` & Evening `18:00`).
   - 🔕 **Silence Alarm (V5)**: Remotely mutes the buzzer from the app without cutting system power.
   - 🔔 **In-App Audio Synth Alarm**: Web Audio synthesizer chimes when parameters breach thresholds.
4. **Historical Visualizations & Logs**:
   - Live multi-axis trend graph powered by **Chart.js**.
   - Chronological Activity & Alert Log.
5. **Interactive Demo Simulator**:
   - Toggle **Demo Simulator Mode** in the settings modal to showcase and demonstrate the UI, charts, and alarm flows even when the ESP32 is turned off.

---

## 📂 Project Structure

```
Testing app/
├── index.html                           # Responsive Web & Mobile Dashboard
├── manifest.json                        # Web App Manifest for Android PWA installation
├── service-worker.js                    # PWA Service Worker for offline asset caching
├── start_server.ps1                     # 1-Click Local Server script for PC & Android
├── css/
│   └── style.css                        # Aquatic Glassmorphism UI styling and animations
├── js/
│   ├── blynk-api.js                     # Blynk Cloud REST API interface (read/write V0-V6)
│   └── app.js                           # Telemetry charts, timer, alerts & audio synth
├── icons/
│   ├── icon.svg                         # Vector app icon
│   ├── icon-192.png                     # Android home screen icon (192x192)
│   └── icon-512.png                     # Android splash screen icon (512x512)
├── arduino/
│   └── Aquarium_ESP32/
│       └── Aquarium_ESP32.ino           # Complete calibrated ESP32 Arduino sketch
└── README.md                            # Documentation & Calibration Guide
```

---

## 📌 Blynk Virtual Pin Mapping

| Virtual Pin | Direction | Description | Normal / Safe Range |
|---|---|---|---|
| **V0** | ESP32 ➔ App | Water Turbidity (Clarity) | `~2000 - 2100` (Alarm if `< 1700`) |
| **V1** | ESP32 ➔ App | Water Level | `~2000 - 2200` (Alarm if `< 1300`) |
| **V2** | ESP32 ➔ App | Water Temperature | `24.0°C – 30.0°C` |
| **V3** | ESP32 ➔ App | Alarm Buzzer State | `0` (Normal) / `1` (Alarm Active) |
| **V4** | ESP32 ➔ App | Feeder / System Status Log | String message |
| **V5** | App ➔ ESP32 | Silence / Mute Buzzer | `1` (Turn off buzzer) |
| **V6** | App ➔ ESP32 | Instant Remote Feeding | `1` (Triggers servo rotation) |

---

## 🔌 Hardware Pin Connections (ESP32)

| Component | ESP32 Pin | Note |
|---|---|---|
| **DS18B20 Temperature Sensor** | `GPIO 4` | 4.7kΩ pull-up resistor between VCC and DATA |
| **Turbidity Sensor (Analog Out)** | `GPIO 34` | Analog input (ADC1_CH6) |
| **Water Level Sensor (Analog Out)**| `GPIO 35` | Analog input (ADC1_CH7) |
| **Active Buzzer Module** | `GPIO 26` | Digital Output (`HIGH` = Sound) |
| **SG90 Servo (Feeder)** | `GPIO 27` | PWM Output (`0°` closed, `90°` dispense) |

---

## 🚀 How to Run & Install

### 1. Launch on PC
Double-click `index.html` in file explorer or open with Google Chrome / Microsoft Edge.

### 2. Test on Android over Wi-Fi
1. Right-click `start_server.ps1` and select **"Run with PowerShell"**.
2. Open the displayed address (e.g. `http://192.168.1.xxx:8080`) on your Android phone's Chrome browser.
3. Tap **"Install AquaSense Mobile App"** on the prompt banner to install it onto your Android home screen!
