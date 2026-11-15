/**
 * AquaSense Blynk REST API Client
 * Interfaces directly with Blynk IoT Cloud to read sensor pins and trigger actions.
 */

class BlynkService {
  constructor(config = {}) {
    this.token = config.token || '4iuc3Ae1HhtoMH5xwIt9czgue5Nykx5p';
    this.baseUrl = config.baseUrl || 'https://blynk.cloud/external/api';
    this.feedPin = config.feedPin || 'v6';
    this.silencePin = config.silencePin || 'v5';
    this.isDemoMode = config.isDemoMode || false;
    
    // Internal cache / simulation state (calibrated to realistic values)
    this.simulatedState = {
      turbidity: 2080,
      waterLevel: 2150,
      temperature: 26.5,
      buzzerActive: 0,
      feedLog: 'System running normally',
      isConnected: true,
      lastFed: '08:00 AM'
    };
  }

  setAuthToken(token) {
    this.token = token.trim();
  }

  setFeedPin(pin) {
    this.feedPin = pin.trim().toLowerCase();
  }

  setDemoMode(enabled) {
    this.isDemoMode = enabled;
  }

  /**
   * Checks if ESP32 device is currently online on Blynk Cloud
   */
  async checkHardwareStatus() {
    if (this.isDemoMode) {
      return { isConnected: true, mode: 'demo' };
    }

    try {
      const url = `${this.baseUrl}/isHardwareConnected?token=${this.token}`;
      const response = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      const text = await response.text();
      const isConnected = text.trim().toLowerCase() === 'true';
      return { isConnected, mode: 'live' };
    } catch (error) {
      console.warn('[BlynkService] Hardware check failed, error:', error.message);
      return { isConnected: false, mode: 'live', error: error.message };
    }
  }

  /**
   * Fetches single virtual pin value
   */
  async getPinValue(pin) {
    if (this.isDemoMode) {
      return this.getSimulatedPin(pin);
    }

    try {
      const url = `${this.baseUrl}/get?token=${this.token}&${pin.toLowerCase()}`;
      const response = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const val = await response.text();
      return val.trim();
    } catch (err) {
      console.warn(`[BlynkService] Failed to read ${pin}:`, err.message);
      throw err;
    }
  }

  /**
   * Fetches all aquarium sensor telemetry simultaneously
   */
  async getAllSensors() {
    if (this.isDemoMode) {
      return this.generateSimulatedTelemetry();
    }

    try {
      const [v0, v1, v2, v3, v4, status] = await Promise.allSettled([
        this.getPinValue('v0'), // Turbidity
        this.getPinValue('v1'), // Water level
        this.getPinValue('v2'), // Temperature
        this.getPinValue('v3'), // Buzzer alert active
        this.getPinValue('v4'), // Feed status
        this.checkHardwareStatus()
      ]);

      return {
        turbidity: v0.status === 'fulfilled' ? parseInt(v0.value, 10) || 0 : 0,
        waterLevel: v1.status === 'fulfilled' ? parseInt(v1.value, 10) || 0 : 0,
        temperature: v2.status === 'fulfilled' ? parseFloat(v2.value) || 0.0 : 0.0,
        buzzerActive: v3.status === 'fulfilled' ? parseInt(v3.value, 10) === 1 : false,
        feedLog: v4.status === 'fulfilled' ? v4.value : 'No log received',
        isConnected: status.status === 'fulfilled' ? status.value.isConnected : false,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[BlynkService] Batch fetch failed:', error);
      throw error;
    }
  }

  /**
   * Updates a virtual pin on Blynk Cloud
   */
  async updatePin(pin, value) {
    const cleanPin = pin.trim().toLowerCase();

    if (this.isDemoMode) {
      if (cleanPin === 'v5') this.simulatedState.buzzerActive = 0;
      if (cleanPin === this.feedPin) {
        this.simulatedState.feedLog = `Manual feed triggered at ${new Date().toLocaleTimeString()}`;
      }
      return { success: true };
    }

    try {
      const url = `${this.baseUrl}/update?token=${this.token}&${cleanPin}=${encodeURIComponent(value)}`;
      const response = await fetch(url, { method: 'GET', cache: 'no-store' });
      
      if (!response.ok) {
        if (response.status === 400) {
          throw new Error(`Datastream "${cleanPin.toUpperCase()}" not found in Blynk Console. Please create it under Templates -> Datastreams.`);
        }
        throw new Error(`HTTP Error ${response.status}`);
      }
      return { success: true };
    } catch (error) {
      console.error(`[BlynkService] Failed to write ${cleanPin}=${value}:`, error.message);
      throw error;
    }
  }

  /**
   * Sends command to silence the buzzer (V5)
   */
  async silenceBuzzer() {
    return await this.updatePin(this.silencePin, 1);
  }

  /**
   * Sends command to trigger immediate fish feeding (V6)
   */
  async triggerFeeding() {
    const res = await this.updatePin(this.feedPin, 1);
    setTimeout(() => {
      this.updatePin(this.feedPin, 0).catch(() => {});
    }, 1200);
    return res;
  }

  // --- Simulation Helpers ---
  getSimulatedPin(pin) {
    switch(pin.toLowerCase()) {
      case 'v0': return String(this.simulatedState.turbidity);
      case 'v1': return String(this.simulatedState.waterLevel);
      case 'v2': return String(this.simulatedState.temperature.toFixed(1));
      case 'v3': return String(this.simulatedState.buzzerActive);
      case 'v4': return this.simulatedState.feedLog;
      default: return '0';
    }
  }

  generateSimulatedTelemetry() {
    const tempNoise = (Math.random() - 0.5) * 0.15;
    this.simulatedState.temperature = +(Math.max(22, Math.min(32, this.simulatedState.temperature + tempNoise))).toFixed(1);

    const turbidityNoise = Math.floor((Math.random() - 0.5) * 20);
    this.simulatedState.turbidity = Math.max(1500, Math.min(2300, this.simulatedState.turbidity + turbidityNoise));

    const waterNoise = Math.floor((Math.random() - 0.5) * 15);
    this.simulatedState.waterLevel = Math.max(1200, Math.min(2300, this.simulatedState.waterLevel + waterNoise));

    return {
      turbidity: this.simulatedState.turbidity,
      waterLevel: this.simulatedState.waterLevel,
      temperature: this.simulatedState.temperature,
      buzzerActive: this.simulatedState.buzzerActive === 1,
      feedLog: this.simulatedState.feedLog,
      isConnected: true,
      timestamp: new Date()
    };
  }
}

window.BlynkService = BlynkService;
