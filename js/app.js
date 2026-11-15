/**
 * AquaSense - Main Application Controller
 * Handles UI interactions, Chart.js telemetry, audio alerts, and schedule countdowns.
 */

// Calibrated Configuration
const DEFAULT_CONFIG = {
  authToken: '4iuc3Ae1HhtoMH5xwIt9czgue5Nykx5p',
  feedPin: 'v6',
  silencePin: 'v5',
  pollInterval: 3000,
  minTemp: 24.0,
  maxTemp: 30.0,
  waterLowThreshold: 1300,   // Calibrated: alert below 1300
  turbidityThreshold: 1700,  // Calibrated: alert below 1700
  maxAnalogScale: 2200,      // Calibrated: ~2200 is full water & clean turbidity
  morningFeedHour: 8,
  morningFeedMin: 0,
  eveningFeedHour: 18,
  eveningFeedMin: 0,
  soundEnabled: true,
  demoMode: false
};

class AquaSenseApp {
  constructor() {
    this.config = this.loadConfig();
    this.blynk = new BlynkService({
      token: this.config.authToken,
      feedPin: this.config.feedPin || 'v6',
      silencePin: this.config.silencePin || 'v5',
      isDemoMode: this.config.demoMode
    });

    this.chart = null;
    this.chartData = {
      labels: [],
      temp: [],
      water: [],
      turbidity: []
    };
    this.maxHistoryPoints = 20;

    this.pollingTimer = null;
    this.audioContext = null;
    this.deferredInstallPrompt = null;
    this.lastAlarmState = false;

    this.init();
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem('aquasense_config_v2');
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  saveConfig() {
    localStorage.setItem('aquasense_config_v2', JSON.stringify(this.config));
    this.blynk.setAuthToken(this.config.authToken);
    this.blynk.setFeedPin(this.config.feedPin || 'v6');
    this.blynk.setDemoMode(this.config.demoMode);
  }

  init() {
    this.initPWA();
    this.initChart();
    this.bindEvents();
    this.updateScheduleDisplay();
    this.startPolling();
    this.startClock();

    this.logActivity('AquaSense system initialized. Connecting to Blynk IoT Cloud...', 'info');
  }

  // --- Web Audio API Synth Alarm ---
  playAlarmChime() {
    if (!this.config.soundEnabled) return;
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.35);

      gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start();
      osc.stop(this.audioContext.currentTime + 0.35);
    } catch (err) {
      console.warn('Audio synth chime failed:', err);
    }
  }

  // --- Real-time Chart.js Setup ---
  initChart() {
    const ctx = document.getElementById('telemetryChart');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.chartData.labels,
        datasets: [
          {
            label: 'Temperature (°C)',
            data: this.chartData.temp,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            borderWidth: 2.5,
            yAxisID: 'yTemp',
            tension: 0.35,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#38bdf8'
          },
          {
            label: 'Water Level (ADC)',
            data: this.chartData.water,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.05)',
            borderWidth: 2,
            yAxisID: 'yAnalog',
            tension: 0.35,
            pointRadius: 2,
            pointBackgroundColor: '#34d399'
          },
          {
            label: 'Turbidity Clarity (ADC)',
            data: this.chartData.turbidity,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            borderWidth: 2,
            yAxisID: 'yAnalog',
            tension: 0.35,
            pointRadius: 2,
            pointBackgroundColor: '#f59e0b'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#e2e8f0',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(56, 189, 248, 0.3)',
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', maxTicksLimit: 6 }
          },
          yTemp: {
            type: 'linear',
            position: 'left',
            min: 15,
            max: 38,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#38bdf8', callback: (v) => `${v}°C` }
          },
          yAnalog: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 2500,
            grid: { drawOnChartArea: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  }

  addChartPoint(timestamp, temp, water, turbidity) {
    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    this.chartData.labels.push(timeStr);
    this.chartData.temp.push(temp);
    this.chartData.water.push(water);
    this.chartData.turbidity.push(turbidity);

    if (this.chartData.labels.length > this.maxHistoryPoints) {
      this.chartData.labels.shift();
      this.chartData.temp.shift();
      this.chartData.water.shift();
      this.chartData.turbidity.shift();
    }

    if (this.chart) {
      this.chart.update('none');
    }
  }

  // --- Real-time Polling Cycle ---
  async fetchTelemetry() {
    try {
      const data = await this.blynk.getAllSensors();
      this.updateUI(data);
      this.addChartPoint(data.timestamp, data.temperature, data.waterLevel, data.turbidity);
      this.evaluateAlerts(data);
    } catch (err) {
      console.warn('Telemetry cycle error:', err);
      this.updateConnectionStatus(false, 'Connection Error');
    }
  }

  startPolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.fetchTelemetry();
    this.pollingTimer = setInterval(() => this.fetchTelemetry(), this.config.pollInterval);
  }

  // --- UI Updates ---
  updateUI(data) {
    // 1. Connection Status Badge
    this.updateConnectionStatus(data.isConnected, this.config.demoMode ? 'Demo Simulator' : 'Blynk Cloud');

    // 2. Temperature Card & Circular Gauge
    const tempEl = document.getElementById('val-temperature');
    const tempStatus = document.getElementById('status-temperature');
    const tempGauge = document.getElementById('gauge-temperature');
    
    if (tempEl) tempEl.innerText = `${data.temperature.toFixed(1)}°C`;
    
    const isTempNormal = data.temperature >= this.config.minTemp && data.temperature <= this.config.maxTemp;
    if (tempStatus) {
      tempStatus.innerText = isTempNormal ? 'Optimal' : (data.temperature < this.config.minTemp ? 'Too Cold' : 'Too Hot');
      tempStatus.className = `text-xs px-2.5 py-0.5 rounded-full font-medium ${isTempNormal ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/25 text-rose-300 border border-rose-500/30 animate-pulse'}`;
    }
    if (tempGauge) {
      const pct = Math.min(100, Math.max(0, ((data.temperature - 15) / 20) * 100));
      const circumference = 2 * Math.PI * 26; // r=26
      const offset = circumference - (pct / 100) * circumference;
      tempGauge.style.strokeDasharray = `${circumference} ${circumference}`;
      tempGauge.style.strokeDashoffset = offset;
      tempGauge.style.stroke = isTempNormal ? '#38bdf8' : '#f43f5e';
    }

    // 3. Water Level Card (Calibrated 0 - 2200 scale)
    const waterEl = document.getElementById('val-water');
    const waterStatus = document.getElementById('status-water');
    const waterBar = document.getElementById('bar-water');

    if (waterEl) waterEl.innerText = `${data.waterLevel}`;
    const isWaterOk = data.waterLevel >= this.config.waterLowThreshold;
    if (waterStatus) {
      waterStatus.innerText = isWaterOk ? 'Normal Level' : 'LOW WATER';
      waterStatus.className = `text-xs px-2.5 py-0.5 rounded-full font-medium ${isWaterOk ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/25 text-rose-300 border border-rose-500/30 animate-pulse'}`;
    }
    if (waterBar) {
      const pct = Math.min(100, Math.max(0, (data.waterLevel / this.config.maxAnalogScale) * 100));
      waterBar.style.width = `${pct}%`;
      waterBar.className = `h-full rounded-full transition-all duration-700 ${isWaterOk ? 'bg-emerald-400 shadow-emerald-500/50 shadow-sm' : 'bg-rose-500 shadow-rose-500/50 shadow-sm'}`;
    }

    // 4. Turbidity (Clarity) Card (Calibrated 0 - 2200 scale)
    const turbEl = document.getElementById('val-turbidity');
    const turbStatus = document.getElementById('status-turbidity');
    const turbBar = document.getElementById('bar-turbidity');

    if (turbEl) turbEl.innerText = `${data.turbidity}`;
    const isTurbidityOk = data.turbidity >= this.config.turbidityThreshold;
    if (turbStatus) {
      turbStatus.innerText = isTurbidityOk ? 'Clean / Clear' : 'CLOUDY / DIRTY';
      turbStatus.className = `text-xs px-2.5 py-0.5 rounded-full font-medium ${isTurbidityOk ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/25 text-amber-300 border border-amber-500/30 animate-pulse'}`;
    }
    if (turbBar) {
      const pct = Math.min(100, Math.max(0, (data.turbidity / this.config.maxAnalogScale) * 100));
      turbBar.style.width = `${pct}%`;
      turbBar.className = `h-full rounded-full transition-all duration-700 ${isTurbidityOk ? 'bg-cyan-400 shadow-cyan-500/50 shadow-sm' : 'bg-amber-500 shadow-amber-500/50 shadow-sm'}`;
    }

    // 5. Feed Status Log
    const feedLogEl = document.getElementById('val-feed-log');
    if (feedLogEl && data.feedLog) {
      feedLogEl.innerText = data.feedLog;
    }
  }

  updateConnectionStatus(isConnected, label) {
    const badge = document.getElementById('connection-badge');
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');

    if (!badge || !dot || !text) return;

    if (isConnected) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-emerald-400 shadow-sm';
      text.innerText = `ONLINE (${label})`;
      badge.className = 'flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold';
    } else {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
      text.innerText = 'OFFLINE / CONNECTING';
      badge.className = 'flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold';
    }
  }

  evaluateAlerts(data) {
    const alerts = [];

    if (data.waterLevel < this.config.waterLowThreshold) {
      alerts.push(`Low Water Level (${data.waterLevel})! Threshold: ${this.config.waterLowThreshold}`);
    }

    if (data.temperature < this.config.minTemp || data.temperature > this.config.maxTemp) {
      alerts.push(`Temperature abnormal (${data.temperature.toFixed(1)}°C)! Range: ${this.config.minTemp}°C - ${this.config.maxTemp}°C`);
    }

    if (data.turbidity < this.config.turbidityThreshold) {
      alerts.push(`Water Cloudy/Turbid (${data.turbidity})! Threshold: ${this.config.turbidityThreshold}`);
    }

    const banner = document.getElementById('alarm-banner');
    const alarmMsg = document.getElementById('alarm-message');
    const silenceBtn = document.getElementById('btn-silence');

    const hasAlert = alerts.length > 0 || data.buzzerActive;

    if (hasAlert) {
      if (banner) {
        banner.classList.remove('hidden');
        if (alarmMsg) alarmMsg.innerText = alerts.join(' | ') || 'Hardware Alarm Triggered!';
      }
      if (silenceBtn) silenceBtn.classList.remove('opacity-50', 'pointer-events-none');
      
      if (!this.lastAlarmState) {
        this.playAlarmChime();
        this.logActivity(`⚠️ ALARM TRIGGERED: ${alerts.join('; ')}`, 'alert');
      }
      this.lastAlarmState = true;
    } else {
      if (banner) banner.classList.add('hidden');
      if (silenceBtn) silenceBtn.classList.add('opacity-50', 'pointer-events-none');
      this.lastAlarmState = false;
    }
  }

  // --- Clock & Countdown ---
  startClock() {
    setInterval(() => {
      this.updateClockDisplay();
      this.updateCountdown();
    }, 1000);
  }

  updateClockDisplay() {
    const clockEl = document.getElementById('current-time');
    if (clockEl) {
      const now = new Date();
      clockEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  updateScheduleDisplay() {
    const morningEl = document.getElementById('schedule-morning');
    const eveningEl = document.getElementById('schedule-evening');

    const pad = (n) => String(n).padStart(2, '0');
    if (morningEl) morningEl.innerText = `${pad(this.config.morningFeedHour)}:${pad(this.config.morningFeedMin)}`;
    if (eveningEl) eveningEl.innerText = `${pad(this.config.eveningFeedHour)}:${pad(this.config.eveningFeedMin)}`;
  }

  updateCountdown() {
    const countdownEl = document.getElementById('feed-countdown');
    if (!countdownEl) return;

    const now = new Date();
    const todayMorning = new Date();
    todayMorning.setHours(this.config.morningFeedHour, this.config.morningFeedMin, 0, 0);

    const todayEvening = new Date();
    todayEvening.setHours(this.config.eveningFeedHour, this.config.eveningFeedMin, 0, 0);

    let nextFeed = null;
    let label = '';

    if (now < todayMorning) {
      nextFeed = todayMorning;
      label = 'Morning Feed';
    } else if (now < todayEvening) {
      nextFeed = todayEvening;
      label = 'Evening Feed';
    } else {
      const tomorrowMorning = new Date(todayMorning);
      tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
      nextFeed = tomorrowMorning;
      label = 'Tomorrow Morning';
    }

    const diffMs = nextFeed - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

    countdownEl.innerText = `${String(diffHours).padStart(2, '0')}h ${String(diffMins).padStart(2, '0')}m ${String(diffSecs).padStart(2, '0')}s (${label})`;
  }

  // --- Manual Actions ---
  async handleFeedFish() {
    const btn = document.getElementById('btn-feed-now');
    if (!btn) return;

    btn.disabled = true;
    const origHtml = btn.innerHTML;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⚙️</span> Dispensing Food...`;

    this.logActivity(`🐟 Triggering manual feeding servo via ${this.config.feedPin.toUpperCase()}...`, 'info');

    try {
      await this.blynk.triggerFeeding();
      this.logActivity('✅ Manual feeding command sent to ESP32!', 'success');
      
      const feedLogEl = document.getElementById('val-feed-log');
      if (feedLogEl) feedLogEl.innerText = `Manual feed dispatched at ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      this.logActivity(`❌ Manual feed error: ${err.message}`, 'alert');
      alert(`Feeding Action Failed:\n\n${err.message}`);
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }, 2000);
    }
  }

  async handleSilenceBuzzer() {
    this.logActivity('🔕 Silencing alarm buzzer via Blynk V5...', 'info');
    try {
      await this.blynk.silenceBuzzer();
      this.logActivity('✅ Buzzer silence command dispatched.', 'success');
      const banner = document.getElementById('alarm-banner');
      if (banner) banner.classList.add('hidden');
    } catch (err) {
      this.logActivity(`❌ Failed to silence buzzer: ${err.message}`, 'alert');
    }
  }

  logActivity(message, type = 'info') {
    const list = document.getElementById('activity-logs');
    if (!list) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const item = document.createElement('div');
    
    let colorClass = 'text-slate-300 border-slate-700/50';
    let icon = '🔹';
    if (type === 'alert') {
      colorClass = 'text-rose-300 bg-rose-950/30 border-rose-500/30';
      icon = '⚠️';
    } else if (type === 'success') {
      colorClass = 'text-emerald-300 bg-emerald-950/30 border-emerald-500/30';
      icon = '✅';
    }

    item.className = `flex items-center justify-between p-2 rounded-lg border text-xs ${colorClass} transition-all`;
    item.innerHTML = `
      <span class="flex items-center gap-2 truncate">
        <span>${icon}</span>
        <span class="truncate">${message}</span>
      </span>
      <span class="text-[10px] text-slate-400 shrink-0 ml-2">${time}</span>
    `;

    list.insertBefore(item, list.firstChild);
    while (list.children.length > 25) {
      list.removeChild(list.lastChild);
    }
  }

  // --- Modal & Config Bindings ---
  openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    document.getElementById('input-token').value = this.config.authToken;
    document.getElementById('input-feed-pin').value = this.config.feedPin || 'v6';
    document.getElementById('input-min-temp').value = this.config.minTemp;
    document.getElementById('input-max-temp').value = this.config.maxTemp;
    document.getElementById('input-water-thresh').value = this.config.waterLowThreshold;
    document.getElementById('input-turb-thresh').value = this.config.turbidityThreshold;
    document.getElementById('input-morning-time').value = `${String(this.config.morningFeedHour).padStart(2, '0')}:${String(this.config.morningFeedMin).padStart(2, '0')}`;
    document.getElementById('input-evening-time').value = `${String(this.config.eveningFeedHour).padStart(2, '0')}:${String(this.config.eveningFeedMin).padStart(2, '0')}`;
    document.getElementById('check-demo-mode').checked = this.config.demoMode;
    document.getElementById('check-sound-alarm').checked = this.config.soundEnabled;

    modal.classList.remove('hidden');
  }

  closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
  }

  applySettings() {
    const token = document.getElementById('input-token').value;
    const feedPin = document.getElementById('input-feed-pin').value || 'v6';
    const minT = parseFloat(document.getElementById('input-min-temp').value);
    const maxT = parseFloat(document.getElementById('input-max-temp').value);
    const waterT = parseInt(document.getElementById('input-water-thresh').value, 10);
    const turbT = parseInt(document.getElementById('input-turb-thresh').value, 10);

    const mTime = document.getElementById('input-morning-time').value.split(':');
    const eTime = document.getElementById('input-evening-time').value.split(':');

    this.config.authToken = token || DEFAULT_CONFIG.authToken;
    this.config.feedPin = feedPin.trim().toLowerCase();
    this.config.minTemp = !isNaN(minT) ? minT : DEFAULT_CONFIG.minTemp;
    this.config.maxTemp = !isNaN(maxT) ? maxT : DEFAULT_CONFIG.maxTemp;
    this.config.waterLowThreshold = !isNaN(waterT) ? waterT : DEFAULT_CONFIG.waterLowThreshold;
    this.config.turbidityThreshold = !isNaN(turbT) ? turbT : DEFAULT_CONFIG.turbidityThreshold;

    if (mTime.length === 2) {
      this.config.morningFeedHour = parseInt(mTime[0], 10);
      this.config.morningFeedMin = parseInt(mTime[1], 10);
    }
    if (eTime.length === 2) {
      this.config.eveningFeedHour = parseInt(eTime[0], 10);
      this.config.eveningFeedMin = parseInt(eTime[1], 10);
    }

    this.config.demoMode = document.getElementById('check-demo-mode').checked;
    this.config.soundEnabled = document.getElementById('check-sound-alarm').checked;

    this.saveConfig();
    this.updateScheduleDisplay();
    this.closeSettingsModal();
    this.logActivity('Settings applied successfully.', 'success');
    this.fetchTelemetry();
  }

  // --- PWA Installation on Android ---
  initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .then((reg) => console.log('[PWA] Service Worker active:', reg.scope))
          .catch((err) => console.log('[PWA] SW registration failed:', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      const installBanner = document.getElementById('pwa-install-banner');
      if (installBanner) installBanner.classList.remove('hidden');
    });
  }

  async installPWA() {
    if (!this.deferredInstallPrompt) return;
    this.deferredInstallPrompt.prompt();
    const { outcome } = await this.deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      this.logActivity('AquaSense installed on home screen!', 'success');
    }
    this.deferredInstallPrompt = null;
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) installBanner.classList.add('hidden');
  }

  bindEvents() {
    document.getElementById('btn-feed-now')?.addEventListener('click', () => this.handleFeedFish());
    document.getElementById('btn-silence')?.addEventListener('click', () => this.handleSilenceBuzzer());
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.fetchTelemetry();
      this.logActivity('Manual telemetry refresh', 'info');
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('btn-close-settings')?.addEventListener('click', () => this.closeSettingsModal());
    document.getElementById('btn-save-settings')?.addEventListener('click', () => this.applySettings());

    document.getElementById('btn-install-pwa')?.addEventListener('click', () => this.installPWA());
    document.getElementById('btn-dismiss-pwa')?.addEventListener('click', () => {
      document.getElementById('pwa-install-banner')?.classList.add('hidden');
    });

    document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
      const list = document.getElementById('activity-logs');
      if (list) list.innerHTML = '';
      this.logActivity('Logs cleared', 'info');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AquaSenseApp();
});
