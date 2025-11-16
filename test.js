import { getGPU, getCanvas, getWebgl } from './collection-helper-functions.js';

async function collectPrivateSignals() {
  try {
  const time = Math.round(new Date().getMinutes() / 1) * 1;
  const screen_resolution = window.screen.availHeight + 'x' + window.screen.availWidth;
  const cores = navigator.hardwareConcurrency;
  // navigator.storage is not available through http
  let storage = 0
  try {
  storage = Math.round((await navigator.storage.estimate()).quota / 100000000); // incognito measures are unreliable and overtime change needs to be accounted for (likely means automatically updating it as well)
  } catch {
    storage = null
  }
  const language = navigator.language;
  const useragent = navigator.userAgent;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ram = (performance.memory?.totalJSHeapSize / 1024 / 1024).toFixed(2) // not in firefox, needs a rework
  const gpu = getGPU(); // very approx in firefox
  let ip_data = null
  try {
    ip_data = await (await fetch('https://ipapi.co/json/')).json() // cors limitations need a workaround, same with dns and webrtc
    } catch {
      console.log("Failed to get ip data")
    }
  console.log(ip_data)
  let device_type =  "Unknown"
  if (navigator.getBattery) { // not in firefox
    const battery = (await navigator.getBattery());
    if ((battery.charging && battery.chargingTime === 0) || (!battery.charging && battery.dischargingTime === Infinity)) {
      device_type = "Desktop"
    } else {
      device_type = "Laptop"
    }
  }
  const webgl_hash = await getWebgl()
  const [canvas_hash, spoofed_canvas] = await getCanvas() // os-specific variance requires further testing
  // idk if audio can be reasonably fingerprinted, haven't found a reliable way to fingerprint one by it yet
  const auth_string = `screen_resolution=${screen_resolution}&cores=${cores}&gpu=${gpu}&language=${language}&useragent=${useragent}&storage=${storage}&timezone=${timezone}&webgl_hash=${webgl_hash}&canvas_hash=${canvas_hash}&spoofed_canvas=${spoofed_canvas}&ip_data=${ip_data?.city},${ip_data?.asn}&ram=${ram}&time=${time}`;
  console.log(auth_string);
  return `${webgl_hash}&time=${time}` // for the demo, this is all that's needed
  //return auth_string;
  } catch (e) {
    console.error("Error while collecting private signals: " + e)
  }
}

export default collectPrivateSignals;
