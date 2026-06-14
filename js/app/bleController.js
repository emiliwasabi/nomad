const NOMAD_SERVICE = "12345678-1234-1234-1234-123456789abc";
const NOMAD_CHAR = "abcd1234-ab12-ab12-ab12-abcdef123456";

let connectedDevice = null;
let monitorTimer = null;

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function dispatchBleState(connected) {
  window.dispatchEvent(
    new CustomEvent("nomad-ble-state", { detail: { connected } }),
  );
}

function startConnectionMonitor() {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = setInterval(() => {
    const connected = Boolean(connectedDevice?.gatt?.connected);
    if (!connected && connectedDevice) {
      connectedDevice = null;
      dispatchBleState(false);
    }
  }, 1500);
}

window.NomadBLE = {
  onButtonPress: null,
  isConnected: () => Boolean(connectedDevice?.gatt?.connected),

  isSupported: () => Boolean(navigator.bluetooth),

  getUnsupportedHint() {
    if (navigator.bluetooth) return null;
    if (isIosDevice()) {
      return "Sur iPhone : installer Bluefy, puis ouvrir cette page en HTTPS.";
    }
    return "Utilisez Chrome ou Edge sur ordinateur (HTTPS).";
  },

  disconnect() {
    if (connectedDevice?.gatt?.connected) {
      connectedDevice.gatt.disconnect();
    }
    connectedDevice = null;
    dispatchBleState(false);
  },

  async connect() {
    if (!navigator.bluetooth) {
      console.error(window.NomadBLE.getUnsupportedHint());
      dispatchBleState(false);
      return false;
    }

    try {
      if (connectedDevice?.gatt?.connected) {
        dispatchBleState(true);
        return true;
      }

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [NOMAD_SERVICE] }],
        optionalServices: [NOMAD_SERVICE],
        acceptAllDevices: false,
      });

      device.addEventListener("gattserverdisconnected", () => {
        connectedDevice = null;
        dispatchBleState(false);
        console.log("Nomad BLE deconnecte");
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(NOMAD_SERVICE);
      const characteristic = await service.getCharacteristic(NOMAD_CHAR);

      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", (event) => {
        const message = new TextDecoder().decode(event.target.value).trim();
        if (message !== "play") return;
        console.log("[Nomad BLE] play");
        window.NomadBLE.onButtonPress?.();
      });

      connectedDevice = device;
      startConnectionMonitor();
      dispatchBleState(true);
      console.log("Nomad BLE connecte");
      return true;
    } catch (error) {
      dispatchBleState(false);
      if (error.name !== "NotFoundError") {
        console.error("BLE error:", error);
      }
      return false;
    }
  },
};
