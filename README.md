# Aquarium Monitoring System 

**Introduction**

Aquarium fish need stable water conditions to live safely. If the water becomes dirty, the water 
level becomes low, or the temperature becomes harmful, fish can become stressed, sick, or 
even die. In many situations these problems are not noticed quickly by the aquarium owner. 
Therefore an automatic monitoring system is useful to detect unsafe conditions early and alert 
the user. 
The main purpose of this project is to save fish life by continuously monitoring aquarium water 
conditions. This project uses an ESP32 microcontroller as the main controller. The ESP32 
collects data from a turbidity sensor, water level sensor, and DS18B20 temperature sensor. The 
turbidity sensor detects dirty or cloudy water, the water level sensor detects low water level, and 
the temperature sensor measures the aquarium water temperature. 
When the system detects an unsafe condition, such as dirty water, harmful temperature, or low 
water level, the ESP32 activates a 12V buzzer to alert the user immediately. The system also 
sends notifications through Blynk IoT and Telegram Bot. Blynk is used to display live sensor 
values on a mobile dashboard while Telegram provides direct text alerts to the user’s phone. 
This project also includes an automatic feeding function using a servo motor. At scheduled 
feeding times, the ESP32 rotates the servo motor to release fish food. Overall  this system helps 
reduce manual monitoring, improves aquarium safety, and supports better fish care. 


**System Architecture**

The system architecture of the ESP32 based Smart Aquarium Monitoring and Automatic 
Feeding System is designed to monitor aquarium conditions, process sensor data, and alert the 
user when unsafe conditions are detected. The ESP32 microcontroller is placed at the center of 
the system because it works as the main control unit. The water level sensor, turbidity sensor, 
and DS18B20 temperature sensor are connected to the ESP32 as input devices. These sensors 
continuously collect information about the aquarium water condition. 
The water level sensor is used to detect whether the aquarium water level is low. The turbidity 
sensor is used to identify dirty water. The DS18B20 temperature sensor is used to measure the 
water temperature. ESP32 reads the values from these sensors and compares them with 
predefined range of values. If the sensor readings show an unsafe condition, such as low water 
level, dirty water, or harmful temperature, the ESP32 activates the alert system. 
The system uses a 12V buzzer as a local warning device. When the ESP32 detects a problem 
the buzzer turns on and gives an alert to the user. This helps the user notice the problem 
immediately without checking the mobile phone. The system also includes a servo motor which 
is used for automatic fish feeding. At scheduled feeding times the ESP32 controls the servo 
motor and release fish food into the aquarium. 
For remote monitoring the ESP32 connects to the internet using Wi-Fi and sends data to Blynk 
IoT Cloud. Blynk IoT displays live sensor values such as water level, turbidity, temperature, 
buzzer status, and feeding status on the mobile dashboard. 
The system also uses a Telegram Bot to send direct text alert messages to the user’s phone. 
This provides an additional notification method which makes the alert system more reliable. 
Overall, the system architecture shows how the sensors, ESP32, buzzer, servo motor, Blynk 
IoT, Telegram Bot, and mobile phone work together. The sensors collect data the ESP32 
processes the data and the output devices and online platforms notify the user when action is 
needed. This system helps maintain a safe aquarium environment and supports better fish care 
by detecting problems early. 

<img width="802" height="832" alt="Untitled Diagram drawio" src="https://github.com/user-attachments/assets/2ac780a8-75b5-4d0c-aab1-64ab73135429" />

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
app/
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
