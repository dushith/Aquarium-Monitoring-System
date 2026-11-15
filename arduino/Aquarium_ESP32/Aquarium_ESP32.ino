#define BLYNK_TEMPLATE_ID "............."
#define BLYNK_TEMPLATE_NAME "..............."
#define BLYNK_AUTH_TOKEN "......................."

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <BlynkSimpleEsp32.h>
#include <UniversalTelegramBot.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>

// ======================== WiFi Credentials ========================
char ssid[] = "..........";
char pass[] = ".............";

// ======================== Telegram Bot Setup ========================
#define BOT_TOKEN "..........."
#define CHAT_ID "..........."

WiFiClientSecure secured_client;
UniversalTelegramBot bot(BOT_TOKEN, secured_client);

// ======================== Pin Assignments ========================
#define TURBIDITY_PIN    34  
#define WATER_LEVEL_PIN  35  
#define TEMP_PIN         4 
#define BUZZER_PIN       26
#define SERVO_PIN        27

// ======================== Sensor & Actuator Objects ========================
OneWire oneWire(TEMP_PIN);
DallasTemperature temperatureSensor(&oneWire);
Servo feederServo;
BlynkTimer timer;

// ======================== Calibrated Thresholds =========================
int waterLowThreshold   = 1300;  
int turbidityThreshold  = 1700;

float minimumTemperature = 24.0; 
float maximumTemperature = 30.0;

// ======================== Feeder Servo Parameters ========================
int servoClosedAngle = 0;  
int servoOpenAngle   = 90;  
int feedingDelay     = 400; 
// ======================== Feeding Schedule (24-Hour Format) ========================
int morningFeedHour   = 8;   
int morningFeedMinute = 0;

int eveningFeedHour   = 18; 
int eveningFeedMinute = 0;

bool morningFed = false;
bool eveningFed = false;

// ======================== Alert Flags & Telemetry ========================
bool waterAlertSent       = false;
bool temperatureAlertSent = false;
bool turbidityAlertSent   = false;

int turbidityValue   = 0;
int waterLevelValue  = 0;
float temperatureValue = 0.0;

// ======================== Helper Functions ========================
void sendTelegramMessage(String message) {
  bot.sendMessage(CHAT_ID, message, "");
}

void buzzerOn() {
  digitalWrite(BUZZER_PIN, HIGH);
}

void buzzerOff() {
  digitalWrite(BUZZER_PIN, LOW);
}

void feedFish() {
  Serial.println("\n>>> [FEEDER] Starting fish feeding sequence...");

  feederServo.write(servoOpenAngle);
  delay(feedingDelay);

  feederServo.write(servoClosedAngle);
  delay(500);

  Serial.println(">>> [FEEDER] Feeding completed successfully.");

  String logMsg = "Feeding done at " + String(millis() / 1000) + "s";
  Blynk.virtualWrite(V4, logMsg);
  Blynk.logEvent("feeding_done", "Fish feeding completed successfully");

  sendTelegramMessage("Scheduled / Manual fish feeding completed successfully.");
}

void readSensors() {
  turbidityValue = analogRead(TURBIDITY_PIN);
  waterLevelValue = analogRead(WATER_LEVEL_PIN);

  temperatureSensor.requestTemperatures();
  temperatureValue = temperatureSensor.getTempCByIndex(0);

  Serial.println("========== SENSOR TELEMETRY ==========");
  Serial.print("Turbidity (Clarity): ");
  Serial.print(turbidityValue);
  Serial.println(turbidityValue >= turbidityThreshold ? " [CLEAN]" : " [CLOUDY/DIRTY]");

  Serial.print("Water Level:         ");
  Serial.print(waterLevelValue);
  Serial.println(waterLevelValue >= waterLowThreshold ? " [NORMAL]" : " [LOW WATER]");

  Serial.print("Temperature:         ");
  Serial.print(temperatureValue);
  Serial.println(" °C");
  Serial.println("======================================");

  // Send real-time data to Blynk Virtual Pins (Read by Web & Android App)
  Blynk.virtualWrite(V0, turbidityValue);
  Blynk.virtualWrite(V1, waterLevelValue);
  Blynk.virtualWrite(V2, temperatureValue);

  checkAlerts();
}

