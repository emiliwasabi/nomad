// Murmur — XIAO ESP32-S3, bouton sur D1, BLE sans pairing (compatible Web Bluetooth)
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLESecurity.h>

#define SERVICE_UUID "12345678-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID "abcd1234-ab12-ab12-ab12-abcdef123456"
#define BUTTON_PIN D1

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;
bool lastButtonState = HIGH;
unsigned long lastDebounce = 0;
const unsigned long DEBOUNCE_MS = 50;

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    Serial.println("Client connected");
  }

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println("Client disconnected");
    pServer->getAdvertising()->start();
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  BLEDevice::init("Murmur");

  // Web Bluetooth (Chrome) ne fait pas de pairing classique — pas de chiffrement requis
  BLESecurity *pSecurity = new BLESecurity();
  pSecurity->setAuthenticationMode(ESP_LE_AUTH_NO_BOND);
  pSecurity->setCapability(ESP_IO_CAP_NONE);
  pSecurity->setInitEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);
  pSecurity->setRespEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);

  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // READ + WRITE : le navigateur doit ecrire le descripteur 0x2902 pour activer NOTIFY
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

  Serial.println("Murmur BLE ready (no pairing)");
}

void loop() {
  bool buttonState = digitalRead(BUTTON_PIN);
  unsigned long now = millis();

  if (buttonState == LOW && lastButtonState == HIGH &&
      (now - lastDebounce) > DEBOUNCE_MS) {
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

  lastButtonState = buttonState;
  delay(10);
}
