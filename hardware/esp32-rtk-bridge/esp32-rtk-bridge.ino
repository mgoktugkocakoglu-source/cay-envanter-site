/*
 * Çay Üreticisi — RTK GPS Bridge (ESP32)
 * ---------------------------------------------------------------------------
 * Bridges a u-blox RTK receiver (Here+ "rover" / NEO-M8P) to the mobile app so
 * the pruning ("budama") GPS flow can mark field corners with centimeter
 * accuracy instead of the phone's 3-5 m GPS.
 *
 * Data path:
 *   M8P  --UART(NMEA)-->  ESP32  --WiFi/WebSocket(NMEA)-->  phone app
 *   M8P  <--UART(RTCM3)-  ESP32  <--TCP(NTRIP)------------  CORS caster
 *
 * The ESP32 joins the PHONE'S HOTSPOT (station mode). That single link gives it
 * (a) internet to reach the NTRIP caster for RTCM3 corrections and (b) a local
 * address the app can open a WebSocket to. The app connects to
 * ws://<esp32-ip>:81  (or ws://caygps.local:81 via mDNS).
 *
 * Libraries (Arduino Library Manager):
 *   - "WebSockets" by Markus Sattler (arduinoWebSockets)   >= 2.4
 *   ESP32 core provides WiFi / ESPmDNS.
 *
 * Board: any ESP32 dev board (ESP32-WROOM-32 etc.).
 *
 * Wiring (M8P UART1 <-> ESP32 UART2, 3.3V logic — do NOT use 5V on RX/TX):
 *   M8P TX  -> ESP32 GPIO16 (RX2)
 *   M8P RX  <- ESP32 GPIO17 (TX2)   // carries RTCM3 corrections to the rover
 *   M8P GND -- ESP32 GND
 *   M8P VCC -- 5V supply (per the module's connector; logic stays 3.3V)
 *
 * Configure the M8P once in u-center (see README): NMEA GGA+GST out on UART1,
 * RTCM3 in on UART1, "High precision mode" NMEA enabled, UART1 baud = GPS_BAUD.
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebSocketsServer.h>

// ─── Configuration ─────────────────────────────────────────────────────────
// Phone hotspot the ESP32 joins (gives both internet + local reachability).
const char* WIFI_SSID = "TELEFON_HOTSPOT";
const char* WIFI_PASS = "hotspot_sifresi";

// mDNS hostname → app can use ws://caygps.local:81 (iOS resolves .local well;
// on Android prefer the printed IP if .local fails).
const char* MDNS_HOST = "caygps";

// NTRIP caster (e.g. Turkey's TUSAGA-Aktif CORS network). Fill from your account.
const char* NTRIP_HOST  = "ntrip.example.gov.tr";
const uint16_t NTRIP_PORT = 2101;
const char* NTRIP_MOUNT = "RTCM3_MOUNT";
const char* NTRIP_USER  = "kullanici";
const char* NTRIP_PASS  = "parola";

// u-blox UART. Factory default is 9600; raise to 38400 in u-center for RTK.
const uint32_t GPS_BAUD = 38400;
const int GPS_RX_PIN = 16;  // ESP32 RX2  <- M8P TX
const int GPS_TX_PIN = 17;  // ESP32 TX2  -> M8P RX

const uint16_t WS_PORT = 81;
const unsigned long GGA_INTERVAL_MS = 5000;  // how often to push GGA to caster
const unsigned long NTRIP_RETRY_MS  = 5000;

// ─── State ─────────────────────────────────────────────────────────────────
WebSocketsServer webSocket(WS_PORT);
WiFiClient ntrip;

char nmeaLine[120];
size_t nmeaLen = 0;

char lastGga[120] = {0};       // most recent valid GGA, sent to the caster
bool haveGga = false;

unsigned long lastGgaSent = 0;
unsigned long lastNtripTry = 0;

// ─── Helpers ───────────────────────────────────────────────────────────────
String base64(const String& in) {
  static const char* tbl =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String out;
  int val = 0, bits = -6;
  for (unsigned char c : in) {
    val = (val << 8) + c;
    bits += 8;
    while (bits >= 0) {
      out += tbl[(val >> bits) & 0x3F];
      bits -= 6;
    }
  }
  if (bits > -6) out += tbl[((val << 8) >> (bits + 8)) & 0x3F];
  while (out.length() % 4) out += '=';
  return out;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi baglaniyor");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print('.');
  }
  Serial.print("\nWiFi OK  IP: ");
  Serial.println(WiFi.localIP());

  if (MDNS.begin(MDNS_HOST)) {
    MDNS.addService("ws", "tcp", WS_PORT);
    Serial.printf("mDNS: ws://%s.local:%u\n", MDNS_HOST, WS_PORT);
  }
}

// Open (or reopen) the NTRIP stream and request the mountpoint.
void ntripConnect() {
  if (ntrip.connected()) return;
  if (millis() - lastNtripTry < NTRIP_RETRY_MS) return;
  lastNtripTry = millis();

  Serial.printf("NTRIP baglaniyor %s:%u/%s\n", NTRIP_HOST, NTRIP_PORT, NTRIP_MOUNT);
  if (!ntrip.connect(NTRIP_HOST, NTRIP_PORT)) {
    Serial.println("NTRIP TCP basarisiz");
    return;
  }

  String auth = base64(String(NTRIP_USER) + ":" + String(NTRIP_PASS));
  ntrip.print(String("GET /") + NTRIP_MOUNT + " HTTP/1.1\r\n");
  ntrip.print(String("Host: ") + NTRIP_HOST + ":" + NTRIP_PORT + "\r\n");
  ntrip.print("Ntrip-Version: Ntrip/2.0\r\n");
  ntrip.print("User-Agent: NTRIP CayGPS/1.0\r\n");
  ntrip.print("Authorization: Basic " + auth + "\r\n");
  ntrip.print("Connection: close\r\n\r\n");

  // Drain the response header line; the caster then streams raw RTCM3.
  unsigned long t0 = millis();
  while (ntrip.connected() && millis() - t0 < 3000) {
    String line = ntrip.readStringUntil('\n');
    if (line.startsWith("ICY 200") || line.startsWith("HTTP/1.1 200")) {
      Serial.println("NTRIP akis basladi");
    }
    if (line == "\r" || line.length() == 0) break;  // end of headers
  }
}

// Push our latest GGA up to the caster so it can compute corrections (VRS).
void ntripSendGga() {
  if (!ntrip.connected() || !haveGga) return;
  if (millis() - lastGgaSent < GGA_INTERVAL_MS) return;
  lastGgaSent = millis();
  ntrip.print(lastGga);
  ntrip.print("\r\n");
}

// Pipe incoming RTCM3 bytes from the caster straight into the receiver.
void ntripPumpRtcm() {
  while (ntrip.available()) {
    int b = ntrip.read();
    if (b >= 0) Serial2.write((uint8_t)b);
  }
}

// One complete NMEA line arrived from the receiver.
void onNmeaLine(char* line, size_t len) {
  webSocket.broadcastTXT(line, len);  // forward to every connected app

  // Cache the latest GGA for the NTRIP uplink.
  if (len > 6 && line[0] == '$' &&
      line[3] == 'G' && line[4] == 'G' && line[5] == 'A') {
    memcpy(lastGga, line, len);
    lastGga[len] = '\0';
    haveGga = true;
  }
}

void readGps() {
  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (nmeaLen > 0) {
        nmeaLine[nmeaLen] = '\0';
        onNmeaLine(nmeaLine, nmeaLen);
        nmeaLen = 0;
      }
      continue;
    }
    if (nmeaLen < sizeof(nmeaLine) - 1) {
      nmeaLine[nmeaLen++] = c;
    } else {
      nmeaLen = 0;  // overflow guard — drop the malformed line
    }
  }
}

void onWsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.printf("App bagli #%u\n", num);
  } else if (type == WStype_DISCONNECTED) {
    Serial.printf("App ayrildi #%u\n", num);
  }
}

// ─── Arduino lifecycle ─────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial2.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  connectWiFi();

  webSocket.begin();
  webSocket.onEvent(onWsEvent);
  Serial.printf("WebSocket: ws://%s:%u\n", WiFi.localIP().toString().c_str(), WS_PORT);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  webSocket.loop();
  readGps();          // receiver NMEA → app + GGA cache
  ntripConnect();     // keep the correction stream alive
  ntripSendGga();     // feed our position to the caster
  ntripPumpRtcm();    // corrections → receiver
}
