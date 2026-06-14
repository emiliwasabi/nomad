// Nomad — XIAO ESP32-S3, bouton D1, BLE (Web Bluetooth / Bluefy)
#include <WiFi.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLESecurity.h>
#include <esp_gap_ble_api.h>
#include <esp_coexist.h>

#define SERVICE_UUID "12345678-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID "abcd1234-ab12-ab12-ab12-abcdef123456"
#define BUTTON_PIN D1

BLECharacteristic *pCharacteristic;
BLEServer *pServer = nullptr;
bool deviceConnected = false;
bool lastButtonState = HIGH;
unsigned long lastDebounce = 0;
const unsigned long DEBOUNCE_MS = 200;

void setMaxBlePower() {
  BLEDevice::setPower(ESP_PWR_LVL_P9);
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_DEFAULT, ESP_PWR_LVL_P9);
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_P9);
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_CONN_HDL0, ESP_PWR_LVL_P9);
}

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server, esp_ble_gatts_cb_param_t *param) {
    deviceConnected = true;
    setMaxBlePower();

    if (param != nullptr) {
      esp_ble_conn_update_params_t connParams = {};
      memcpy(connParams.bda, param->connect.remote_bda, 6);
      connParams.min_int = 0x18;
      connParams.max_int = 0x30;
      connParams.latency = 0;
      connParams.timeout = 960;
      esp_ble_gap_update_conn_params(&connParams);
    }

    Serial.println("Client connected");
  }

  void onConnect(BLEServer *server) {
    onConnect(server, nullptr);
  }

  void onDisconnect(BLEServer *server) {
    deviceConnected = false;
    Serial.println("Client disconnected");
    setMaxBlePower();
    server->getAdvertising()->start();
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  WiFi.mode(WIFI_OFF);
  esp_coex_preference_set(ESP_COEX_PREFER_BT);

  BLEDevice::init("Nomad");
  setMaxBlePower();

  BLESecurity *pSecurity = new BLESecurity();
  pSecurity->setAuthenticationMode(ESP_LE_AUTH_NO_BOND);
  pSecurity->setCapability(ESP_IO_CAP_NONE);
  pSecurity->setInitEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);
  pSecurity->setRespEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE |
          BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE);
  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();

  Serial.println("Nomad BLE ready");
}

void loop() {
  bool buttonState = digitalRead(BUTTON_PIN);
  unsigned long now = millis();

  // Front descendante + confirmation (evite faux appuis / bruit)
  if (buttonState == LOW && lastButtonState == HIGH &&
      (now - lastDebounce) > DEBOUNCE_MS) {
    delay(30);
    if (digitalRead(BUTTON_PIN) == LOW) {
      lastDebounce = now;
      Serial.println("BUTTON PRESSED");

      if (deviceConnected && pCharacteristic != nullptr) {
        const char *msg = "play";
        pCharacteristic->setValue((uint8_t *)msg, strlen(msg));
        pCharacteristic->notify();
        Serial.println("BLE notify: play");
      } else {
        Serial.println("No BLE client");
      }
    }
  }

  lastButtonState = buttonState;
  delay(10);
}
