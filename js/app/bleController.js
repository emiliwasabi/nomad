const MURMUR_SERVICE = "12345678-1234-1234-1234-123456789abc";
const MURMUR_CHAR = "abcd1234-ab12-ab12-ab12-abcdef123456";

let connectedDevice = null;

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

window.MurmurBLE = {
  onButtonPress: null,
  isConnected: () => Boolean(connectedDevice?.gatt?.connected),

  isSupported: () => Boolean(navigator.bluetooth),

  getUnsupportedHint() {
    if (navigator.bluetooth) return null;
    if (isIosDevice()) {
      return "Sur iPhone : installer Bluefy (navigateur Web BLE), puis ouvrir cette page en HTTPS.";
    }
    return "Utilisez Chrome ou Edge sur ordinateur (HTTPS).";
  },

  async connect() {
    if (!navigator.bluetooth) {
      console.error(window.MurmurBLE.getUnsupportedHint());
      return false;
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [MURMUR_SERVICE] }],
        optionalServices: [MURMUR_SERVICE],
        acceptAllDevices: false,
      });

      device.addEventListener("gattserverdisconnected", () => {
        connectedDevice = null;
        console.log("Murmur BLE deconnecte");
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(MURMUR_SERVICE);
      const characteristic = await service.getCharacteristic(MURMUR_CHAR);

      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", (event) => {
        const message = new TextDecoder().decode(event.target.value).trim();
        console.log("[Murmur BLE]", message);
        window.MurmurBLE.onButtonPress?.();
      });

      connectedDevice = device;
      console.log("Murmur BLE connecte");
      return true;
    } catch (error) {
      if (error.name !== "NotFoundError") {
        console.error("BLE error:", error);
      }
      return false;
    }
  },
};