void checkAlerts() {
  bool alertActive = false;

  //Water Level Check
  if (waterLevelValue < waterLowThreshold) {
    alertActive = true;

    if (!waterAlertSent) {
      String message = "⚠️ ALERT: Water level is LOW! Level: " + String(waterLevelValue);
      Serial.println(message);

      Blynk.logEvent("water_low", message);
      sendTelegramMessage(message);

      waterAlertSent = true;
    }
  } else {
    waterAlertSent = false;
  }

  // Temperature Check
  if (temperatureValue < minimumTemperature || temperatureValue > maximumTemperature) {
    alertActive = true;

    if (!temperatureAlertSent) {
      String message = "⚠️ ALERT: Temperature abnormal! Current: " + String(temperatureValue) + " °C";
      Serial.println(message);

      Blynk.logEvent("temperature_alert", message);
      sendTelegramMessage(message);

      temperatureAlertSent = true;
    }
  } else {
    temperatureAlertSent = false;
  }

  // Turbidity Check
  if (turbidityValue < turbidityThreshold) {
    alertActive = true;

    if (!turbidityAlertSent) {
      String message = "⚠️ ALERT: Water is cloudy/turbid! Value: " + String(turbidityValue);
      Serial.println(message);

      Blynk.logEvent("turbidity_alert", message);
      sendTelegramMessage(message);

      turbidityAlertSent = true;
    }
  } else {
    turbidityAlertSent = false;
  }

  // Hardware Buzzer & App Virtual Alert Pin (V3)
  if (alertActive) {
    buzzerOn();
    Blynk.virtualWrite(V3, 1);
  } else {
    buzzerOff();
    Blynk.virtualWrite(V3, 0);
  }
}

void checkFeedingSchedule() {
  struct tm timeinfo;

  if (!getLocalTime(&timeinfo)) {
    Serial.println("[NTP] Waiting for time synchronization...");
    return;
  }

  int currentHour = timeinfo.tm_hour;
  int currentMinute = timeinfo.tm_min;

  Serial.printf("[NTP Time] %02d:%02d\n", currentHour, currentMinute);

  // Morning Feeding Check
  if (currentHour == morningFeedHour && currentMinute == morningFeedMinute && !morningFed) {
    feedFish();
    morningFed = true;
  }

  // Evening Feeding Check
  if (currentHour == eveningFeedHour && currentMinute == eveningFeedMinute && !eveningFed) {
    feedFish();
    eveningFed = true;
  }

  // Reset flags at midnight (00:00)
  if (currentHour == 0 && currentMinute == 0) {
    morningFed = false;
    eveningFed = false;
  }
}

// ======================== Blynk Callbacks ========================

// Silence buzzer button
BLYNK_WRITE(V5) {
  int buttonState = param.asInt();

  if (buttonState == 1) {
    buzzerOff();
    Blynk.virtualWrite(V3, 0);
    Serial.println("[Blynk] Buzzer turned OFF manually from App.");
  }
}

//Instant Manual Feed
BLYNK_WRITE(V6) {
  int buttonState = param.asInt();

  if (buttonState == 1) {
    Serial.println("[Blynk] Instant Feed triggered remotely from App!");
    feedFish();
    // Auto-reset button state back to 0 on Blynk app
    Blynk.virtualWrite(V6, 0);
  }
}

// ======================== Setup & Loop ========================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==============================================");
  Serial.println("   Aquarium monitoring System Starting   ");
  Serial.println("==============================================");

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  temperatureSensor.begin();

  feederServo.attach(SERVO_PIN);
  feederServo.write(servoClosedAngle);

  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, pass);

  int wifiRetries = 0;
  while (WiFi.status() != WL_CONNECTED && wifiRetries < 25) {
    delay(500);
    Serial.print(".");
    wifiRetries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected successfully.");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection pending, continuing setup...");
  }

  secured_client.setInsecure();

  Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);

  // Sri Lanka Timezone UTC +5:30 (19800 seconds offset)
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov");

  delay(1500);

  sendTelegramMessage("AquaSense Smart Aquarium System started successfully.");

  // Timer intervals: Read sensors every 5s, check feeding schedule every 30s
  timer.setInterval(5000L, readSensors); 
  timer.setInterval(30000L, checkFeedingSchedule);

  Serial.println("System setup completed successfully.\n");
}

void loop() {
  Blynk.run();
  timer.run();
}
