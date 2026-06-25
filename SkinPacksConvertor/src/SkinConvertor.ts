
import { SkinConvertor } from "./convertor/SkinConvertor";

declare global {
  interface Window {
    SkinConvertor: typeof SkinConvertor;
  }
}

window.SkinConvertor = SkinConvertor;
