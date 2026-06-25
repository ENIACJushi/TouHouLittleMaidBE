
export function writeErrorLog(msg: string) {
  document.getElementById("error_log").innerHTML += msg + '\n';
}
